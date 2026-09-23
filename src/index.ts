/**
 * dsh-usage-monitor host plugin.
 *
 * Registers the package's own fenced JSON API under `/api/dsh-usage-monitor`
 * (overview / usage / config / export), consumed by the client half through
 * same-origin fetch. Balance and usage scans are memoized (60s / 5min) so tab
 * switches and widget polling never hammer provider APIs or replay every
 * session log; `?refresh=1` bypasses the memo. A `session/event` listener
 * busts the caches whenever the harness appends new traffic, and an alert
 * router fires configured webhooks when a provider balance drops into
 * `warn`/`critical` territory.
 */
import { DAY_OPTIONS, isRecord, normalizeConfig } from './core/core.ts'
import type { MonitorConfig, OverviewData, PlatformSpend, UsageData } from './core/core.ts'
import type { HostContext, RouteRequest, RouteResponse, SessionPersistenceLike, CredentialsLike, AgentDefaultModelLike, WebServerLike } from './context.ts'
import { memoize } from './host/memo.ts'
import { isTrustedApiRequest, readJsonBody, writeJson, writeText } from './host/wire.ts'
import { ConfigStore, defaultStorageDir } from './services/config-store.ts'
import { scanUsage } from './services/usage.ts'
import type { ScanResult } from './services/usage.ts'
import { buildOverview, buildUsage } from './services/monitor.ts'
import type { BuildUsageParams } from './services/monitor.ts'
import { PlatformMonthCache, buildPlatformSpend, platformPlaceholder } from './services/platform.ts'
import { AlertNotifier } from './services/alerts.ts'
import { toCsv } from './core/csv.ts'

/** Plugin identity for the cordis.patch.yml row (and the client bundle id). */
export const name = 'dsh-usage-monitor'

/**
 * NO hard service dependency.
 *
 * Declaring `inject: ['webServer']` makes the loader defer apply() until that
 * exact service name exists; on a harness that names or defers it differently
 * the row would silently never load, with no diagnostic at all. Instead this
 * row always applies, mounts its API the moment a web server appears (see
 * `mountRoutes`), and reports what the running harness actually provides
 * through the contract check below. Every other service was already read
 * lazily per call.
 */
export const inject: string[] = []

/** Services this plugin can use, most important first (never hard-required). */
const CONTRACT_SERVICES = ['webServer', 'httpServer', 'credentials', 'sessionPersistence', 'agentDefaultModel'] as const

const BALANCE_TTL_MS = 60_000
const USAGE_TTL_MS = 5 * 60_000
const PLATFORM_TTL_MS = 5 * 60_000
// Route prefix under `/plugins/<name>` (not `/api/...`): the desktop web
// server reserves `/api/*` for its own controllers and shadows third-party
// prefixes registered there; working ecosystem plugins (dsh-agent-teams)
// mount plugin APIs under `/plugins/<name>/...`.
const API_PREFIX = '/plugins/dsh-usage-monitor'

