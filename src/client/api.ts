/**
 * Client-side same-origin fetchers for the host JSON API, with tiny in-memory
 * TTL caches mirroring the host memos (balance 60s, usage 5min). All payload
 * shapes come from `../core/core` so client and host share one contract.
 */
import type { MonitorConfig, OverviewData, PlatformSpend, UsageData } from '../core/core'

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string }

interface Envelope<T> {
  ok?: boolean
  error?: string
  data?: T
}

const OVERVIEW_TTL_MS = 60_000
const USAGE_TTL_MS = 5 * 60_000

const mem = new Map<string, { data: unknown; at: number }>()

async function getJson<T>(path: string): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, { headers: { accept: 'application/json' }, cache: 'no-store' })
    const body = (await res.json()) as Envelope<T>
    if (body.ok === true && body.data !== undefined) return { ok: true, data: body.data }
    return { ok: false, error: typeof body.error === 'string' ? body.error : `HTTP ${res.status}` }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export interface UsageQuery {
  days: number
  provider: string
  model: string
  group: 'day' | 'session'
}

const API_PREFIX = '/plugins/dsh-usage-monitor'

export const usageQueryKey = (q: UsageQuery): string =>
  `${API_PREFIX}/usage?days=${q.days}&provider=${encodeURIComponent(q.provider)}&model=${encodeURIComponent(q.model)}&group=${q.group}`

export async function fetchOverview(force = false): Promise<ApiResult<OverviewData>> {
  const key = 'overview'
  const hit = mem.get(key) as { data: OverviewData; at: number } | undefined
  if (!force && hit !== undefined && Date.now() - hit.at < OVERVIEW_TTL_MS) return { ok: true, data: hit.data }
  const path = `${API_PREFIX}/overview${force ? '?refresh=1' : ''}`
  const res = await getJson<OverviewData>(path)
  if (res.ok) mem.set(key, { data: res.data, at: Date.now() })
  return res
}

/**
 * Overview without the client-side TTL cache, used while the host reports the
 * platform snapshot as still 'loading' — the host answers these cheaply.
 */
export async function fetchOverviewRaw(): Promise<ApiResult<OverviewData>> {
  return getJson<OverviewData>(`${API_PREFIX}/overview`)
}

export async function fetchUsage(query: UsageQuery, force = false): Promise<ApiResult<UsageData>> {
  const key = `usage:${usageQueryKey(query)}`
  const hit = mem.get(key) as { data: UsageData; at: number } | undefined
  if (!force && hit !== undefined && Date.now() - hit.at < USAGE_TTL_MS) return { ok: true, data: hit.data }
  const path = `${usageQueryKey(query)}${force ? '&refresh=1' : ''}`
  const res = await getJson<UsageData>(path)
  if (res.ok) mem.set(key, { data: res.data, at: Date.now() })
  return res
}

/**
 * Force a DeepSeek platform sync (private endpoints). Never cached client-side:
 * the host memo already coalesces, and the user pressed a button to see fresh
 * numbers.
 */
export async function fetchPlatform(force = true): Promise<ApiResult<PlatformSpend>> {
  return getJson<PlatformSpend>(`${API_PREFIX}/platform${force ? '?refresh=1' : ''}`)
}

export async function fetchConfig(force = false): Promise<ApiResult<MonitorConfig>> {
  const key = 'config'
  const hit = mem.get(key) as { data: MonitorConfig; at: number } | undefined
  if (!force && hit !== undefined && Date.now() - hit.at < OVERVIEW_TTL_MS) return { ok: true, data: hit.data }
  const res = await getJson<MonitorConfig>(`${API_PREFIX}/config`)
  if (res.ok) mem.set(key, { data: res.data, at: Date.now() })
  return res
}

export async function updateConfig(patch: Record<string, unknown>): Promise<ApiResult<MonitorConfig>> {
  try {
    const res = await fetch(`${API_PREFIX}/config`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const body = (await res.json()) as Envelope<MonitorConfig>
    if (body.ok === true && body.data !== undefined) {
      mem.set('config', { data: body.data, at: Date.now() })
      mem.delete('overview')
      return { ok: true, data: body.data }
    }
    return { ok: false, error: typeof body.error === 'string' ? body.error : `HTTP ${res.status}` }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function fetchExportCsv(query: UsageQuery): Promise<ApiResult<string>> {
  const path = `${API_PREFIX}/export?days=${query.days}&provider=${encodeURIComponent(query.provider)}&model=${encodeURIComponent(query.model)}&group=${query.group}`
  try {
    const res = await fetch(path, { cache: 'no-store' })
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
    return { ok: true, data: await res.text() }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export const clearApiCache = (): void => {
  mem.clear()
}
