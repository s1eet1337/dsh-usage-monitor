/**
 * dsh-usage-monitor — shared pure core.
 *
 * This module is intentionally SELF-CONTAINED (zero relative imports) so it can
 * be compiled twice from the same source: once into the Node host bundle
 * (ESM, `src/core/*.ts` imports) and once into the browser client bundle
 * (CJS, extension-less imports). Everything here must stay free of `node:*`
 * and DOM imports.
 */

/* ------------------------------------------------------------------ *
 * Provider registry
 * ------------------------------------------------------------------ */

export type ProviderId =
  | 'deepseek'
  | 'openai'
  | 'anthropic'
  | 'zhipu'
  | 'moonshot'
  | 'siliconflow'

export interface ProviderMeta {
  readonly id: ProviderId
  /** Short display name (used in cards / dropdowns). */
  readonly label: string
  /** Environment / credentials names tried in order when resolving the key. */
  readonly keyEnv: readonly string[]
  /** Default balance currency when the API response omits one. */
  readonly currencyHint: string
  /** One line about what the official API can and cannot report. */
  readonly note: string
  /** Official docs URL for balance/usage lookup. */
  readonly docs: string
}

export const PROVIDERS: readonly ProviderMeta[] = [
  {
    id: 'deepseek',
    label: 'DeepSeek',
    keyEnv: ['DEEPSEEK_API_KEY'],
    currencyHint: 'CNY',
    note: '官方 GET /user/balance 返回可用余额；用量从 DSH 会话日志统计。',
    docs: 'https://api-docs.deepseek.com/zh-cn/api/get-user-balance',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    keyEnv: ['OPENAI_API_KEY'],
    currencyHint: 'USD',
    note: '官方已停用 credit_grants 余额查询（大多数新账号返回 404/401）；v1/models 仅校验 Key。余额默认不可用。',
    docs: 'https://platform.openai.com/docs/guides/usage',
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    keyEnv: ['ANTHROPIC_API_KEY'],
    currencyHint: 'USD',
    note: 'API Key 无公开余额/用量接口（组织 Admin API 需独立权限）。v1/models 仅校验 Key。',
    docs: 'https://docs.anthropic.com/en/api/admin-api/usage-costs',
  },
  {
    id: 'zhipu',
    label: '智谱 GLM',
    keyEnv: ['ZHIPUAI_API_KEY', 'GLM_API_KEY', 'ZAI_API_KEY'],
    currencyHint: 'CNY',
    note: '开放平台 GET /api/paas/v4/balance 返回余额；结构随账号类型略有差异，取不到时降级为“不可用”。',
    docs: 'https://open.bigmodel.cn/dev/api/normal-model/glm-4',
  },
  {
    id: 'moonshot',
    label: 'Moonshot / Kimi',
    keyEnv: ['MOONSHOT_API_KEY', 'KIMI_API_KEY'],
    currencyHint: 'CNY',
    note: 'API 余额查询接口未公开稳定契约（官方文档仅控制台查看）；v1/models 仅校验 Key。',
    docs: 'https://www.kimi.com/en/help/kimi-api/api-balance-and-usage',
  },
  {
    id: 'siliconflow',
    label: 'SiliconFlow',
    keyEnv: ['SILICONFLOW_API_KEY'],
    currencyHint: 'CNY',
    note: 'GET /v1/user/info 返回账户余额（data.totalBalance）。',
    docs: 'https://docs.siliconflow.cn/cn/userguide/account/balance',
  },
]

/**
 * Map a harness runtime provider id onto this plugin's registry id.
 *
 * The harness names providers for the runtime ("deepseek-official",
 * "llama-cpp-qwen3-14b"), while balances, budgets and the pricing table are
 * keyed by the registry id ("deepseek"). Without this mapping every provider
 * card reports 0 usage while the account burns millions of tokens, and no price
 * ever matches. Unknown providers (local models, future ones) pass through
 * unchanged so their usage still appears in the ledger.
 */
