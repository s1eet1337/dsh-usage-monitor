/**
 * Host integration smoke tests: apply() against a fake Cordis ctx, then drive
 * the registered route handler with fake req/res (no real network; no
 * sessionPersistence). Config persistence uses a scratch dir under os.tmpdir.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const { apply } = await import(pathToFileURL(join(root, 'lib', 'index.js')).href)

let storageDir = ''
let handler = null

function boot(storage) {
  storageDir = storage
  handler = null
  const fakeCtx = {
    get(key) {
      if (key === 'webServer' || key === 'httpServer') {
        return {
          register(def) {
            handler = def.handler
            return () => {}
          },
        }
      }
      return undefined
    },
    on() { return () => {} },
    effect(fn) { const r = fn(); return typeof r === 'function' ? r : () => {} },
  }
  apply(fakeCtx, { storageDir: storage })
}

function call(req) {
  return new Promise((resolve) => {
    const out = { code: 0, headers: {}, body: '' }
    const res = {
      writeHead(code, headers) { out.code = code; out.headers = { ...headers } },
      end(chunk) { out.body = String(chunk ?? ''); resolve(out) },
    }
    void handler(req, res).catch(() => resolve(out))
  })
}

const localHeaders = { host: '127.0.0.1:3080', origin: 'http://127.0.0.1:3080', 'sec-fetch-site': 'same-origin' }
const json = (out) => JSON.parse(out.body)

test('route wiring: method + auth guards', async () => {
  boot(mkdtempSync(join(tmpdir(), 'dsh-usage-monitor-test-')))
  // scratch dir left for OS cleanup so a pending initial config save is not raced

  const foreign = await call({ method: 'GET', url: '/plugins/dsh-usage-monitor/overview', headers: { host: 'bad.example', 'sec-fetch-site': 'cross-site' } })
  assert.equal(foreign.code, 403)

  const badMethod = await call({ method: 'DELETE', url: '/plugins/dsh-usage-monitor/overview', headers: localHeaders })
  assert.equal(badMethod.code, 405)

  const missing = await call({ method: 'GET', url: '/plugins/dsh-usage-monitor/nope', headers: localHeaders })
  assert.equal(missing.code, 404)
})

test('usage endpoint without persistence returns empty ok payloads', async () => {
  boot(mkdtempSync(join(tmpdir(), 'dsh-usage-monitor-test-')))

  const day = await call({ method: 'GET', url: '/plugins/dsh-usage-monitor/usage?days=7', headers: localHeaders })
  assert.equal(day.code, 200)
  const body = json(day)
  assert.equal(body.ok, true)
  assert.equal(body.data.days, 7)
  assert.equal(body.data.daily.length, 7)
  assert.deepEqual(body.data.rows, [])
  assert.equal(body.data.group, 'day')

  const session = await call({ method: 'GET', url: '/plugins/dsh-usage-monitor/usage?days=30&group=session&provider=deepseek', headers: localHeaders })
  const sbody = json(session)
  assert.equal(sbody.data.group, 'session')
  assert.equal(sbody.data.provider, 'deepseek')

  const csvRes = await call({ method: 'GET', url: '/plugins/dsh-usage-monitor/export?days=7', headers: localHeaders })
  assert.equal(csvRes.code, 200)
  assert.match(csvRes.headers['content-disposition'], /attachment/)
  assert.ok(csvRes.body.startsWith('\uFEFF'))
})

test('config persistence writes to disk and keeps secrets on round-trip', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-usage-monitor-test-'))
  t.after(() => { rmSync(dir, { recursive: true, force: true }) })
  boot(dir)

  const postBody = JSON.stringify({
    balances: { deepseek: { budget: 100, warnPct: 5 } },
    webhooks: [{ url: 'https://example.com/hook', secret: 's3cret', enabled: true }],
  })
  const req = {
    method: 'POST',
    url: '/plugins/dsh-usage-monitor/config',
    headers: localHeaders,
    on(ev, cb) {
      if (ev === 'data') { const buf = Buffer.from(postBody); cb(buf) }
      if (ev === 'end') cb()
    },
  }
  const saved = await call(req)
  assert.equal(saved.code, 200)
  const savedBody = json(saved)
  assert.equal(savedBody.ok, true)
  assert.equal(savedBody.data.webhooks[0].secret, '') // redacted to the browser

  const file = join(dir, 'config.json')
  assert.ok(existsSync(file))
  const onDisk = JSON.parse(readFileSync(file, 'utf8'))
  assert.equal(onDisk.webhooks[0].secret, 's3cret')
  assert.equal(onDisk.balances.deepseek.budget, 100)

  // Browser round-trip without touching the secret keeps it stored.
  const roundBody = JSON.stringify({
    balances: { deepseek: { budget: 200, warnPct: 5 } },
    webhooks: [{ url: 'https://example.com/hook', secret: '', enabled: true }],
  })
  const req2 = {
    method: 'POST',
    url: '/plugins/dsh-usage-monitor/config',
    headers: localHeaders,
    on(ev, cb) {
      if (ev === 'data') { const buf = Buffer.from(roundBody); cb(buf) }
      if (ev === 'end') cb()
    },
  }
  const round = await call(req2)
  assert.equal(json(round).ok, true)
  const onDisk2 = JSON.parse(readFileSync(file, 'utf8'))
  assert.equal(onDisk2.webhooks[0].secret, 's3cret')
  assert.equal(onDisk2.balances.deepseek.budget, 200)

  const getCfg = await call({ method: 'GET', url: '/plugins/dsh-usage-monitor/config', headers: localHeaders })
  assert.equal(json(getCfg).data.balances.deepseek.budget, 200)
})

test('package.json declares a loadable bundle + client contract', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  // dsh.bundle drives bundle-layer resolution in the profile.
  assert.equal(pkg.dsh?.bundle?.patch, './cordis.patch.yml')
  // client-modules REQUIRES a string platform whenever dsh.client is present,
  // and only serves the bundle when it is exactly 'web': an empty object throws
  // during composition and takes the whole client module graph down with it.
  assert.equal(pkg.dsh?.client?.platform, 'web')
  assert.ok(Array.isArray(pkg.dsh.client.inject), 'dsh.client.inject must be an array when present')
  for (const entry of pkg.dsh.client.inject) assert.equal(typeof entry, 'string')
  // The host half and the prebuilt browser bundle must both ship: the packaged
  // desktop shell runs compiled JavaScript and never compiles TypeScript plugins.
  assert.equal(typeof pkg.main, 'string')
  assert.equal(pkg.exports['./client'], './lib/client.js')
  assert.ok(existsSync(join(root, 'lib', 'client.js')), 'lib/client.js must be committed')
})


/* ------------------------------------------------------------------ *
 * Late webServer mounting — the regression that silently killed the API.
 * The harness publishes webServer *after* this row applies, and cordis
 * filters `internal/service` by the emitting context, so a listener
 * registered without { global: true } is dropped and the routes never mount.
 * ------------------------------------------------------------------ */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function lateBoot() {
  const state = { server: null, handler: null, listener: null, options: null, injected: [], teardown: [] }
  const ctx = {
    get(key) {
      if (key === 'webServer' || key === 'httpServer') return state.server ?? undefined
      return undefined
    },
    on(name, fn, options) {
      if (name === 'internal/service') { state.listener = fn; state.options = options }
      return () => {}
    },
    inject(deps, callback) { state.injected.push({ deps, callback }); return () => {} },
    effect(fn) { const r = fn(); if (typeof r === 'function') state.teardown.push(r); return () => {} },
  }
  apply(ctx, { storageDir: mkdtempSync(join(tmpdir(), 'dsh-usage-monitor-late-')) })
  return state
}

