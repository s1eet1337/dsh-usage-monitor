/**
 * Usage-scan tests.
 *
 * Harness 0.1.5-rc.2 stores session logs compressed and exposes them through a
 * snapshot listing plus a read handle. Reading them the old way (listing as
 * headers + `readFrom`) silently produced an empty ledger, so both shapes are
 * pinned here.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const { scanUsage } = await import(pathToFileURL(join(root, 'lib', 'services', 'usage.js')).href)

const NOW = Date.UTC(2026, 8, 20, 12, 0, 0)
const EVENTS = [
  { type: 'session/title', time: NOW - 3000, data: { title: '会话一' } },
  { type: 'request/header', time: NOW - 2000, data: { header: { config: { provider: 'deepseek', model: 'deepseek-chat' } } } },
  { type: 'assistant/message', time: NOW - 1000, data: { usage: { inputTokens: 1000, outputTokens: 500, cacheReadTokens: 200, reasoningTokens: 0 } } },
  { type: 'assistant/message', time: NOW - 400, data: { usage: { inputTokens: 2000, outputTokens: 0, cacheReadTokens: 0, reasoningTokens: 0 } } },
]

test('current shape: snapshot listing + open/read handle', async () => {
  let opened = 0
  let closed = 0
  const persistence = {
    async list() { return [{ header: { id: 's1' }, revision: 'r', sizeBytes: 10 }] },
    async open(id, access) {
      assert.equal(id, 's1')
      assert.equal(access, 'read')
      opened += 1
      return {
        header: { id },
        async read(offset) { assert.equal(offset, 0); return { events: EVENTS } },
        async close() { closed += 1 },
      }
    },
  }
  const { records, coverage } = await scanUsage(persistence, 90, [], NOW)
  assert.equal(coverage.listedSessions, 1)
  assert.equal(coverage.scannedSessions, 1)
  assert.equal(coverage.usageRecords, 2)
  assert.equal(records.length, 2)
  assert.equal(records[0].provider, 'deepseek')
  assert.equal(records[0].model, 'deepseek-chat')
  assert.equal(records[0].sessionTitle, '会话一')
  assert.equal(records[0].input, 1000)
  assert.equal(records[0].cache, 200)
  assert.equal(typeof records[0].cost, 'number')
  assert.equal(opened, 1)
  assert.equal(closed, 1, 'the read handle must always be closed')
})

test('legacy shape: header listing + readFrom still works', async () => {
  let readFroms = 0
  const persistence = {
    async list() { return [{ id: 's1' }] },
    async readFrom(id, fromSeq) { readFroms += 1; return { events: EVENTS } },
  }
  const { records, coverage } = await scanUsage(persistence, 90, [], NOW)
  assert.equal(readFroms, 1)
  assert.equal(coverage.listedSessions, 1)
  assert.equal(records.length, 2)
  assert.equal(coverage.usageRecords, 2)
})

test('a persistence with no reader degrades to an empty ledger without throwing', async () => {
  const persistence = { async list() { return [{ header: { id: 's1' } }] } }
  const { records, coverage } = await scanUsage(persistence, 90, [], NOW)
  assert.equal(records.length, 0)
  assert.equal(coverage.listedSessions, 1)
  assert.equal(coverage.scannedSessions, 0)
})

test('a missing artifact is skipped, a real failure is counted', async () => {
  const persistence = {
    async list() { return [{ header: { id: 'gone' } }, { header: { id: 'boom' } }, { header: { id: 'ok' } }] },
    async open(id) {
      if (id === 'gone') {
        const err = new Error('not found')
        err.name = 'SessionPersistenceNotFoundError'
        throw err
      }
      if (id === 'boom') throw new Error('disk on fire')
      return { async read() { return { events: [EVENTS[3]] } }, async close() {} }
    },
  }
  const { records, coverage } = await scanUsage(persistence, 90, [], NOW)
  assert.equal(records.length, 1)
  assert.equal(coverage.failedSessions, 1, 'only the genuine failure counts')
})

test('retention window drops events older than the window', async () => {
  const old = [{ type: 'assistant/message', time: NOW - 200 * 86_400_000, data: { usage: { inputTokens: 5, outputTokens: 5, cacheReadTokens: 0, reasoningTokens: 0 } } }]
  const persistence = {
    async list() { return [{ header: { id: 's1' } }] },
    async open() { return { async read() { return { events: old } }, async close() {} } },
  }
  const { records, coverage } = await scanUsage(persistence, 90, [], NOW)
  assert.equal(records.length, 0)
  assert.equal(coverage.skippedRecords, 1)
})

test('missing persistence (service absent) returns empty coverage', async () => {
  const { records, coverage } = await scanUsage(undefined, 90, [], NOW)
  assert.deepEqual(records, [])
  assert.equal(coverage.listedSessions, 0)
})

test('the ledger stores the canonical provider id and prices it', async () => {
  const runtimeEvents = [
    { type: 'request/header', time: NOW - 2000, data: { header: { config: { provider: 'deepseek-official', model: 'deepseek-chat' } } } },
    { type: 'assistant/message', time: NOW - 1000, data: { usage: { inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0, reasoningTokens: 0 } } },
  ]
  const persistence = {
    async list() { return [{ header: { id: 's1' } }] },
    async open() { return { async read() { return { events: runtimeEvents } }, async close() {} } },
  }
  const { records, coverage } = await scanUsage(persistence, 90, [], NOW)
  assert.equal(coverage.usageRecords, 1)
  assert.equal(records[0].provider, 'deepseek', 'runtime id must be folded onto the registry id')
  assert.equal(typeof records[0].cost, 'number', 'a priced model must produce a cost')
})