export function canonicalProvider(id: string): string {
  for (const p of PROVIDERS) {
    if (id === p.id || id.startsWith(`${p.id}-`) || id.startsWith(`${p.id}_`)) return p.id
  }
  return id
}

export function providerMeta(id: string): ProviderMeta {
  const meta = PROVIDERS.find((p) => p.id === id)
  if (meta !== undefined) return meta
  // Unknown provider (e.g. a future harness provider) degrades gracefully.
  return {
    id: id as ProviderId,
    label: id,
    keyEnv: [],
    currencyHint: 'USD',
    note: '未收录的 Provider，仅展示日志统计。',
    docs: '',
  }
}

/* ------------------------------------------------------------------ *
 * Wire contract shared by the host API and the client fetchers.
 * ------------------------------------------------------------------ */

export type ProviderStatus = 'ok' | 'missing-key' | 'unsupported' | 'error'

export type AlertLevel = 'ok' | 'warn' | 'critical'

export interface Money {
  amount: number
  currency: string
}

export interface BalanceView {
  supported: boolean
  currency: string
  amount: number
  granted: number | null
  toppedUp: number | null
  /** Why balance is unavailable (unsupported / http / auth …). */
  reason: string | null
}

export interface ProviderBudgetView {
  amount: number | null
  currency: string
  warnPct: number
}

export interface ProviderUsageToday {
  total: number
  input: number
  output: number
  cost: number | null
  calls: number
}

export interface ProviderView {
  provider: ProviderId
  label: string
  keyConfigured: boolean
  status: ProviderStatus
  /** Machine-readable error code for the status. */
  error: string | null
  balance: BalanceView | null
  budget: ProviderBudgetView | null
  /** Balance remaining as a fraction of the budget (0..1+), null when unknowable. */
  remainingPct: number | null
  alert: AlertLevel | null
  today: ProviderUsageToday | null
  refreshedAt: number
}

export interface CurrentSelection {
  provider: string
  model: string
}

export interface OverviewData {
  at: number
  current: CurrentSelection | null
  providers: ProviderView[]
  /** Account-wide usage today, derived from the harness session logs. */
  today: {
    total: number
    input: number
    output: number
    cost: number | null
    calls: number
  } | null
  usageCoverage: UsageCoverage | null
  /**
   * DeepSeek 平台实际消费快照（与估算花费并列展示）。null = 未启用/尚未取到；
   * status='loading' 表示 host 正在后台刷新，本次是上一份快照。
   */
  platform: PlatformSpend | null
}

export interface UsageCoverage {
  listedSessions: number
  scannedSessions: number
  usageRecords: number
  skippedRecords: number
  failedSessions: number
  earliestAt: number | null
  latestAt: number | null
}

export interface DailyPoint {
  date: string
  input: number
  output: number
  cache: number
  total: number
  cost: number | null
  calls: number
}

/** One row of the details table (group=day: date × provider × model). */
export interface UsageRow {
  date: string
  provider: string
  model: string
  input: number
  output: number
  cache: number
  total: number
  cost: number | null
  calls: number
  sessions: number
  topSession: string
}

/** One row of the details table (group=session). */
export interface SessionRow {
  date: string
  sessionId: string
  title: string
  provider: string
  model: string
  input: number
  output: number
  cache: number
  total: number
  cost: number | null
  calls: number
}

export interface UsageData {
  days: number
  at: number
  provider: string
  model: string
  group: 'day' | 'session'
  daily: DailyPoint[]
  rows: UsageRow[]
  sessionRows: SessionRow[]
  models: string[]
  providers: string[]
  totals: {
    total: number
    input: number
    output: number
    cost: number | null
    calls: number
  }
  coverage: UsageCoverage | null
}

/* ------------------------------------------------------------------ *
 * DeepSeek 开放平台「实际消费」视图
 *
 * 数据来自 platform.deepseek.com 的登录态私有接口（见
 * src/adapters/deepseek-platform.ts）。它与本插件的估算花费是两条独立的
 * 口径：估算 = DSH 会话日志 × 参考价；实际 = 平台账单。
 * ------------------------------------------------------------------ */

