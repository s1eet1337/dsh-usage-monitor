/**
 * Pure-core unit tests (no network, no DOM). Run against the built artifacts.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const core = await import(pathToFileURL(join(root, 'lib', 'core', 'core.js')).href)
const pricing = await import(pathToFileURL(join(root, 'lib', 'core', 'pricing.js')).href)
const csv = await import(pathToFileURL(join(root, 'lib', 'core', 'csv.js')).href)
const chart = await import(pathToFileURL(join(root, 'lib', 'core', 'chart.js')).href)

const {
  normalizeConfig, evaluateAlert, budgetFor, rollDaily, rollRows, rollSessionRows,
  totalsOf, dayKeyOfMs, dayKeysBackTo, fmtTokens, fmtMoney, currencySymbol, PROVIDERS,
} = core

test('config normalize fills defaults and clamps', () => {
  const c = normalizeConfig({ balances: { deepseek: { budget: -5, warnPct: 500 } }, pollMs: 1 })
  assert.equal(c.balances.deepseek.budget, undefined)
  assert.equal(c.balances.deepseek.warnPct, 100)
  assert.equal(c.pollMs, 5_000)
  assert.equal(c.retentionDays, 90)
  const d = normalizeConfig(null)
  assert.equal(d.webhooks.length, 0)
  assert.equal(d.balances.moonshot.enabled, true)
  assert.equal(PROVIDERS.length, 6)
})

test('alert evaluation with budget and balance', () => {
  const budget = { amount: 100, currency: 'CNY', warnPct: 5 }
  assert.equal(evaluateAlert({ balanceAmount: 60, spendAmount: null, budget }).level, 'ok')
  assert.equal(evaluateAlert({ balanceAmount: 4.9, spendAmount: null, budget }).level, 'warn')
  assert.equal(evaluateAlert({ balanceAmount: 0, spendAmount: null, budget }).level, 'critical')
  // without budget there are no pct alerts
  const noBudget = { amount: null, currency: 'USD', warnPct: 5 }
  assert.equal(evaluateAlert({ balanceAmount: 0.01, spendAmount: null, budget: noBudget }).level, 'ok')
})

test('budgetFor picks provider entry + currency fallback', () => {
  const c = normalizeConfig({ balances: { deepseek: { budget: 50, warnPct: 8 } } })
  const b = budgetFor(c, 'deepseek', 'CNY')
  assert.deepEqual(b, { amount: 50, currency: 'CNY', warnPct: 8 })
  const missing = budgetFor(c, 'siliconflow', 'CNY')
  assert.equal(missing.amount, null)
})

function rec(dayOffsetDays, provider, model, input, output, session) {
  const now = new Date()
  return {
    at: now.getTime() - dayOffsetDays * 86_400_000 + 3_600_000,
    provider, model, input, output, cache: 0, reasoning: 0,
    sessionId: session, sessionTitle: `会话 ${session}`,
    cost: pricing.estimateCostUsd(provider, model, input, 0, output),
  }
}

test('rollDaily covers trailing calendar days with zero fill', () => {
  const records = [rec(0, 'deepseek', 'deepseek-chat', 1000, 500, 's1'), rec(3, 'openai', 'gpt-4o-mini', 200, 300, 's2')]
  const daily = rollDaily(records, 7)
  assert.equal(daily.length, 7)
  assert.equal(daily[6].total, 1500) // today
  assert.equal(daily[3].total, 500)  // 3 days ago
  assert.equal(daily[0].total, 0)    // zero-fill oldest
  assert.notEqual(daily[6].cost, null) // deepseek-chat has a reference price
})

test('pricing estimates only known models', () => {
  assert.equal(pricing.estimateCostUsd('deepseek', 'deepseek-chat', 1_000_000, 0, 0), 0.27)
  assert.equal(pricing.estimateCostUsd('zhipu', 'glm-4', 1_000_000, 0, 0), null)
  const over = pricing.estimateCostUsd('zhipu', 'glm-4', 1_000_000, 0, 1_000_000, [{ provider: 'zhipu', model: 'glm-4', priceIn: 1, priceOut: 2 }])
  assert.equal(over, 3)
})

test('rollRows groups date/provider/model and counts sessions', () => {
  const records = [
    rec(0, 'deepseek', 'deepseek-chat', 100, 50, 's1'),
    rec(0, 'deepseek', 'deepseek-chat', 300, 0, 's1'),
    rec(0, 'deepseek', 'deepseek-chat', 10, 10, 's2'),
    rec(1, 'openai', 'gpt-4o-mini', 500, 0, 's3'),
  ]
  const rows = rollRows(records, 7)
  assert.equal(rows.length, 2)
  const ds = rows.find((r) => r.provider === 'deepseek')
  assert.ok(ds)
  assert.equal(ds.total, 470)
  assert.equal(ds.sessions, 2)
  const ss = rollSessionRows(records, 7)
  assert.equal(ss.length, 3)
  const s1 = ss.find((r) => r.sessionId === 's1')
  const s2 = ss.find((r) => r.sessionId === 's2')
  assert.equal(s1?.total, 450)
  assert.equal(s2?.total, 20)
  assert.equal(s1?.title, '会话 s1')
})

test('day helpers', () => {
  const now = new Date(2026, 0, 15, 12)
  const keys = dayKeysBackTo(now, 3)
  assert.deepEqual(keys, ['2026-01-13', '2026-01-14', '2026-01-15'])
  assert.equal(dayKeyOfMs(new Date(2026, 0, 15, 12).getTime()), '2026-01-15')
})

test('formatting helpers', () => {
  assert.equal(fmtTokens(0), '0')
  assert.equal(fmtTokens(1234), '1.2k')
  assert.equal(fmtTokens(2_500_000), '2.5M')
  assert.equal(fmtMoney(12.345, 'USD'), '$12.35')
  assert.equal(fmtMoney(0.000123, 'USD'), '$0.0001')
  assert.equal(currencySymbol('CNY'), '¥')
  assert.equal(currencySymbol('XBT'), 'XBT ')
})

test('csv writer quotes and adds BOM', () => {
  const out = csv.toCsv(
    [{ date: '2026-01-01', note: 'a,"b"', nl: 'x\ny' }],
    [{ key: 'date', label: '日期' }, { key: 'note', label: '备注' }, { key: 'nl', label: '换行' }],
  )
  assert.ok(out.startsWith('\uFEFF日期,备注,换行'))
  assert.ok(out.includes('"a,""b"""'))
  assert.ok(out.includes('"x\ny"'))
})

test('chart geometry basics', () => {
  const geo = chart.buildLineGeometry([0, 10, 20], 200, 100, 20)
  assert.equal(geo.max, 20)
  assert.ok(geo.points.startsWith('20.'))
  assert.equal(geo.yOf(20), 20) // top
  assert.equal(geo.yOf(0), 80)  // baseline (height - pad)
  assert.deepEqual(chart.yTicks(0), [0])
  const area = chart.buildAreaPath(geo.points, geo.zeroY)
  assert.ok(area.startsWith('M '))
})

test('totalsOf accumulates records', () => {
  const records = [rec(0, 'deepseek', 'deepseek-chat', 1000, 500, 's1'), rec(0, 'deepseek', 'deepseek-chat', 2000, 0, 's1')]
  const t = totalsOf(records)
  assert.equal(t.total, 3500)
  assert.equal(t.calls, 2)
})

test('canonicalProvider maps runtime ids onto the registry ids', () => {
  assert.equal(core.canonicalProvider('deepseek-official'), 'deepseek')
  assert.equal(core.canonicalProvider('deepseek'), 'deepseek')
  assert.equal(core.canonicalProvider('openai-official'), 'openai')
  assert.equal(core.canonicalProvider('anthropic-relay'), 'anthropic')
  assert.equal(core.canonicalProvider('zhipu_glm'), 'zhipu')
  // Unknown providers (local models, future ones) must pass through untouched.
  assert.equal(core.canonicalProvider('llama-cpp-qwen3-14b'), 'llama-cpp-qwen3-14b')
  assert.equal(core.canonicalProvider('deepseeklike'), 'deepseeklike')
})

test('pricing resolves runtime provider ids for both the table and overrides', () => {
  // Table row is keyed 'deepseek'; the harness reports 'deepseek-official'.
  const fromTable = pricing.estimateCostUsd('deepseek-official', 'deepseek-chat', 1_000_000, 0, 0)
  assert.equal(typeof fromTable, 'number')
  assert.ok(Math.abs(fromTable - 0.27) < 1e-9, `table rate not applied: ${fromTable}`)
  // An override written with either id must match the other.
  const overrides = [{ provider: 'deepseek', model: 'deepseek-v4', priceIn: 2, priceOut: 4 }]
  const viaOverride = pricing.estimateCostUsd('deepseek-official', 'deepseek-v4-flash', 1_000_000, 0, 1_000_000, overrides)
  assert.equal(viaOverride, 6)
  // Unknown models still resolve to no estimate rather than a wrong one.
  assert.equal(pricing.estimateCostUsd('deepseek-official', 'mystery-model', 1000, 0, 0), null)
})

test('current DeepSeek models carry a rate (flash + pro)', () => {
  // 1M cache-miss input + 1M output at the flash midpoint:
  // 0.225 (input) + 0.9 (output)
  const flash = pricing.estimateCostUsd('deepseek-official', 'deepseek-v4-flash', 1_000_000, 0, 1_000_000)
  assert.ok(Math.abs(flash - 1.125) < 1e-9, `flash rate wrong: ${flash}`)
  const flashNewName = pricing.estimateCostUsd('deepseek', 'deepseek-flash', 1_000_000, 0, 0)
  assert.ok(Math.abs(flashNewName - 0.225) < 1e-9, `deepseek-flash rate wrong: ${flashNewName}`)
  const pro = pricing.estimateCostUsd('deepseek', 'deepseek-v4-pro', 1_000_000, 0, 1_000_000)
  assert.ok(Math.abs(pro - 3.96) < 1e-9, `pro rate wrong: ${pro}`)
  // Cache-hit tokens must bill at the cheap cache rate, not the input rate.
  const cached = pricing.estimateCostUsd('deepseek', 'deepseek-v4-flash', 0, 1_000_000, 0)
  assert.ok(Math.abs(cached - 0.0045) < 1e-9, `cache rate wrong: ${cached}`)
})


test('normalizeUserToken tolerates pasted JSON wrappers and fragments', () => {
  const token = 'vzGp/rBCo+nOYTgz4k7NzXEFIvGadI0gUQJR8OXZkgUtE4q3twMp2Kjv3iKgauhl'
  assert.equal(core.normalizeUserToken(token), token)
  assert.equal(core.normalizeUserToken(`  ${token}  `), token)
  assert.equal(core.normalizeUserToken(`{"value":"${token}","__version":"0"}`), token)
  assert.equal(core.normalizeUserToken(`${token}","__version":"0"}`), token)
  assert.equal(core.normalizeUserToken(`Bearer ${token}`), token)
  assert.equal(core.normalizeUserToken(''), '')

  // …and it must run as part of config normalization, so a value that was
  // already saved dirty gets cleaned the next time the config is read.
  const wrapped = { deepseekPlatform: { userToken: `{"value":"${token}","__version":"0"}` } }
  assert.equal(core.normalizeConfig(wrapped).deepseekPlatform.userToken, token)
  const fragment = { deepseekPlatform: { userToken: `${token}","__version":"0"}` } }
  assert.equal(core.normalizeConfig(fragment).deepseekPlatform.userToken, token)
  assert.equal(core.normalizeConfig({ deepseekPlatform: { userToken: '   ' } }).deepseekPlatform.userToken, undefined)
})

