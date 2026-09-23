/**
 * DeepSeek 平台「实际消费」组装 + 逐月缓存。
 *
 * 数据流：配置文件里的 userToken → platform.deepseek.com 私有接口 → 本模块
 * 汇总成 `PlatformSpend` → 挂到 /overview 供 UI 展示。
 *
 * 缓存策略：**已结束的月份不会再变**，因此逐月结果落盘到
 * `<storageDir>/platform-months.json`；当月每次刷新都重新拉取。首次同步需要
 * 逐月回溯（默认最多 36 个月），之后启动只请求当月和上月。回溯一旦确认走到
 * 账号起点（连续若干月为空），就把起点记进缓存，后续不再向前探测。
 */
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { dayKeyOfMs, isRecord, pad2, pickNumber } from '../core/core.ts'
import type { PlatformDayPoint, PlatformModelRow, PlatformMonthPoint, PlatformSpend, PlatformStatus, PlatformWallet } from '../core/core.ts'
import { fetchMonth, fetchUserSummary, monthPointOf } from '../adapters/deepseek-platform.ts'
import type { PlatformMonth, PlatformRequestOptions } from '../adapters/deepseek-platform.ts'

/** Consecutive empty months that mark the account's beginning. */
const EMPTY_MONTHS_STOP = 3
/** Months fetched in parallel (each costs two HTTP requests). */
const BATCH = 3

export const monthKeyOf = (ms: number): string => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
}

export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-')
  const d = new Date(Number(y), Number(m) - 1 + delta, 1)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
}

export interface PlatformMonthEntry {
  tokens: number
  cost: number
}

/** Atomic JSON store for closed-month totals. */
export class PlatformMonthCache {
  private readonly file: string
  private months: Record<string, PlatformMonthEntry> = {}
  private startMonth: string | null = null
  private queue: Promise<void> = Promise.resolve()

  constructor(private readonly dir: string) {
    this.file = join(dir, 'platform-months.json')
    try {
      if (!existsSync(this.file)) return
      const raw: unknown = JSON.parse(readFileSync(this.file, 'utf8'))
      if (!isRecord(raw)) return
      if (typeof raw.startMonth === 'string' && /^\d{4}-\d{2}$/.test(raw.startMonth)) this.startMonth = raw.startMonth
      if (isRecord(raw.months)) {
        for (const [key, value] of Object.entries(raw.months)) {
          if (!/^\d{4}-\d{2}$/.test(key) || !isRecord(value)) continue
          const tokens = pickNumber(value.tokens)
          const cost = pickNumber(value.cost)
          if (tokens === undefined || cost === undefined) continue
          this.months[key] = { tokens, cost }
        }
      }
    } catch {
      // unreadable cache → start empty (it is only a cache)
    }
  }

  get filePath(): string {
    return this.file
  }

  get(month: string): PlatformMonthEntry | undefined {
    return this.months[month]
  }

  /** Oldest month known to contain data (null when still unknown). */
  get knownStart(): string | null {
    return this.startMonth
  }

  set(month: string, entry: PlatformMonthEntry): void {
    this.months[month] = entry
    this.scheduleSave()
  }

  setStart(month: string): void {
    // Only ever move the start further back; moving it forward would lose data.
    if (this.startMonth !== null && this.startMonth <= month) return
    this.startMonth = month
    this.scheduleSave()
  }

  private scheduleSave(): void {
    this.queue = this.queue.then(async () => {
      try {
        await mkdir(dirname(this.file), { recursive: true })
        const tmp = `${this.file}.tmp`
        const body = JSON.stringify({ version: 1, startMonth: this.startMonth, months: this.months }, null, 2)
        await writeFile(tmp, body, 'utf8')
        await rename(tmp, this.file)
      } catch (err) {
        console.warn('[dsh-usage-monitor] 平台月缓存写入失败:', err instanceof Error ? err.message : String(err))
      }
    })
  }

  flush(): Promise<void> {
    return this.queue
  }
}

/** Drop day buckets later than `todayKey` (the month payload includes them). */
export function trimAfter(days: readonly PlatformDayPoint[], todayKey: string): PlatformDayPoint[] {
  return days.filter((d) => d.date <= todayKey)
}

/** Drop model rows the platform reports with no usage (legacy/retired names). */
export function pruneEmptyModels(rows: readonly PlatformModelRow[]): PlatformModelRow[] {
  return rows.filter((m) => m.cost > 0 || m.total > 0)
}

/** Drop months with no usage, so "N 个月" counts months that actually billed. */
export function pruneEmptyMonths(months: readonly PlatformMonthPoint[]): PlatformMonthPoint[] {
  return months.filter((m) => m.tokens > 0 || m.cost > 0)
}

/** Snapshot used while the first background refresh is still running. */
export function platformPlaceholder(at: number, status: PlatformStatus = 'loading', message: string | null = null): PlatformSpend {
  const spend = baseSpend(at, monthKeyOf(at))
  return { ...spend, status, error: message, lifetime: { ...spend.lifetime } }
}

export interface BuildPlatformArgs {
  enabled: boolean
  token: string | undefined
  historyMonths: number
  cache: PlatformMonthCache
  nowMs?: number
  options?: PlatformRequestOptions
}