export type PlatformStatus =
  | 'ok'
  /** Host 正在后台取数，本次返回的是上一份快照（可能为 null）。 */
  | 'loading'
  | 'disabled'
  | 'missing-token'
  | 'auth'
  | 'http'
  | 'network'
  | 'parse'

export interface PlatformWallet {
  /** 充值余额（normal_wallets）。 */
  normal: number | null
  /** 赠送余额（bonus_wallets）。 */
  bonus: number | null
  currency: string
}

export interface PlatformDayPoint {
  date: string
  /** 输入 token 合计（含缓存命中 + 未命中）。 */
  input: number
  cacheHit: number
  cacheMiss: number
  output: number
  total: number
  /** 平台口径的实际消费（币种见 PlatformSpend.currency）。 */
  cost: number
}

export interface PlatformModelRow {
  model: string
  input: number
  output: number
  cache: number
  total: number
  cost: number
  /** 该模型占本月消费的比例（0..1）。 */
  share: number
}

export interface PlatformMonthPoint {
  /** YYYY-MM */
  month: string
  tokens: number
  cost: number
}

export interface PlatformSpend {
  at: number
  status: PlatformStatus
  /** status 非 ok/loading 时的人类可读原因。 */
  error: string | null
  currency: string
  wallet: PlatformWallet | null
  /** 平台当前的月份桶（UTC 日界），today 取的就是这一桶。 */
  today: { date: string; tokens: number; cost: number }
  month: { month: string; tokens: number; cost: number }
  /** 全部历史累计（逐月回溯汇总）。 */
  lifetime: { cost: number; tokens: number; months: number; complete: boolean }
  /** 本月按模型拆分，按消费降序。 */
  byModel: PlatformModelRow[]
  /** 本月 + 上月逐日（升序），用于趋势图。 */
  daily: PlatformDayPoint[]
  /** 逐月汇总（降序，含本月）。 */
  months: PlatformMonthPoint[]
}

/* ------------------------------------------------------------------ *
 * Plugin config
 * ------------------------------------------------------------------ */

export interface BudgetConfig {
  /** Budget ceiling, in the balance currency of the provider. */
  budget?: number
  /** Currency override for the budget (defaults to provider currencyHint). */
  currency?: string
  /** Alert when remaining balance drops to ≤ this percent of the budget. */
  warnPct?: number
  /** Show / monitor this provider at all. Default true. */
  enabled?: boolean
  /** Optional override of the balance API URL (proxies / relays). */
  balanceUrl?: string
}

export interface WebhookConfig {
  url: string
  /** Optional HMAC-SHA256 secret; header `x-dsh-usage-monitor-signature`. */
  secret?: string
  /** Cooldown in ms between webhook fires for the same provider. */
  cooldownMs?: number
  enabled?: boolean
}

export interface PricingOverride {
  provider: string
  /** Model name or substring (case-insensitive). */
  model: string
  /** USD per 1M input tokens. */
  priceIn: number
  /** USD per 1M output tokens. */
  priceOut: number
}

/**
 * DeepSeek 开放平台同步配置。
 *
 * 官方 API 不提供消费查询；网页版用量页走的是登录态私有接口，认证凭据是
 * 浏览器 localStorage 里的 `userToken`。该凭据由用户手动粘贴、只保存在本机
 * 配置文件里，并在传给浏览器前置空（与 webhook secret 同等对待）。
 */
export interface DeepSeekPlatformConfig {
  /** 关闭后完全跳过平台同步（不产生任何请求）。 */
  enabled?: boolean
  /** 累计消费最多向前回溯的月数（1..60）。 */
  historyMonths?: number
  /** 平台登录态 token。仅 host 持有；GET /config 回传时置空。 */
  userToken?: string
}

