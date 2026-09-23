import type { AdapterOptions, BalanceOutcome, BalancePayload, ProviderAdapter, RemoteUsageOutcome } from './types.ts'
import { httpRequest, parseJson } from './http.ts'

export const DEFAULT_BASE = 'https://open.bigmodel.cn'

export interface ZhipuBalanceEntry extends Record<string, unknown> { }
export interface ZhipuBalanceJson {
  code?: number
  balance?: ZhipuBalanceEntry[]
  data?: Record<string, unknown>
}

const numericField = (entry: Record<string, unknown>, keys: readonly string[]): number | null => {
  for (const key of keys) {
    const v = entry[key]
    if (v === undefined || v === null) continue
    const n = typeof v === 'number' ? v : Number(v)
    if (Number.isFinite(n)) return n
  }
  return null
}

/**
 * 智谱开放平台 /api/paas/v4/balance 的响应结构随账号类型略有差异：
 * 常见形态是 balance: [{ total, available, used, … }]（单位元），
 * 这里对多种字段名做容错解析（sum 可用余额；缺 available 时用 total）。
 */
export function parseZhipuBalance(json: unknown): BalancePayload | null {
  const j = json as ZhipuBalanceJson | null
  if (j === null || typeof j !== 'object') return null
  const list = Array.isArray(j.balance) ? j.balance : []
  if (list.length > 0) {
    let sum = 0
    let any = false
    for (const entry of list) {
      const currency = typeof entry.currency === 'string' ? (entry.currency as string) : 'CNY'
      void currency
      const available = numericField(entry, ['available_balance', 'availableBalance', 'available'])
      const total = numericField(entry, ['total_balance', 'totalBalance', 'total'])
      const value = available ?? total
      if (value !== null) {
        sum += value
        any = true
      }
    }
    if (any) return { currency: 'CNY', amount: sum, granted: null, toppedUp: null }
  }
  const top = numericField(j as Record<string, unknown>, ['total_balance', 'totalBalance', 'available_balance', 'availableBalance'])
  if (top !== null) return { currency: 'CNY', amount: top, granted: null, toppedUp: null }
  if (j.data !== undefined && typeof j.data === 'object') {
    const inner = numericField(j.data, ['total_balance', 'totalBalance', 'available_balance', 'availableBalance'])
    if (inner !== null) return { currency: 'CNY', amount: inner, granted: null, toppedUp: null }
  }
  return null
}

export function createZhipuAdapter(): ProviderAdapter {
  return {
    id: 'zhipu',
    async getBalance(apiKey, options = {}): Promise<BalanceOutcome> {
      if (apiKey === '') return { ok: false, code: 'missing-key', message: '未配置智谱 API Key' }
      const base = options.baseUrl ?? DEFAULT_BASE
      try {
        const res = await httpRequest({
          url: `${base}/api/paas/v4/balance`,
          headers: { authorization: `Bearer ${apiKey}`, ...options.headers },
          timeoutMs: options.timeoutMs,
          retries: options.retries,
        })
        if (!res.ok) {
          const code = res.status === 401 || res.status === 403 ? 'auth' : 'http'
          return { ok: false, code, message: `余额接口返回错误（HTTP ${res.status}）` }
        }
        const json = parseJson(res.text)
        const parsed = parseZhipuBalance(json)
        if (parsed === null) return { ok: false, code: 'parse', message: '无法解析余额响应（缺 balance 字段）' }
        return { ok: true, data: parsed }
      } catch (err) {
        return { ok: false, code: 'network', message: (err as { message?: string }).message ?? String(err) }
      }
    },
    async getUsage(): Promise<RemoteUsageOutcome> {
      return { ok: true, data: null }
    },
    async validateKey(apiKey, options = {}): Promise<boolean> {
      const outcome = await this.getBalance(apiKey, options)
      return outcome.ok
    },
  }
}