export function apply(ctx: HostContext, rawConfig?: unknown): void {
  console.error('[dsh-usage-monitor] apply called')
  const rowConfig = isRecord(rawConfig) ? rawConfig : {}

  // Services are read LAZILY (per call / per event) instead of captured once at
  // apply time: bundle rows often apply before sibling service rows mount, and
  // a one-time ctx.get() snapshot would stay undefined forever. The webServer
  // routes are mounted the moment the service appears (immediate attempt +
  // `internal/service` late-mount), which is what makes the JSON API exist.
  const readWeb = (): WebServerLike | undefined => (ctx.get('webServer') ?? ctx.get('httpServer')) as WebServerLike | undefined
  const readCredentials = (): CredentialsLike | undefined => ctx.get('credentials') as CredentialsLike | undefined
  const readPersistence = (): SessionPersistenceLike | undefined => ctx.get('sessionPersistence') as SessionPersistenceLike | undefined
  const readAgentDefaultModel = (): AgentDefaultModelLike | undefined => ctx.get('agentDefaultModel') as AgentDefaultModelLike | undefined

  // ---- contract self-check ------------------------------------------------
  // Turns "the panel is mysteriously empty" into one explicit log line naming
  // which services this harness exposes. Nothing here is required to function.
  const readService = (key: string): unknown => {
    try {
      return ctx.get(key)
    } catch {
      return undefined
    }
  }
  const contractLine = (reason: string): string => {
    const present: string[] = []
    const missing: string[] = []
    for (const key of CONTRACT_SERVICES) (readService(key) === undefined ? missing : present).push(key)
    return `[dsh-usage-monitor] contract check (${reason}) present=[${present.join(' ')}] missing=[${missing.join(' ')}]`
  }
  const warnIfNoWeb = (): void => {
    if (readService('webServer') !== undefined || readService('httpServer') !== undefined) return
    console.error(
      '[dsh-usage-monitor] webServer/httpServer 均未出现：本地 JSON API 无法挂载，面板会显示「尚未加载到数据」。' +
        '若该 harness 使用了别的服务名，请把这行 contract check 日志反馈回来以适配。',
    )
  }
  console.error(contractLine('apply'))
  warnIfNoWeb()

  const storageDirOverride = typeof rowConfig.storageDir === 'string' ? rowConfig.storageDir : undefined
  const storageDir = defaultStorageDir(storageDirOverride)
  const store = new ConfigStore(storageDir, rowConfig)
  const platformCache = new PlatformMonthCache(storageDir)
  const notifier = new AlertNotifier(() => store.get())

  const scan = (): Promise<ScanResult> => {
    const cfg = store.get()
    return scanUsage(readPersistence(), cfg.retentionDays, cfg.pricing, Date.now())
  }

  const usageMemo = memoize<ScanResult>(USAGE_TTL_MS, scan)
  const usageGet = (force: boolean): Promise<ScanResult> => (force ? usageMemo.refresh() : usageMemo.get())

  // DeepSeek 平台实际消费：独立 memo + 非阻塞快照。首次取数在后台进行，
  // /overview 立刻返回 'loading' 占位，浏览器下一次轮询就能看到真实数据。
  const platformMemo = memoize<PlatformSpend>(PLATFORM_TTL_MS, () => {
    const cfg = store.get()
    return buildPlatformSpend({
      enabled: cfg.deepseekPlatform.enabled !== false,
      token: cfg.deepseekPlatform.userToken,
      historyMonths: cfg.deepseekPlatform.historyMonths ?? 36,
      cache: platformCache,
      nowMs: Date.now(),
    })
  })
  let platformSnapshot: PlatformSpend | null = null
  const platformGet = (force: boolean): Promise<PlatformSpend> => {
    const settle = (value: PlatformSpend): PlatformSpend => {
      platformSnapshot = value
      return value
    }
    if (force) return platformMemo.refresh().then(settle)
    const hit = platformMemo.peek()
    if (hit !== undefined && Date.now() - hit.setAt < PLATFORM_TTL_MS) return Promise.resolve(settle(hit.value))
    // Stale: kick the refresh and answer with what we already have.
    platformMemo.get().then(settle, () => {})
    return Promise.resolve(platformSnapshot ?? platformPlaceholder(Date.now()))
  }

  // The overview memo never bakes in platform data: the route attaches the
  // current platform snapshot per request, so a first-run backfill (or a token
  // error) shows up on the next poll without re-querying provider balances.
  const overviewMemo = memoize<OverviewData>(BALANCE_TTL_MS, () =>
    buildOverview(
      store.get(),
      { credentials: readCredentials(), agentDefaultModel: readAgentDefaultModel() },
      () => usageMemo.get(),
      Date.now(),
    ),
  )
  const overviewGet = async (force: boolean): Promise<OverviewData> => {
    const payload = force ? await overviewMemo.refresh() : await overviewMemo.get()
    try {
      notifier.process(payload.providers)
    } catch {
      // alert routing must never break the overview response
    }
    return payload
  }

  // Bust caches when the harness appends durable traffic.
  const disposeEvents = ctx.on('session/event', (...args: never[]) => {
    const event = args[1] as { type?: string } | undefined
    const type = event?.type
    if (type === 'request/header' || type === 'assistant/message' || type === 'session/title') {
      usageMemo.clear()
      overviewMemo.clear()
    }
  })
  if (typeof disposeEvents === 'function') ctx.effect(disposeEvents, 'dsh-usage-monitor: cache bust')

  // ---- web routes: mount when the web server service exists (idempotent) ----
  let routesMounted = false
  let skipLogged = false
  const mountRoutes = (): void => {
    if (routesMounted) return
    const web = readWeb()
    if (web === undefined) {
      if (!skipLogged) {
        skipLogged = true
        console.error('[dsh-usage-monitor] mount skipped: webServer not ready yet — waiting for the service')
      }
      return
    }
    routesMounted = true
    console.error('[dsh-usage-monitor] mounting routes at ' + API_PREFIX)
    // We mount late in boot: drop snapshots computed before the other services
    // existed, otherwise the panel can show "缺 API Key"/空统计 for a full TTL.
    usageMemo.clear()
    overviewMemo.clear()
    ctx.effect(
      () =>
        web.register({
          kind: 'prefix',
          path: API_PREFIX,
          handler: async (req, res) => {
            if (!isTrustedApiRequest(req)) {
              writeJson(res, 403, { ok: false, error: 'forbidden' })
              return
            }
            if (req.method !== 'GET' && req.method !== 'POST') {
              writeJson(res, 405, { ok: false, error: 'method not allowed' })
              return
            }
            try {
              await route(store, usageGet, overviewGet, platformGet, () => {
                overviewMemo.clear()
                platformMemo.clear()
              }, req, res)
            } catch (err) {
              writeJson(res, 200, { ok: false, error: err instanceof Error ? err.message : String(err) }, { 'cache-control': 'no-store' })
            }
          },
        }),
      'dsh-usage-monitor: /api routes',
    )
  }
  mountRoutes()

  // Late-mount, three independent layers — getting this wrong makes the whole
  // JSON API silently vanish (learned the hard way):
  //   1. the `internal/service` event, registered `global`; cordis filters a
  //      dispatch by the emitting context (Context.filter), so a scoped
  //      listener for this event is dropped without any error,
  //   2. a tolerant argument scan, in case the dispatch shape changes,
  //   3. a short bounded retry, for a host that publishes the service without
  //      any notification we can observe.
  const serviceNameOf = (args: readonly unknown[]): string => {
    for (const arg of args) if (typeof arg === 'string' && arg !== '') return arg
    return ''
  }
  const onServiceReady = (name: string): void => {
    if (name === 'webServer' || name === 'httpServer') {
      console.error('[dsh-usage-monitor] service ready: ' + name)
      mountRoutes()
      console.error(contractLine('after ' + name))
      return
    }
    if (name === 'credentials' || name === 'sessionPersistence' || name === 'agentDefaultModel') {
      // A row mounted after our warm-up: drop snapshots taken before it existed,
      // otherwise the panel can show "缺 API Key"/空统计 for a whole TTL.
      usageMemo.clear()
      overviewMemo.clear()
      console.error(`[dsh-usage-monitor] service ready: ${name} — caches cleared`)
    }
  }
  const disposeServiceWait = ctx.on(
    'internal/service',
    (...args: never[]) => onServiceReady(serviceNameOf(args as unknown[])),
    { global: true },
  )
  if (typeof disposeServiceWait === 'function') ctx.effect(disposeServiceWait, 'dsh-usage-monitor: late route mount')

  let mountAttempts = 0
  let mountTimer: ReturnType<typeof setTimeout> | undefined
  const retryMount = (): void => {
    if (routesMounted || mountAttempts >= 40) return
    mountAttempts += 1
    mountTimer = setTimeout(() => {
      mountRoutes()
      retryMount()
    }, 250)
  }
  retryMount()
  ctx.effect(
    () => () => {
      if (mountTimer !== undefined) clearTimeout(mountTimer)
    },
    'dsh-usage-monitor: mount retry window',
  )

  // Layer 4: cordis' own dependency wait. `ctx.inject` compiles to
  // `ctx.plugin({ inject })`, so the child fiber DECLARES webServer and cordis
  // notifies it the moment the service appears — a plain `internal/service`
  // listener is not enough, because that notification only refreshes fibers
  // whose `inject` names the service.
  if (typeof ctx.inject === 'function' && readService('webServer') === undefined) {
    try {
      ctx.inject(['webServer'], () => {
        console.error('[dsh-usage-monitor] ctx.inject: webServer available')
        mountRoutes()
      })
    } catch (err) {
      console.warn('[dsh-usage-monitor] ctx.inject(webServer) 失败:', err instanceof Error ? err.message : String(err))
    }
  }
  if (typeof ctx.inject === 'function' && readService('credentials') === undefined) {
    try {
      ctx.inject(['credentials'], () => {
        usageMemo.clear()
        overviewMemo.clear()
        console.error('[dsh-usage-monitor] ctx.inject: credentials available — caches cleared')
      })
    } catch {
      // optional dependency: a host without it keeps the env-var fallback
    }
  }

  // Warm the caches at boot (never awaited / surfaced).
  void overviewGet(false).catch(() => {})
}