/**
 * Extract the bare token from whatever shape arrived.
 *
 * Tokens are copied out of DevTools, so the field often receives a JSON wrapper
 * (`{"value":"…","__version":"0"}`) or just the trailing fragment
 * (`…","__version":"0"}`). Either one makes the Authorization header invalid
 * (platform code 40003), which looks like an expired login rather than a paste
 * mistake. A real token is a run of base64 characters, so anything the clipboard
 * added falls outside that set.
 */
export function normalizeUserToken(raw: string): string {
  const text = raw.trim()
  if (text === '') return ''
  const wrapped = /"value"\s*:\s*"([^"]+)"/.exec(text)
  if (wrapped !== null && typeof wrapped[1] === 'string' && wrapped[1] !== '') return wrapped[1].trim()
  const run = /[A-Za-z0-9_\-+/=]{16,}/.exec(text)
  if (run !== null) return run[0]
  return text.replace(/^Bearer\s+/i, '').trim()
}

export interface MonitorConfig {
  balances: Record<string, BudgetConfig>
  webhooks: WebhookConfig[]
  /** Browser poll interval in ms (default 60_000). */
  pollMs: number
  /** Usage windows offered / persisted (days). Default 90. */
  retentionDays: number
  /** Per-provider API-key environment overrides. */
  envKeys: Record<string, string>
  pricing: PricingOverride[]
  /** DeepSeek 平台「实际消费」同步。 */
  deepseekPlatform: DeepSeekPlatformConfig
  /** Persist path override (mainly for tests / odd installs). */
  storageDir?: string
}

export const DAY_OPTIONS: readonly number[] = [7, 30, 90]

export function defaultBudgetConfig(provider: ProviderId): BudgetConfig {
  return { budget: undefined, warnPct: 5, enabled: true }
}

export function defaultConfig(): MonitorConfig {
  const balances: Record<string, BudgetConfig> = {}
  for (const p of PROVIDERS) balances[p.id] = defaultBudgetConfig(p.id)
  return {
    balances,
    webhooks: [],
    pollMs: 60_000,
    retentionDays: 90,
    envKeys: {},
    pricing: [],
    deepseekPlatform: { enabled: true, historyMonths: 36 },
  }
}

export function normalizeConfig(raw: unknown): MonitorConfig {
  const base = defaultConfig()
  if (raw === null || typeof raw !== 'object') return base
  const src = raw as Record<string, unknown>
  const balancesRaw = isRecord(src.balances) ? src.balances : {}
  for (const p of PROVIDERS) {
    const entry = isRecord(balancesRaw[p.id]) ? (balancesRaw[p.id] as Record<string, unknown>) : {}
    const budget = pickNumber(entry.budget)
    const currency = typeof entry.currency === 'string' && entry.currency !== '' ? entry.currency : undefined
    const warnPct = pickNumber(entry.warnPct)
    const enabled = typeof entry.enabled === 'boolean' ? entry.enabled : true
    const balanceUrl = typeof entry.balanceUrl === 'string' && entry.balanceUrl !== '' ? entry.balanceUrl : undefined
    base.balances[p.id] = {
      budget: budget !== undefined && budget > 0 ? budget : undefined,
      currency,
      warnPct: warnPct === undefined ? 5 : clamp(warnPct, 0.1, 100),
      enabled,
      balanceUrl,
    }
  }
  if (Array.isArray(src.webhooks)) {
    base.webhooks = src.webhooks
      .filter((w): w is Record<string, unknown> => isRecord(w))
      .map((w) => ({
        url: typeof w.url === 'string' ? w.url : '',
        secret: typeof w.secret === 'string' ? w.secret : undefined,
        cooldownMs: pickNumber(w.cooldownMs),
        enabled: typeof w.enabled === 'boolean' ? w.enabled : true,
      }))
      .filter((w) => w.url !== '')
  }
  const pollMs = pickNumber(src.pollMs)
  if (pollMs !== undefined) base.pollMs = clamp(pollMs, 5_000, 3_600_000)
  const retention = pickNumber(src.retentionDays)
  if (retention !== undefined) base.retentionDays = clamp(Math.round(retention), 7, 730)
  if (isRecord(src.envKeys)) {
    for (const [k, v] of Object.entries(src.envKeys)) {
      if (typeof v === 'string' && v !== '') base.envKeys[k] = v
    }
  }
  if (Array.isArray(src.pricing)) {
    base.pricing = src.pricing
      .filter((p): p is Record<string, unknown> => isRecord(p))
      .map((p) => ({
        provider: typeof p.provider === 'string' ? p.provider : '',
        model: typeof p.model === 'string' ? p.model : '',
        priceIn: pickNumber(p.priceIn) ?? 0,
        priceOut: pickNumber(p.priceOut) ?? 0,
      }))
      .filter((p) => p.provider !== '' && p.model !== '' && p.priceIn > 0 && p.priceOut > 0)
  }
  if (isRecord(src.deepseekPlatform)) {
    const plat = src.deepseekPlatform
    base.deepseekPlatform = {
      enabled: typeof plat.enabled === 'boolean' ? plat.enabled : true,
      historyMonths: clamp(Math.round(pickNumber(plat.historyMonths) ?? 36), 1, 60),
      userToken: (() => {
        if (typeof plat.userToken !== 'string') return undefined
        const cleaned = normalizeUserToken(plat.userToken)
        return cleaned === '' ? undefined : cleaned
      })(),
    }
  }
  if (typeof src.storageDir === 'string' && src.storageDir !== '') base.storageDir = src.storageDir
  return base
}

