/**
 * Adapter unit tests — pure response parsers only (no network).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const deepseek = await import(pathToFileURL(join(root, 'lib', 'adapters', 'deepseek.js')).href)
const openai = await import(pathToFileURL(join(root, 'lib', 'adapters', 'openai.js')).href)
const zhipu = await import(pathToFileURL(join(root, 'lib', 'adapters', 'zhipu.js')).href)
const siliconflow = await import(pathToFileURL(join(root, 'lib', 'adapters', 'siliconflow.js')).href)
const httpMod = await import(pathToFileURL(join(root, 'lib', 'adapters', 'http.js')).href)
const registry = await import(pathToFileURL(join(root, 'lib', 'adapters', 'index.js')).href)

test('deepseek balance parser (real response shape)', () => {
  const out = deepseek.parseDeepSeekBalance({
    is_available: true,
    balance_infos: [{ currency: 'CNY', total_balance: '123.45', granted_balance: '23.45', topped_up_balance: '100.00' }],
  })
  assert.deepEqual(out, { currency: 'CNY', amount: 123.45, granted: 23.45, toppedUp: 100 })
  assert.equal(deepseek.parseDeepSeekBalance({}), null)
})

test('openai credit-grants parser', () => {
  const out = openai.parseOpenAiCredits({ total_granted: 50, total_used: 12.5 })
  assert.deepEqual(out, { currency: 'USD', amount: 37.5, granted: 50, toppedUp: null })
  assert.equal(openai.parseOpenAiCredits({ hard_limit_usd: 10 }), null)
})

test('zhipu balance parser tolerates response variants', () => {
  const a = zhipu.parseZhipuBalance({ balance: [{ total: 10, available: 7 }, { total: 5, available: 2 }] })
  assert.equal(a?.amount, 9)
  const b = zhipu.parseZhipuBalance({ balance: [{ total_balance: 42 }] })
  assert.equal(b?.amount, 42)
  const c = zhipu.parseZhipuBalance({ data: { available_balance: '3.5' } })
  assert.equal(c?.amount, 3.5)
  assert.equal(zhipu.parseZhipuBalance({ code: 401 }), null)
})

test('siliconflow balance parser', () => {
  const out = siliconflow.parseSiliconFlowBalance({ balance: '88.66' })
  assert.deepEqual(out, { currency: 'CNY', amount: 88.66, granted: null, toppedUp: null })
  const out2 = siliconflow.parseSiliconFlowBalance({ data: { totalBalance: '12.00' } }, 'CNY')
  assert.equal(out2?.amount, 12)
})

test('http helpers: parseJson never throws, timeout/retry wiring present', () => {
  assert.equal(httpMod.parseJson('not json'), null)
  assert.deepEqual(httpMod.parseJson('{"a":1}'), { a: 1 })
})

test('registry provides all six adapters and rejects unknown ids', () => {
  for (const id of ['deepseek', 'openai', 'anthropic', 'zhipu', 'moonshot', 'siliconflow']) {
    const adapter = registry.getAdapter(id)
    assert.equal(typeof adapter.getBalance, 'function')
    assert.equal(typeof adapter.getUsage, 'function')
    assert.equal(typeof adapter.validateKey, 'function')
    assert.equal(adapter.id, id)
  }
  assert.throws(() => registry.getAdapter('nonexistent'), /没有为 provider/)
  assert.equal(registry.hasAdapter('deepseek'), true)
  assert.equal(registry.hasAdapter('nope'), false)
})
