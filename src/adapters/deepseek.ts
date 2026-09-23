import type { AdapterOptions, BalanceOutcome, BalancePayload, ProviderAdapter, RemoteUsageOutcome } from './types.ts'
import { httpRequest, parseJson } from './http.ts'
import type { ProviderId } from '../core/core.ts'

export const DEFAULT_BASE = 'https://api.deepseek.com'

export interface DeepSeekBalanceEntry {
  currency?: string
  total_balance?: string | number
  granted_balance?: string | number
  topped_up_balance?: string | number
}

export interface DeepSeekBalanceJson {
  is_available?: boolean
  balance_infos?: DeepSeekBalanceEntry[]
}

/** Pure parser, exported for tests. Returns null when nothing usable is present. */
export function parseDeepSeekBalance(json: unknown): BalancePayload | null {
  const j = json as DeepSeekBalanceJson | null
  if (j === null || typeof j !== 'object') return null
  const list = Array.isArray(j.balance_infos) ? j.balance_infos : []
  if (list.length === 0) return null
  const pick = list.find((b) => b?.currency === 'CNY') ?? list[0]
  if (pick === undefined) return null
  const amount = toNum(pick.total_balance)
  if (amount === null) return null
  return {
    currency: pick.currency ?? 'CNY',
    amount,
    granted: toNum(pick.granted_balance),
    toppedUp: toNum(pick.topped_up_balance),
  }
}

const toNum = (v: string | number | undefined): number | null => {
  if (v === undefined || v === null) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

export function createDeepSeekAdapter(): ProviderAdapter {
  return {
    id: 'deepseek',
    async getBalance(apiKey, options = {}): Promise<BalanceOutcome> {
      if (apiKey === '') return { ok: false, code: 'missing-key', message: '未配置 DEEPSEEK_API_KEY' }
      const base = options.baseUrl ?? DEFAULT_BASE
      try {
        const res = await httpRequest({
          url: `${base}/user/balance`,
          headers: { authorization: `Bearer ${apiKey}`, ...options.headers },
          timeoutMs: options.timeoutMs,
          retries: options.retries,
        })
        if (!res.ok) {
          const code = res.status === 401 || res.status === 403 ? 'auth' : 'http'
          return { ok: false, code, message: `余额接口返回错误（HTTP ${res.status}）` }
        }
        const data = parseDeepSeekBalance(parseJson(res.text))
        if (data === null) return { ok: false, code: 'parse', message: '无法解析余额响应（缺 balance_infos）' }
        return { ok: true, data }
      } catch (err) {
        return { ok: false, code: 'network', message: (err as { message?: string }).message ?? String(err) }
      }
    },
    async getUsage(): Promise<RemoteUsageOutcome> {
      // 官方 API 不开放用量查询（平台用量需 userToken，属另一安全边界）。
      return { ok: true, data: null }
    },
    async validateKey(apiKey, options = {}): Promise<boolean> {
      const outcome = await this.getBalance(apiKey, options)
      return outcome.ok
    },
  }
}

export const deepseekMeta: { id: ProviderId; label: string } = { id: 'deepseek', label: 'DeepSeek' }