/* ------------------------------------------------------------------ *
 * Budget / alert evaluation
 * ------------------------------------------------------------------ */

export interface BudgetState {
  amount: number | null
  currency: string
  warnPct: number
}

export function budgetFor(config: MonitorConfig, id: string, fallbackCurrency: string): BudgetState {
  const entry = config.balances[id]
  const amount = entry?.budget !== undefined && entry.budget !== null && entry.budget > 0 ? entry.budget : null
  const currency = entry?.currency ?? fallbackCurrency
  const warnPct = entry?.warnPct ?? 5
  return { amount, currency, warnPct }
}

/**
 * Evaluate the alert level for one provider.
 * - balance known: remaining = balance; remainingPct = balance / budget.
 * - balance unknown but monthly spend estimated and budget set:
 *   remaining ≈ budget − spend (best effort).
 */
export function evaluateAlert(args: {
  balanceAmount: number | null
  spendAmount: number | null
  budget: BudgetState
}): { level: AlertLevel; remainingPct: number | null } {
  const { balanceAmount, spendAmount, budget } = args
  const budgetAmount = budget.amount
  if (budgetAmount === null) {
    // No user budget: no progress bar, no pct alerts (absolute floor is not
    // supported by design — the budget is the user's own number).
    return { level: 'ok', remainingPct: null }
  }
  if (balanceAmount !== null) {
    const remainingPct = budgetAmount > 0 ? balanceAmount / budgetAmount : 0
    const level: AlertLevel =
      balanceAmount <= 0 ? 'critical'
        : remainingPct * 100 <= budget.warnPct ? 'warn'
          : 'ok'
    return { level, remainingPct }
  }
  if (spendAmount !== null) {
    // Estimate remaining from budget minus observed spend (only meaningful
    // when the user set a budget as a top-up ceiling).
    const remaining = budgetAmount - spendAmount
    const remainingPct = budgetAmount > 0 ? remaining / budgetAmount : 0
    const level: AlertLevel =
      remaining <= 0 ? 'critical'
        : remainingPct * 100 <= budget.warnPct ? 'warn'
          : 'ok'
    return { level, remainingPct }
  }
  return { level: 'ok', remainingPct: null }
}

/* ------------------------------------------------------------------ *
 * Usage records & aggregation (pure)
 * ------------------------------------------------------------------ */