async function route(
  store: ConfigStore,
  usageGet: (force: boolean) => Promise<ScanResult>,
  overviewGet: (force: boolean) => Promise<OverviewData>,
  platformGet: (force: boolean) => Promise<PlatformSpend>,
  clearCaches: () => void,
  req: RouteRequest,
  res: RouteResponse,
): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://dsh.internal')
  const pathname = url.pathname
  const force = url.searchParams.get('refresh') === '1'
  const cfg = store.get()

  if (pathname === `${API_PREFIX}/overview`) {
    if (req.method !== 'GET') return methodNotAllowed(res)
    const [data, platform] = await Promise.all([overviewGet(force), platformGet(force)])
    writeJson(res, 200, { ok: true, data: { ...data, platform } }, { 'cache-control': 'no-store' })
    return
  }

  if (pathname === `${API_PREFIX}/usage`) {
    if (req.method !== 'GET') return methodNotAllowed(res)
    const params = usageParams(cfg, url.searchParams)
    const data = await buildUsage(() => usageGet(force), params, Date.now())
    writeJson(res, 200, { ok: true, data }, { 'cache-control': `private, max-age=${USAGE_TTL_MS / 1000}` })
    return
  }

  if (pathname === `${API_PREFIX}/export`) {
    if (req.method !== 'GET') return methodNotAllowed(res)
    const params = usageParams(cfg, url.searchParams)
    const data = await buildUsage(() => usageGet(force), params, Date.now())
    const csv = exportCsv(params.group, data)
    const stamp = new Date().toISOString().slice(0, 10)
    writeText(res, 200, csv, 'text/csv; charset=utf-8', {
      'content-disposition': `attachment; filename="dsh-usage-monitor-${params.group}-${stamp}.csv"`,
      'cache-control': 'no-store',
    })
    return
  }

  if (pathname === `${API_PREFIX}/platform`) {
    if (req.method !== 'GET') return methodNotAllowed(res)
    const platform = await platformGet(force)
    writeJson(res, 200, { ok: true, data: platform }, { 'cache-control': 'no-store' })
    return
  }

  if (pathname === `${API_PREFIX}/config`) {
    if (req.method === 'GET') {
      writeJson(res, 200, { ok: true, data: redactConfig(cfg) }, { 'cache-control': 'no-store' })
      return
    }
    if (req.method === 'POST') {
      const body = await readJsonBody(req)
      if (!isRecord(body)) {
        writeJson(res, 400, { ok: false, error: 'body 必须是 JSON 对象' }, { 'cache-control': 'no-store' })
        return
      }
      const next = store.update(normalizeConfig(body))
      await store.flush()
      writeJson(res, 200, { ok: true, data: redactConfig(next) }, { 'cache-control': 'no-store' })
      clearCaches()
      return
    }
    methodNotAllowed(res)
    return
  }

  writeJson(res, 404, { ok: false, error: 'not found' }, { 'cache-control': 'no-store' })
}

