import type { SessionPersistenceLike, SessionEventRecord } from '../context.ts'

/**
 * Read one stored session's events.
 *
 * Harness 0.1.5-rc.2 stores session logs compressed (`session.v3.jsonl.zstd`)
 * and exposes them only through a read handle: `list()` yields snapshots whose
 * id sits on `header.id`, and the events come from `open(id,'read')` →
 * `read(0)`. Older builds returned headers directly from `list()` and offered
 * `readFrom(id, seq)`; both shapes are supported so the scan survives either
 * side of that change (reading as if it were still 0.1.2 silently produced an
 * empty ledger).
 */
async function readSessionEvents(
  persistence: SessionPersistenceLike,
  sid: string,
): Promise<{ events?: SessionEventRecord[]; unsupported: boolean }> {
  if (typeof persistence.open === 'function') {
    const handle = await persistence.open(sid, 'read')
    try {
      const result = await handle.read(0)
      return { events: result?.events, unsupported: false }
    } finally {
      await handle.close?.()
    }
  }
  if (typeof persistence.readFrom === 'function') {
    const result = await persistence.readFrom(sid, 0)
    return { events: result?.events, unsupported: false }
  }
  return { events: undefined, unsupported: true }
}

const isMissingSession = (err: unknown): boolean => {
  const name = (err as { name?: unknown } | null)?.name
  return typeof name === 'string' && name.includes('NotFound')
}
import { errorMessage } from '../core/core.ts'
import type { UsageCoverage, UsageRecord } from '../core/core.ts'
import { estimateCostUsd } from '../core/pricing.ts'
import { canonicalProvider } from '../core/core.ts'
import type { PricingOverride } from '../core/pricing.ts'

export interface ScanResult {
  records: UsageRecord[]
  coverage: UsageCoverage
}

function toCount(v: unknown): number {
  if (v === undefined || v === null) return 0
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) && n >= 0 ? n : Number.NaN
}

/**
 * Fold usage out of the DSH session logs — the harness's own durable record
 * of what every provider/model actually consumed. Attribution:
 *   - `request/header` events carry `data.header.config.{provider,model}` and
 *     apply to every following `assistant/message` event;
 *   - `assistant/message` events carry `data.usage.{inputTokens,…}`;
 *   - `session/title` events name the session (last wins).
 * Records older than the retention window are dropped during the scan so the
 * per-poll work stays bounded.
 */
export async function scanUsage(
  persistence: SessionPersistenceLike | undefined,
  retentionDays: number,
  pricingOverrides: readonly PricingOverride[],
  nowMs = Date.now(),
): Promise<ScanResult> {
  const coverage: UsageCoverage = {
    listedSessions: 0,
    scannedSessions: 0,
    usageRecords: 0,
    skippedRecords: 0,
    failedSessions: 0,
    earliestAt: null,
    latestAt: null,
  }
  if (persistence === undefined) return { records: [], coverage }

  const earliestMs = nowMs - retentionDays * 86_400_000
  const records: UsageRecord[] = []

  let headers: Awaited<ReturnType<SessionPersistenceLike['list']>> = []
  try {
    headers = await persistence.list()
  } catch (err) {
    coverage.failedSessions += 1
    console.warn('[dsh-usage-monitor] 读取会话列表失败:', errorMessage(err))
    return { records, coverage }
  }

  // Current builds nest the id under `header`; older builds exposed it directly.
  const sessionIds = headers
    .map((h) => h.header?.id ?? h.header?.sessionId ?? h.id ?? h.sessionId)
    .filter((sid): sid is string => typeof sid === 'string' && sid !== '')
  coverage.listedSessions = sessionIds.length

  let warnedUnsupported = false

  for (const sid of sessionIds) {
    let events: SessionEventRecord[] | undefined
    try {
      const read = await readSessionEvents(persistence, sid)
      if (read.unsupported) {
        if (!warnedUnsupported) {
          warnedUnsupported = true
          console.warn('[dsh-usage-monitor] sessionPersistence 既没有 open() 也没有 readFrom()：无法读取会话日志，用量统计将为空')
        }
        break
      }
      events = read.events
    } catch (err) {
      if (isMissingSession(err)) continue // artifact removed between list and open
      coverage.failedSessions += 1
      console.warn(`[dsh-usage-monitor] 读取会话日志失败 ${sid}:`, errorMessage(err))
      continue
    }
    coverage.scannedSessions += 1
    if (events === undefined) continue

    let provider = 'unknown'
    let model = 'unknown'
    let title = ''
    for (const ev of events) {
      const type = ev?.type
      if (type === 'session/title') {
        const next = ev.data?.title
        if (typeof next === 'string' && next !== '') title = next
        continue
      }
      if (type === 'request/header') {
        const cfg = ev.data?.header?.config
        if (cfg !== undefined && typeof cfg.provider === 'string' && cfg.provider !== '' && typeof cfg.model === 'string') {
          provider = cfg.provider
          model = cfg.model
        }
        continue
      }
      if (type !== 'assistant/message') continue
      const usage = ev.data?.usage
      if (usage === undefined) continue
      const input = toCount(usage.inputTokens)
      const output = toCount(usage.outputTokens)
      const cache = toCount(usage.cacheReadTokens)
      const reasoning = toCount(usage.reasoningTokens)
      const time = ev.time
      if (typeof time !== 'number' || !Number.isFinite(time)) {
        coverage.skippedRecords += 1
        continue
      }
      if (Number.isNaN(input) || Number.isNaN(output) || Number.isNaN(cache) || Number.isNaN(reasoning)) {
        coverage.skippedRecords += 1
        continue
      }
      if (time < earliestMs || time > nowMs + 5 * 60_000) {
        coverage.skippedRecords += 1
        continue
      }
      if (coverage.earliestAt === null || time < coverage.earliestAt) coverage.earliestAt = time
      if (coverage.latestAt === null || time > coverage.latestAt) coverage.latestAt = time
      // The harness names providers for the runtime ("deepseek-official"); the
      // rest of the plugin (cards, budgets, pricing) speaks registry ids.
      const canonical = canonicalProvider(provider)
      const cost = estimateCostUsd(canonical, model, input, cache, output, pricingOverrides)
      records.push({
        at: time,
        provider: canonical,
        model,
        input,
        output,
        cache,
        reasoning,
        sessionId: sid,
        sessionTitle: title,
        cost,
      })
      coverage.usageRecords += 1
    }
  }
  return { records, coverage }
}