function baseSpend(at: number, month: string): PlatformSpend {
  return {
    at,
    status: 'ok',
    error: null,
    currency: 'CNY',
    wallet: null,
    today: { date: dayKeyOfMs(at), tokens: 0, cost: 0 },
    month: { month, tokens: 0, cost: 0 },
    lifetime: { cost: 0, tokens: 0, months: 0, complete: false },
    byModel: [],
    daily: [],
    months: [],
  }
}

export async function buildPlatformSpend(args: BuildPlatformArgs): Promise<PlatformSpend> {
  const nowMs = args.nowMs ?? Date.now()
  const currentKey = monthKeyOf(nowMs)
  const spend = baseSpend(nowMs, currentKey)
  const fail = (status: PlatformStatus, message: string): PlatformSpend => ({ ...spend, status, error: message })

  if (!args.enabled) return fail('disabled', '平台同步已关闭')
  const token = args.token?.trim() ?? ''
  if (token === '') return fail('missing-token', '未配置 DeepSeek 平台 userToken')

  const options = args.options ?? {}
  const cache = args.cache

  // ---- wallet + platform-reported monthly totals ----
  const summary = await fetchUserSummary(token, options)
  if (!summary.ok) return fail(summary.code, summary.message)
  const wallet: PlatformWallet | null = summary.data === null
    ? null
    : { normal: summary.data.normal, bonus: summary.data.bonus, currency: summary.data.currency }
  spend.wallet = wallet
  if (wallet !== null) spend.currency = wallet.currency

  // ---- current + previous month (the trend window) ----
  const prevKey = shiftMonth(currentKey, -1)
  const [current, previous] = await Promise.all([
    fetchMonth(token, currentKey, options),
    fetchMonth(token, prevKey, options),
  ])
  if (!current.ok) return { ...fail(current.code, current.message), wallet }

  const currentMonth: PlatformMonth = current.data
  spend.month = { month: currentKey, tokens: currentMonth.tokens, cost: currentMonth.cost }
  spend.byModel = pruneEmptyModels(currentMonth.byModel)
  const todayKey = dayKeyOfMs(nowMs)
  const todayPoint = currentMonth.days.find((d) => d.date === todayKey)
  spend.today = todayPoint === undefined
    ? { date: todayKey, tokens: 0, cost: 0 }
    : { date: todayKey, tokens: todayPoint.total, cost: todayPoint.cost }

  // The month endpoints return every day of the month — including buckets that
  // are still in the future with zero usage — so trim them or the trend chart
  // trails a flat line past today.
  const daily = [
    ...(previous.ok ? trimAfter(previous.data.days, todayKey) : []),
    ...trimAfter(currentMonth.days, todayKey),
  ]
  daily.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  spend.daily = daily

  // ---- lifetime: walk closed months back until the account start ----
  const pending: string[] = []
  let cursor = prevKey
  for (let i = 0; i < Math.max(0, args.historyMonths - 1); i++) {
    // A known start bounds the walk: nothing earlier than it has data.
    if (cache.knownStart !== null && cursor < cache.knownStart) break
    pending.push(cursor)
    cursor = shiftMonth(cursor, -1)
  }

  const closed = new Map<string, { tokens: number; cost: number }>()
  let emptyStreak = 0
  let stopped = false
  let complete = cache.knownStart !== null

  const note = (month: string, entry: { tokens: number; cost: number }, fetched: boolean): void => {
    closed.set(month, entry)
    if (entry.tokens === 0 && entry.cost === 0) emptyStreak += 1
    else emptyStreak = 0
    if (fetched) cache.set(month, entry)
    if (emptyStreak >= EMPTY_MONTHS_STOP) {
      complete = true
      stopped = true
      cache.setStart(month)
    }
  }

  for (let index = 0; index < pending.length && !stopped; index += BATCH) {
    const batch = pending.slice(index, index + BATCH)
    const results = await Promise.all(batch.map(async (month) => {
      // The previous month was already fetched for the trend window.
      if (month === prevKey && previous.ok) return { month, entry: { tokens: previous.data.tokens, cost: previous.data.cost }, fetched: false, failed: false }
      const cached = cache.get(month)
      if (cached !== undefined) return { month, entry: cached, fetched: false, failed: false }
      const res = await fetchMonth(token, month, options)
      if (!res.ok) return { month, entry: { tokens: 0, cost: 0 }, fetched: false, failed: true }
      return { month, entry: { tokens: res.data.tokens, cost: res.data.cost }, fetched: true, failed: false }
    }))
    for (const r of results) {
      if (r.failed) {
        // A closed month we cannot read: keep what we have, mark the total partial.
        stopped = true
        break
      }
      note(r.month, r.entry, r.fetched)
    }
  }

  const months: PlatformMonthPoint[] = pruneEmptyMonths(
    [
      monthPointOf(currentMonth),
      ...[...closed.entries()].map(([month, entry]) => ({ month, tokens: entry.tokens, cost: entry.cost })),
    ].sort((a, b) => (a.month < b.month ? 1 : a.month > b.month ? -1 : 0)),
  )
  spend.months = months
  spend.lifetime = {
    cost: months.reduce((sum, m) => sum + m.cost, 0),
    tokens: months.reduce((sum, m) => sum + m.tokens, 0),
    months: months.length,
    complete,
  }
  spend.status = 'ok'
  spend.error = null
  return spend
}