export interface UsageRecord {
  at: number
  provider: string
  model: string
  input: number
  output: number
  cache: number
  reasoning: number
  sessionId: string
  sessionTitle: string
  /** Estimated USD cost (reference pricing), null when the model has no rate. */
  cost: number | null
}

export interface Totals {
  input: number
  output: number
  cache: number
  reasoning: number
  total: number
  /** Sum of known (estimated) cost in USD-equivalent; null until any priced. */
  cost: number | null
  costCalls: number
  calls: number
}

export const emptyTotals = (): Totals => ({
  input: 0,
  output: 0,
  cache: 0,
  reasoning: 0,
  total: 0,
  cost: null,
  costCalls: 0,
  calls: 0,
})

export function addToTotals(t: Totals, input: number, output: number, cache: number, reasoning: number, cost: number | null): void {
  t.input += input
  t.output += output
  t.cache += cache
  t.reasoning += reasoning
  t.total += input + output + cache
  t.calls += 1
  if (cost !== null) {
    t.cost = (t.cost ?? 0) + cost
    t.costCalls += 1
  }
}

export const dayKeyOf = (d: Date): string =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`

export const dayKeyOfMs = (ms: number): string => dayKeyOf(new Date(ms))

export function dateBefore(now: Date, days: number): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - days)
}

export function dayKeysBackTo(now: Date, count: number): string[] {
  const keys: string[] = []
  for (let i = count - 1; i >= 0; i--) keys.push(dayKeyOf(dateBefore(now, i)))
  return keys
}

/**
 * Filter records to the trailing `days` calendar days (inclusive), then fold
 * per-day totals. Cost folding: unknown-model records contribute 0 but are
 * counted separately by the caller when needed.
 */
export function rollDaily(records: readonly UsageRecord[], days: number, now = new Date()): DailyPoint[] {
  const first = dayKeyOf(dateBefore(now, days - 1))
  const last = dayKeyOf(now)
  const buckets = new Map<string, Totals>()
  for (const r of records) {
    const key = dayKeyOfMs(r.at)
    if (key < first || key > last) continue
    let b = buckets.get(key)
    if (b === undefined) {
      b = emptyTotals()
      buckets.set(key, b)
    }
    addToTotals(b, r.input, r.output, r.cache, r.reasoning, r.cost)
  }
  const out: DailyPoint[] = []
  for (let i = days - 1; i >= 0; i--) {
    const key = dayKeyOf(dateBefore(now, i))
    const b = buckets.get(key) ?? emptyTotals()
    out.push({ date: key, input: b.input, output: b.output, cache: b.cache, total: b.total, cost: b.cost, calls: b.calls })
  }
  return out
}

export function totalsOf(records: readonly UsageRecord[]): Totals {
  const t = emptyTotals()
  for (const r of records) addToTotals(t, r.input, r.output, r.cache, r.reasoning, r.cost)
  return t
}

/**
 * Group day×provider×model rows (details table) over the trailing window.
 * `sessions` = number of distinct sessions contributing to that group.
 */
export function rollRows(records: readonly UsageRecord[], days: number, now = new Date()): UsageRow[] {
  const first = dayKeyOf(dateBefore(now, days - 1))
  const last = dayKeyOf(now)
  interface Acc extends Totals {
    sessions: Set<string>
    topSession: Map<string, number>
  }
  const map = new Map<string, Acc>()
  for (const r of records) {
    const key = dayKeyOfMs(r.at)
    if (key < first || key > last) continue
    const group = `${key}\u0000${r.provider}\u0000${r.model}`
    let acc = map.get(group)
    if (acc === undefined) {
      acc = { ...emptyTotals(), sessions: new Set(), topSession: new Map() }
      map.set(group, acc)
    }
    addToTotals(acc, r.input, r.output, r.cache, r.reasoning, r.cost)
    const eventTotal = r.input + r.output + r.cache
    acc.sessions.add(r.sessionId)
    acc.topSession.set(r.sessionId, (acc.topSession.get(r.sessionId) ?? 0) + eventTotal)
  }
  const out: UsageRow[] = []
  for (const [group, acc] of map) {
    const [date, provider, model] = group.split('\u0000')
    let topSession = ''
    let top = -1
    for (const [sid, total] of acc.topSession) {
      if (total > top) {
        top = total
        topSession = sid
      }
    }
    out.push({
      date: date ?? '',
      provider: provider ?? '',
      model: model ?? '',
      input: acc.input,
      output: acc.output,
      cache: acc.cache,
      total: acc.total,
      cost: acc.cost,
      calls: acc.calls,
      sessions: acc.sessions.size,
      topSession,
    })
  }
  out.sort((a, b) => (a.date === b.date ? b.total - a.total : a.date < b.date ? -1 : 1))
  return out
}

export function rollSessionRows(records: readonly UsageRecord[], days: number, now = new Date()): SessionRow[] {
  const first = dayKeyOf(dateBefore(now, days - 1))
  const last = dayKeyOf(now)
  interface Acc extends Totals { }
  const map = new Map<string, Acc>()
  for (const r of records) {
    const key = dayKeyOfMs(r.at)
    if (key < first || key > last) continue
    const group = `${key}\u0000${r.sessionId}\u0000${r.provider}\u0000${r.model}`
    let acc = map.get(group)
    if (acc === undefined) {
      acc = { ...emptyTotals() }
      map.set(group, acc)
    }
    addToTotals(acc, r.input, r.output, r.cache, r.reasoning, r.cost)
  }
  const out: SessionRow[] = []
  const titleBySession = new Map<string, string>()
  for (const r of records) {
    if (!titleBySession.has(r.sessionId) && r.sessionTitle !== '') titleBySession.set(r.sessionId, r.sessionTitle)
  }
  for (const [group, acc] of map) {
    const [date, sessionId, provider, model] = group.split('\u0000')
    out.push({
      date: date ?? '',
      sessionId: sessionId ?? '',
      title: titleBySession.get(sessionId ?? '') ?? `会话 ${(sessionId ?? '').slice(0, 8)}`,
      provider: provider ?? '',
      model: model ?? '',
      input: acc.input,
      output: acc.output,
      cache: acc.cache,
      total: acc.total,
      cost: acc.cost,
      calls: acc.calls,
    })
  }
  out.sort((a, b) => (a.date === b.date ? b.total - a.total : a.date < b.date ? -1 : 1))
  return out
}

/* ------------------------------------------------------------------ *
 * Formatting helpers
 * ------------------------------------------------------------------ */

export const pad2 = (n: number): string => (n < 10 ? `0${n}` : String(n))

export function fmtTokens(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '—'
  if (n >= 1e9) return `${trim(n / 1e9)}B`
  if (n >= 1e6) return `${trim(n / 1e6)}M`
  if (n >= 1e3) return `${trim(n / 1e3)}k`
  return String(Math.round(n))
}

const trim = (v: number): string => (Math.abs(v) >= 100 ? String(Math.round(v)) : String(Math.round(v * 10) / 10))

export const CURRENCY_SYMBOL: Record<string, string> = {
  CNY: '¥',
  USD: '$',
  EUR: '€',
  JPY: '¥',
}

export function currencySymbol(currency: string): string {
  return CURRENCY_SYMBOL[currency] ?? `${currency} `
}

export function fmtMoney(amount: number, currency: string, digits = 2): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return '—'
  const abs = Math.abs(amount)
  const d = abs >= 100 ? 0 : abs >= 1 ? digits : 4
  return `${currencySymbol(currency)}${amount.toFixed(d)}`
}

export function fmtPct(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return '—'
  return `${Math.round(v * 1000) / 10}%`
}

/* ------------------------------------------------------------------ *
 * Small guards
 * ------------------------------------------------------------------ */

export function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

export function pickNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v)
  return undefined
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

export function errorMessage(err: unknown): string {
  const m = (err as { message?: unknown } | null)?.message
  return typeof m === 'string' && m !== '' ? m : String(err)
}
