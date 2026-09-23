/**
 * Offline smoke verification (no network, no browser):
 *   1. host entry exports name/inject/apply and applies against a fake ctx;
 *   2. the client bundle loads through the __ModuleLoader__ protocol, exports
 *      name/inject/apply, and applies against a fake slot context;
 *   3. a few pure-core invariants hold on the built artifacts.
 * Run: `npm run verify` (needs `npm run build` first).
 */
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(join(root, 'package.json'))

const failures = []
const check = (label, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra !== '' ? ` 鈥?${extra}` : ''}`)
  if (!ok) failures.push(label)
}

/* ---------- host ---------- */
const host = await import(pathToFileURL(join(root, 'lib', 'index.js')).href)
check('host exports', host.name === 'dsh-usage-monitor' && Array.isArray(host.inject) && typeof host.apply === 'function')
check('host declares no hard service dependency', host.inject.length === 0, `inject=[${host.inject.join(',')}]`)

let routeHandler = null
const fakeCtx = {
  get(key) {
    if (key === 'webServer' || key === 'httpServer') {
      return {
        register(def) {
          routeHandler = def.handler
          return () => {}
        },
      }
    }
    return undefined
  },
  on() { return () => {} },
  effect(fn) { const r = fn(); return typeof r === 'function' ? r : () => {} },
  config: { storageDir: join(root, '.tmp-smoke-store') },
}
host.apply(fakeCtx, fakeCtx.config)
check('host apply registered route', typeof routeHandler === 'function')

if (routeHandler !== null) {
  const call = async (req) => {
    const status = { code: 0, headers: {}, body: '' }
    const res = {
      writeHead(code, headers) { status.code = code; status.headers = { ...headers } },
      end(chunk) { status.body = String(chunk ?? '') },
    }
    await routeHandler(req, res)
    return status
  }
  const cross = await call({ method: 'GET', url: '/plugins/dsh-usage-monitor/overview', headers: { host: 'evil.example.com', 'sec-fetch-site': 'cross-site' } })
  check('host trust fence rejects foreign host', cross.code === 403, `code=${cross.code}`)

  const local = await call({
    method: 'GET',
    url: '/plugins/dsh-usage-monitor/usage?days=7',
    headers: { host: '127.0.0.1:3080', origin: 'http://127.0.0.1:3080', 'sec-fetch-site': 'same-origin' },
  })
  const parsed = JSON.parse(local.body)
  check('host usage route ok without persistence', parsed.ok === true && parsed.data?.days === 7, `ok=${parsed.ok}`)

  const cfg = await call({ method: 'GET', url: '/plugins/dsh-usage-monitor/config', headers: { host: '127.0.0.1:3080' } })
  const cfgBody = JSON.parse(cfg.body)
  check('host config route ok', cfgBody.ok === true)
  check('config exposes the platform block without a token', cfgBody.data?.deepseekPlatform?.userToken === undefined, `token=${JSON.stringify(cfgBody.data?.deepseekPlatform?.userToken)}`)

  // No token configured in the smoke store: the route must answer without any
  // network call, either with the cold-start placeholder or the real status.
  const plat = await call({ method: 'GET', url: '/plugins/dsh-usage-monitor/platform', headers: { host: '127.0.0.1:3080' } })
  const platBody = JSON.parse(plat.body)
  check(
    'host platform route answers offline',
    platBody.ok === true && ['loading', 'missing-token', 'disabled'].includes(platBody.data?.status),
    `status=${platBody.data?.status}`,
  )

  const overview = await call({ method: 'GET', url: '/plugins/dsh-usage-monitor/overview', headers: { host: '127.0.0.1:3080' } })
  const overviewBody = JSON.parse(overview.body)
  check(
    'overview carries a platform snapshot',
    overviewBody.ok === true && overviewBody.data?.platform !== null && overviewBody.data?.platform !== undefined,
    `platform=${overviewBody.data?.platform?.status}`,
  )
}

/* ---------- client bundle ---------- */
const clientSource = readFileSync(join(root, 'lib', 'client.js'), 'utf8')
let captured = null
const sandbox = {
  window: {},
  // no-op timers keep the smoke process from hanging on background polls
  setInterval: () => 1,
  clearInterval: () => {},
  setTimeout: () => 1,
  clearTimeout: () => {},
  fetch: async () => { throw new Error('no network in verify') },
}
sandbox.window.__ModuleLoader__ = { load: (entry) => { captured = entry } }
vm.createContext(sandbox)
vm.runInContext(clientSource, sandbox)
check('client bundle registers in __ModuleLoader__', captured !== null && captured.id === 'dsh-usage-monitor')
if (captured !== null) {
  const clientModule = captured.factory(require)
  check('client exports', clientModule.name === 'dsh-usage-monitor' && clientModule.inject.includes('slots') && typeof clientModule.apply === 'function')
  const injected = []
  let renderCalls = 0
  clientModule.apply({
    slots: {
      inject(key, cb) { injected.push(key); const disposer = cb(); renderCalls += disposer !== undefined ? 1 : 0; return () => {} },
      register() { return () => {} },
    },
    effect(fn) { const r = fn(); return typeof r === 'function' ? r : () => {} },
  })
  check('client apply injects the three seats', injected.includes('conversation.session.header.utilities') && injected.includes('sidebar.footer.action') && injected.includes('shell.overlay'), injected.join(' | '))
}

/* ---------- pure core on the built artifact ---------- */
const core = await import(pathToFileURL(join(root, 'lib', 'core', 'core.js')).href)
const { evaluateAlert, fmtMoney, rollDaily } = core
const recs = [
  { at: Date.now(), provider: 'deepseek', model: 'deepseek-chat', input: 1000, output: 500, cache: 0, reasoning: 0, sessionId: 's1', sessionTitle: '浼氳瘽涓€', cost: 0.0008 },
  { at: Date.now(), provider: 'deepseek', model: 'deepseek-chat', input: 2000, output: 0, cache: 0, reasoning: 0, sessionId: 's1', sessionTitle: '浼氳瘽涓€', cost: 0.0006 },
]
const daily = rollDaily(recs, 1)
check('rollDaily folds today', daily.length === 1 && daily[0].total === 3500, `total=${daily[0].total}`)
check('evaluateAlert warn', evaluateAlert({ balanceAmount: 4, spendAmount: null, budget: { amount: 100, currency: 'CNY', warnPct: 5 } }).level === 'warn')
check('fmtMoney', fmtMoney(12.345, 'USD') === '$12.35')

console.log(failures.length === 0 ? '\nverify: all checks passed' : `\nverify: ${failures.length} failure(s): ${failures.join(', ')}`)
process.exitCode = failures.length === 0 ? 0 : 1
