/**
 * DeepSeek 平台适配器 / 服务的离线单测：只喂真实形状的响应，不联网。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const adapter = await import(pathToFileURL(join(root, 'lib', 'adapters', 'deepseek-platform.js')).href)
const service = await import(pathToFileURL(join(root, 'lib', 'services', 'platform.js')).href)

const usageBody = {
  code: 0,
  data: {
    biz_code: 0,
    biz_data: {
      days: [
        {
          date: '2025-10-01',
          data: [
            {
              model: 'deepseek-chat',
              usage: [
                { type: 'PROMPT_CACHE_HIT_TOKEN', amount: '100' },
                { type: 'PROMPT_CACHE_MISS_TOKEN', amount: '50' },
                { type: 'RESPONSE_TOKEN', amount: '20' },
              ],
            },
            {
              model: 'deepseek-reasoner',
              usage: [
                { type: 'PROMPT_TOKEN', amount: '30' },
                { type: 'RESPONSE_TOKEN', amount: '10' },
              ],
            },
          ],
        },
        { date: '2025-10-02', data: [{ model: 'deepseek-chat', usage: [{ type: 'RESPONSE_TOKEN', amount: '5' }] }] },
      ],
    },
  },
}

test('unwrapEnvelope: success, nested biz container, array container, auth codes', () => {
  assert.deepEqual(adapter.unwrapEnvelope({ code: 0, data: { biz_code: 0, biz_data: { a: 1 } } }), { ok: true, data: { a: 1 } })
  assert.deepEqual(adapter.unwrapEnvelope({ code: 0, data: [{ biz_code: 0, biz_data: { b: 2 } }] }), { ok: true, data: { b: 2 } })
  assert.deepEqual(adapter.unwrapEnvelope({ code: 0, data: { biz_code: 0, biz_data: [1, 2] } }), { ok: true, data: [1, 2] })

  const top = adapter.unwrapEnvelope({ code: 40003, msg: 'token expired' })
  assert.equal(top.ok, false)
  assert.equal(top.code, 'auth')

  const nested = adapter.unwrapEnvelope({ code: 0, data: { biz_code: 40002, biz_msg: 'bad token' } })
  assert.equal(nested.ok, false)
  assert.equal(nested.code, 'auth')

  const other = adapter.unwrapEnvelope({ code: 500, msg: 'boom' })
  assert.equal(other.ok, false)
  assert.equal(other.code, 'parse')

  assert.equal(adapter.unwrapEnvelope(null).ok, false)
  assert.equal(adapter.unwrapEnvelope('nope').ok, false)
})

test('parseUserSummary reads wallets + monthly totals (string amounts)', () => {
  const out = adapter.parseUserSummary({
    normal_wallets: [{ currency: 'CNY', balance: '12.50' }],
    bonus_wallets: [{ currency: 'CNY', balance: '3.25' }],
    monthly_token_usage: '123456',
    monthly_costs: [{ currency: 'CNY', amount: '9.99' }],
  })
  assert.deepEqual(out, { currency: 'CNY', normal: 12.5, bonus: 3.25, monthlyTokenUsage: 123456, monthlyCost: 9.99 })
  assert.equal(adapter.parseUserSummary({}), null)
})

test('parseUsageAmountDays: token types, cache split, multi-day', () => {
  const days = adapter.parseUsageAmountDays(adapter.unwrapEnvelope(usageBody).data)
  assert.equal(days.size, 2)
  const day1 = days.get('2025-10-01')
  assert.deepEqual(day1.get('deepseek-chat'), { input: 150, output: 20, cacheHit: 100, cacheMiss: 50 })
  assert.deepEqual(day1.get('deepseek-reasoner'), { input: 30, output: 10, cacheHit: 0, cacheMiss: 0 })
  assert.equal(days.get('2025-10-02').get('deepseek-chat').output, 5)
  assert.equal(adapter.parseUsageAmountDays({ nonsense: true }), null)
})

test('parseUsageCostDays tolerates an array container and missing model', () => {
  const payload = {
    code: 0,
    data: [{ biz_code: 0, biz_data: { days: [{ date: '2025-10-01', data: [{ usage: [{ amount: '1.5' }] }] }] } }],
  }
  const days = adapter.parseUsageCostDays(adapter.unwrapEnvelope(payload).data)
  assert.equal(days.get('2025-10-01').get(''), 1.5)
})

test('mergeMonth spreads unattributed cost by token share and ranks models', () => {
  const payload = {
    code: 0,
    data: { biz_code: 0, biz_data: { days: [{ date: '2025-10-01', data: [{ usage: [{ amount: '1.5' }] }] }] } },
  }
  const usage = adapter.parseUsageAmountDays(adapter.unwrapEnvelope(usageBody).data)
  const cost = adapter.parseUsageCostDays(adapter.unwrapEnvelope(payload).data)
  const month = adapter.mergeMonth('2025-10', usage, cost)

  assert.equal(month.month, '2025-10')
  assert.equal(month.days.length, 2)
  // 1.5 CNY is only reported for 2025-10-01 and is split by that day's tokens.
  assert.ok(Math.abs(month.days[0].cost - 1.5) < 1e-9)
  assert.equal(month.days[1].cost, 0)
  assert.equal(month.tokens, 215)
  assert.ok(Math.abs(month.cost - 1.5) < 1e-9)

  const chat = month.byModel.find((m) => m.model === 'deepseek-chat')
  const reasoner = month.byModel.find((m) => m.model === 'deepseek-reasoner')
  assert.equal(chat.total, 175)
  assert.equal(reasoner.total, 40)
  assert.ok(Math.abs((chat.cost + reasoner.cost) - 1.5) < 1e-9)
  assert.ok(chat.cost > reasoner.cost)
  assert.ok(Math.abs(chat.share + reasoner.share - 1) < 1e-9)
  assert.equal(month.byModel[0].model, 'deepseek-chat')
})

test('mergeMonth prefers a model-tagged cost row over the proportional split', () => {
  const cost = new Map([['2025-10-01', new Map([['deepseek-chat', 2], ['', 1]])]])
  const usage = new Map([['2025-10-01', new Map([['deepseek-chat', { input: 150, output: 20, cacheHit: 100, cacheMiss: 50 }]])]])
  const month = adapter.mergeMonth('2025-10', usage, cost)
  assert.ok(Math.abs(month.cost - 3) < 1e-9)
  assert.ok(Math.abs(month.byModel[0].cost - 3) < 1e-9)
  assert.equal(month.byModel[0].share, 1)
})

test('monthParam + month helpers', () => {
  assert.deepEqual(adapter.monthParam('2025-07'), { month: 7, year: 2025 })
  assert.equal(service.monthKeyOf(Date.UTC(2025, 0, 15)), '2025-01')
  assert.equal(service.shiftMonth('2025-01', -1), '2024-12')
  assert.equal(service.shiftMonth('2025-12', 1), '2026-01')
  assert.equal(service.shiftMonth('2025-06', -12), '2024-06')
})

test('PlatformMonthCache round-trips closed months and the known start', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'um-platform-'))
  const cache = new service.PlatformMonthCache(dir)
  assert.equal(cache.get('2025-08'), undefined)
  cache.set('2025-08', { tokens: 100, cost: 1.25 })
  cache.setStart('2025-08')
  await cache.flush()
  assert.ok(existsSync(join(dir, 'platform-months.json')))

  const reopened = new service.PlatformMonthCache(dir)
  assert.deepEqual(reopened.get('2025-08'), { tokens: 100, cost: 1.25 })
  assert.equal(reopened.knownStart, '2025-08')
  assert.equal(reopened.get('2025-07'), undefined)

  // A corrupt cache degrades to empty instead of throwing.
  const bad = mkdtempSync(join(tmpdir(), 'um-platform-bad-'))
  await import('node:fs').then((fs) => fs.writeFileSync(join(bad, 'platform-months.json'), '{ not json'))
  assert.equal(new service.PlatformMonthCache(bad).knownStart, null)
})

test('buildPlatformSpend short-circuits without touching the network', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'um-platform-state-'))
  const cache = new service.PlatformMonthCache(dir)

  const disabled = await service.buildPlatformSpend({ enabled: false, token: 'x', historyMonths: 12, cache })
  assert.equal(disabled.status, 'disabled')
  assert.equal(disabled.lifetime.cost, 0)

  const missing = await service.buildPlatformSpend({ enabled: true, token: '   ', historyMonths: 12, cache })
  assert.equal(missing.status, 'missing-token')
  assert.equal(missing.error !== null && missing.error !== '', true)
  assert.equal(missing.months.length, 0)
})

test('platformPlaceholder carries a loading status and the current month', () => {
  const at = Date.UTC(2025, 9, 5)
  const placeholder = service.platformPlaceholder(at)
  assert.equal(placeholder.status, 'loading')
  assert.equal(placeholder.error, null)
  assert.equal(placeholder.month.month, service.monthKeyOf(at))
  assert.equal(placeholder.lifetime.complete, false)
})

test('the cache file is written atomically and stays JSON-clean', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'um-platform-file-'))
  const cache = new service.PlatformMonthCache(dir)
  cache.set('2025-09', { tokens: 7, cost: 0.07 })
  await cache.flush()
  const raw = JSON.parse(readFileSync(join(dir, 'platform-months.json'), 'utf8'))
  assert.equal(raw.version, 1)
  assert.deepEqual(raw.months['2025-09'], { tokens: 7, cost: 0.07 })
})

test('platform shaping helpers drop future days, empty models and empty months', () => {
  const days = [
    { date: '2026-09-19', input: 10, cacheHit: 5, cacheMiss: 5, output: 1, total: 11, cost: 1 },
    { date: '2026-09-20', input: 20, cacheHit: 10, cacheMiss: 10, output: 2, total: 22, cost: 2 },
    { date: '2026-09-21', input: 0, cacheHit: 0, cacheMiss: 0, output: 0, total: 0, cost: 0 },
    { date: '2026-09-30', input: 0, cacheHit: 0, cacheMiss: 0, output: 0, total: 0, cost: 0 },
  ]
  const trimmed = service.trimAfter(days, '2026-09-20')
  assert.deepEqual(trimmed.map((d) => d.date), ['2026-09-19', '2026-09-20'], 'future buckets are dropped')

  const models = [
    { model: 'deepseek-v4-flash', input: 100, output: 5, cache: 90, total: 105, cost: 1, share: 1 },
    { model: 'deepseek-v4.1-flash-expires-on-0910', input: 0, output: 0, cache: 0, total: 0, cost: 0, share: 0 },
  ]
  assert.deepEqual(service.pruneEmptyModels(models).map((m) => m.model), ['deepseek-v4-flash'])

  const months = [
    { month: '2026-09', tokens: 100, cost: 1 },
    { month: '2026-07', tokens: 0, cost: 0 },
    { month: '2026-03', tokens: 0, cost: 0 },
  ]
  assert.deepEqual(service.pruneEmptyMonths(months).map((m) => m.month), ['2026-09'])
})

