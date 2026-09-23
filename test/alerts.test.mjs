/**
 * Alert-router tests: transition-only firing, per-hook cooldown, HMAC header.
 * `AlertNotifier` takes an injected clock, and `fetch` is stubbed here so no
 * network is touched.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const { AlertNotifier } = await import(pathToFileURL(join(root, 'lib', 'services', 'alerts.js')).href)

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

const view = (provider, level) => ({
  provider,
  label: provider,
  keyConfigured: true,
  status: 'ok',
  error: null,
  balance: { supported: true, currency: 'CNY', amount: 1, granted: null, toppedUp: null, reason: null },
  budget: { amount: 100, currency: 'CNY', warnPct: 5 },
  remainingPct: 0.01,
  alert: level,
  today: null,
  refreshedAt: 0,
})

async function withStubbedFetch(run) {
  const calls = []
  const original = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init })
    return { ok: true, status: 200 }
  }
  try {
    await run(calls)
  } finally {
    globalThis.fetch = original
  }
}

test('fires only on level transitions, honouring the hook cooldown', async () => {
  let now = 1_000_000
  const config = { webhooks: [{ url: 'https://hook/a', enabled: true, cooldownMs: 60_000 }] }
  const notifier = new AlertNotifier(() => config, () => now)

  await withStubbedFetch(async (calls) => {
    notifier.process([view('deepseek', 'warn')])
    await settle()
    assert.equal(calls.length, 1, 'entering warn fires once')

    notifier.process([view('deepseek', 'warn')])
    await settle()
    assert.equal(calls.length, 1, 'staying in warn must not re-fire')

    now += 30_000
    notifier.process([view('deepseek', 'ok')])
    notifier.process([view('deepseek', 'warn')])
    await settle()
    assert.equal(calls.length, 1, 'inside the cooldown a re-entry stays quiet')

    now += 60_000
    notifier.process([view('deepseek', 'ok')])
    notifier.process([view('deepseek', 'warn')])
    await settle()
    assert.equal(calls.length, 2, 'after the cooldown it fires again')
  })
})

test('each webhook keeps its own cooldown', async () => {
  let now = 5_000_000
  const config = {
    webhooks: [
      { url: 'https://hook/fast', enabled: true, cooldownMs: 1_000 },
      { url: 'https://hook/slow', enabled: true, cooldownMs: 3_600_000 },
    ],
  }
  const notifier = new AlertNotifier(() => config, () => now)

  await withStubbedFetch(async (calls) => {
    notifier.process([view('deepseek', 'warn')])
    await settle()
    assert.equal(calls.length, 2, 'both hooks fire on the first transition')

    now += 2_000
    notifier.process([view('deepseek', 'ok')])
    notifier.process([view('deepseek', 'warn')])
    await settle()
    assert.equal(calls.length, 3, 'only the fast hook is past its cooldown')
    assert.equal(calls[2].url, 'https://hook/fast')
  })
})

test('a webhook secret adds the HMAC signature header, disabled hooks stay silent', async () => {
  const now = 9_000_000
  const config = {
    webhooks: [
      { url: 'https://hook/signed', enabled: true, secret: 's3cret' },
      { url: 'https://hook/off', enabled: false },
    ],
  }
  const notifier = new AlertNotifier(() => config, () => now)
  await withStubbedFetch(async (calls) => {
    notifier.process([view('deepseek', 'critical')])
    await settle()
    assert.equal(calls.length, 1, 'only the enabled hook is dispatched')
    assert.match(calls[0].init.headers['x-dsh-usage-monitor-signature'], /^sha256=[0-9a-f]{64}$/)
    const body = JSON.parse(calls[0].init.body)
    assert.equal(body.event, 'balance-low')
    assert.equal(body.level, 'critical')
  })
})
