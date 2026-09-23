import { PROVIDERS, providerMeta, canonicalProvider, evaluateAlert, budgetFor, rollDaily, rollRows, rollSessionRows, dayKeyOfMs, totalsOf } from '../core/core.ts'
import type { MonitorConfig, OverviewData, ProviderView, UsageData, ProviderId, ProviderBudgetView, PlatformSpend } from '../core/core.ts'
import type { ScanResult } from './usage.ts'
import { getAdapter } from '../adapters/index.ts'
import { resolveProviderKey } from './keys.ts'
import type { CredentialsLike, AgentDefaultModelLike } from '../context.ts'
import type { AdapterOptions } from '../adapters/types.ts'

export interface MonitorDeps {
  credentials?: CredentialsLike
  agentDefaultModel?: AgentDefaultModelLike
}

export interface BuildUsageParams {
  days: number
  provider: string
  model: string
  group: 'day' | 'session'
}

function todayCostFor(records: ScanResult['records'], provider: string, todayKey: string): number | null {
  let cost: number | null = null
  for (const r of records) {
    if (canonicalProvider(r.provider) !== provider) continue
    if (dayKeyOfMs(r.at) !== todayKey) continue
    if (r.cost !== null) cost = (cost ?? 0) + r.cost
  }
  return cost
}

function buildProviderView(meta: { id: ProviderId; label: string }, now: number): ProviderView {
  return {
    provider: meta.id,
    label: meta.label,
    keyConfigured: false,
    status: 'error',
    error: null,
    balance: null,
    budget: null,
    remainingPct: null,
    alert: null,
    today: null,
    refreshedAt: now,
  }
}