const serveLate = (state) => {
  state.server = { register(def) { state.handler = def.handler; return () => {} } }
}

test('internal/service listener is registered global (cordis drops scoped ones)', () => {
  const state = lateBoot()
  assert.equal(typeof state.listener, 'function', 'internal/service listener must be registered')
  assert.equal(state.options?.global, true, 'listener must be global or cordis filters it away')
  for (const fn of state.teardown) fn()
})

test('a webServer published after apply still mounts the routes', () => {
  const state = lateBoot()
  serveLate(state)
  state.listener('webServer')
  assert.equal(typeof state.handler, 'function', 'late webServer must mount the routes')
  for (const fn of state.teardown) fn()
})

test('the late-mount dispatcher tolerates a different argument shape', () => {
  const state = lateBoot()
  serveLate(state)
  state.listener({}, 'webServer') // name carried in a later argument
  assert.equal(typeof state.handler, 'function', 'name in args[1] must also mount the routes')
  for (const fn of state.teardown) fn()
})

test('ctx.inject declares webServer so cordis notifies this fiber', () => {
  const state = lateBoot()
  const declared = state.injected.find((entry) => entry.deps.includes('webServer'))
  assert.ok(declared !== undefined, 'webServer must be declared through ctx.inject')
  serveLate(state)
  declared.callback()
  assert.equal(typeof state.handler, 'function', 'the injected callback must mount the routes')
  for (const fn of state.teardown) fn()
})

test('the bounded retry mounts even without any service notification', async () => {
  const state = lateBoot()
  serveLate(state) // no event is ever dispatched
  await sleep(700)
  assert.equal(typeof state.handler, 'function', 'retry window must mount the routes')
  for (const fn of state.teardown) fn()
})