function usageParams(cfg: MonitorConfig, search: URLSearchParams): BuildUsageParams {
  const raw = Number(search.get('days'))
  const days = Number.isFinite(raw) && (DAY_OPTIONS as readonly number[]).includes(Math.round(raw)) ? Math.round(raw) : 30
  return {
    days,
    provider: search.get('provider') ?? '',
    model: search.get('model') ?? '',
    group: search.get('group') === 'session' ? 'session' : 'day',
  }
}

function exportCsv(group: 'day' | 'session', data: UsageData): string {
  const pairs: ReadonlyArray<readonly [string, string]> =
    group === 'session'
      ? [
          ['date', '日期'],
          ['title', '会话'],
          ['sessionId', '会话ID'],
          ['provider', 'Provider'],
          ['model', '模型'],
          ['input', '输入Token'],
          ['output', '输出Token'],
          ['cache', '缓存Token'],
          ['total', '总Token'],
          ['cost', '花费(USD估算)'],
          ['calls', '调用次数'],
        ]
      : [
          ['date', '日期'],
          ['provider', 'Provider'],
          ['model', '模型'],
          ['input', '输入Token'],
          ['output', '输出Token'],
          ['cache', '缓存Token'],
          ['total', '总Token'],
          ['cost', '花费(USD估算)'],
          ['calls', '调用次数'],
          ['sessions', '会话数'],
        ]
  const columns = pairs.map(([key, label]) => ({ key, label }))
  const rows = group === 'session' ? data.sessionRows : data.rows
  return toCsv(rows as unknown as Array<Record<string, unknown>>, columns)
}

function methodNotAllowed(res: RouteResponse): void {
  writeJson(res, 405, { ok: false, error: 'method not allowed' }, { 'cache-control': 'no-store' })
}

/** Never ship webhook secrets or the platform token to the browser. */
function redactConfig(config: MonitorConfig): MonitorConfig {
  return {
    ...config,
    webhooks: config.webhooks.map((w) => ({
      ...w,
      secret: w.secret !== undefined && w.secret !== '' ? '' : undefined,
    })),
    deepseekPlatform: {
      ...config.deepseekPlatform,
      userToken: config.deepseekPlatform.userToken !== undefined && config.deepseekPlatform.userToken !== '' ? '' : undefined,
    },
  }
}