export async function buildOverview(
  config: MonitorConfig,
  deps: MonitorDeps,
  scan: () => Promise<ScanResult>,
  nowMs = Date.now(),
  platform: PlatformSpend | null = null,
): Promise<OverviewData> {
  const scanResult = await scan()
  const now = new Date(nowMs)
  const todayKey = dayKeyOfMs(nowMs)

  // ---- account-wide today (all providers, from the harness session logs) ----
  const todayRecords = scanResult.records.filter((r) => dayKeyOfMs(r.at) === todayKey)
  const todayTotals = totalsOf(todayRecords)
  const today = {
    total: todayTotals.total,
    input: todayTotals.input,
    output: todayTotals.output,
    cost: todayTotals.cost,
    calls: todayTotals.calls,
  }

  // ---- month spend per provider (for budget fallback when no balance API) ----
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-`
  const monthSpend = new Map<string, number>()
  for (const r of scanResult.records) {
    if (!dayKeyOfMs(r.at).startsWith(monthPrefix)) continue
    if (r.cost === null) continue
    const spendProvider = canonicalProvider(r.provider)
    monthSpend.set(spendProvider, (monthSpend.get(spendProvider) ?? 0) + r.cost)
  }

  // ---- current model selection (optional) ----
  let current: OverviewData['current'] = null
  if (deps.agentDefaultModel !== undefined) {
    try {
      const sel = deps.agentDefaultModel.currentSelection()
      if (sel !== undefined && sel.model !== undefined && sel.model !== '') {
        current = { provider: sel.provider ?? 'unknown', model: sel.model }
      }
    } catch {
      // selection service can throw before being ready — degrade gracefully
    }
  }

  // ---- balances for every enabled provider ----
  const views = await Promise.all(
    PROVIDERS.map(async (meta) => {
      const view = buildProviderView(meta, nowMs)
      const cfg = config.balances[meta.id]
      if (cfg?.enabled === false) {
        view.status = 'unsupported'
        view.error = 'disabled'
        return view
      }
      view.keyConfigured = true
      const key = await resolveProviderKey(deps.credentials, meta, config.envKeys[meta.id])
      if (key === undefined) {
        view.keyConfigured = false
        view.status = 'missing-key'
        view.error = 'missing-key'
        return view
      }
      const opts: AdapterOptions = {
        timeoutMs: 5_000,
        retries: 3,
      }
      if (typeof cfg?.balanceUrl === 'string' && cfg.balanceUrl !== '') opts.baseUrl = cfg.balanceUrl
      try {
        const adapter = getAdapter(meta.id)
        const outcome = await adapter.getBalance(key.value, opts)
        if (outcome.ok) {
          view.status = 'ok'
          view.balance = {
            supported: true,
            currency: outcome.data.currency,
            amount: outcome.data.amount,
            granted: outcome.data.granted,
            toppedUp: outcome.data.toppedUp,
            reason: null,
          }
        } else {
          view.status = outcome.code === 'unsupported' ? 'unsupported' : 'error'
          view.error = outcome.code
          view.balance = {
            supported: false,
            currency: meta.currencyHint,
            amount: Number.NaN,
            granted: null,
            toppedUp: null,
            reason: outcome.message,
          }
        }
      } catch (err) {
        view.status = 'error'
        view.error = 'unknown'
        view.balance = {
          supported: false,
          currency: meta.currencyHint,
          amount: Number.NaN,
          granted: null,
          toppedUp: null,
          reason: err instanceof Error ? err.message : String(err),
        }
      }
      return view
    }),
  )

  // ---- budget + alert evaluation per provider ----
  const providers: ProviderView[] = []
  for (const view of views) {
    const meta = providerMeta(view.provider)
    const budget = budgetFor(config, view.provider, view.balance?.currency ?? meta.currencyHint)
    const budgetView: ProviderBudgetView = {
      amount: budget.amount,
      currency: budget.currency,
      warnPct: budget.warnPct,
    }
    view.budget = budgetView
    const balanceAmount = view.balance?.supported === true && Number.isFinite(view.balance.amount) ? view.balance.amount : null
    const spendAmount = budget.amount !== null ? monthSpend.get(view.provider) ?? null : null
    const evalResult = evaluateAlert({
      balanceAmount,
      spendAmount,
      budget,
    })
    view.remainingPct = evalResult.remainingPct
    view.alert = evalResult.level === 'ok' ? (view.balance?.supported === false ? null : 'ok') : evalResult.level
    // today usage for this provider
    const provToday = scanResult.records.filter((r) => canonicalProvider(r.provider) === view.provider && dayKeyOfMs(r.at) === todayKey)
    const pt = totalsOf(provToday)
    view.today = {
      total: pt.total,
      input: pt.input,
      output: pt.output,
      cost: todayCostFor(scanResult.records, view.provider, todayKey),
      calls: pt.calls,
    }
    providers.push(view)
  }

  return {
    at: nowMs,
    current,
    providers,
    today,
    usageCoverage: scanResult.coverage,
    platform,
  }
}

export async function buildUsage(
  scan: () => Promise<ScanResult>,
  params: BuildUsageParams,
  nowMs = Date.now(),
): Promise<UsageData> {
  const scanResult = await scan()
  const days = params.days
  const provider = params.provider
  const model = params.model

  const filtered = scanResult.records.filter((r) => {
    if (provider !== '' && r.provider !== provider) return false
    if (model !== '' && r.model !== model) return false
    return true
  })

  // Distinct providers/models within the window (for the filter dropdowns).
  const first = new Date(nowMs)
  first.setHours(0, 0, 0, 0)
  const windowStart = first.getTime() - (days - 1) * 86_400_000
  const provSet = new Set<string>()
  const modelSet = new Set<string>()
  for (const r of filtered) {
    if (r.at < windowStart) continue
    provSet.add(r.provider)
    modelSet.add(r.model)
  }
  const inWindow = filtered.filter((r) => r.at >= windowStart)

  const daily = rollDaily(inWindow, days, new Date(nowMs))
  const rows = params.group === 'session' ? [] : rollRows(inWindow, days, new Date(nowMs))
  const sessionRows = params.group === 'session' ? rollSessionRows(inWindow, days, new Date(nowMs)) : []

  const totals = totalsOf(inWindow)
  return {
    days,
    at: nowMs,
    provider,
    model,
    group: params.group,
    daily,
    rows,
    sessionRows,
    models: [...modelSet].sort(),
    providers: [...provSet].sort(),
    totals: {
      total: totals.total,
      input: totals.input,
      output: totals.output,
      cost: totals.cost,
      calls: totals.calls,
    },
    coverage: scanResult.coverage,
  }
}

export function balanceMoney(view: ProviderView): { amount: number; currency: string } | null {
  if (view.balance?.supported !== true || !Number.isFinite(view.balance.amount)) return null
  return { amount: view.balance.amount, currency: view.balance.currency }
}
