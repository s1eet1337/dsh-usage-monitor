import type { AdapterOptions, BalanceOutcome, BalancePayload, ProviderAdapter, RemoteUsageOutcome } from './types.ts'
import { httpRequest, parseJson } from './http.ts'

export const DEFAULT_BASE = 'https://api.openai.com'

export interface OpenAiCreditGrantsJson {
  total_granted?: number
  total_used?: number
  total_available?: number
  hard_limit_usd?: number
  soft_limit_usd?: number
}

/** Pure parser for the legacy credit-grants payload (tests). */
export function parseOpenAiCredits(json: unknown): BalancePayload | null {
  const j = json as OpenAiCreditGrantsJson | null
  if (j === null || typeof j !== 'object') return null
  const granted = num(j.total_granted)
  const used = num(j.total_used)
  const available = num(j.total_available) ?? (granted !== null && used !== null ? granted - used : null)
  if (available === null) return null
  return { currency: 'USD', amount: available, granted, toppedUp: null }
}

const num = (v: number | undefined): number | null => (v === undefined || !Number.isFinite(v) ? null : v)

export function createOpenAiAdapter(): ProviderAdapter {
  return {
    id: 'openai',
    async getBalance(apiKey, options = {}): Promise<BalanceOutcome> {
      if (apiKey === '') return { ok: false, code: 'missing-key', message: '未配置 OPENAI_API_KEY' }
      const base = options.baseUrl ?? DEFAULT_BASE
      try {
        const res = await httpRequest({
          url: `${base}/v1/dashboard/billing/credit_grants`,
          headers: { authorization: `Bearer ${apiKey}`, ...options.headers },
          timeoutMs: options.timeoutMs,
          retries: options.retries,
        })
        if (res.status === 404 || res.status === 403 || res.status === 401) {
          // OpenAI 已停用该查询（新组织基本都拿不到）；对 Key 校验走 /v1/models。
          return { ok: false, code: 'unsupported', message: 'OpenAI 已不再向 API Key 提供 credit_grants 余额查询（HTTP ' + res.status + '）。可配置余额代理地址。' }
        }
        if (!res.ok) return { ok: false, code: 'http', message: `余额接口返回错误（HTTP ${res.status}）` }
        const data = parseOpenAiCredits(parseJson(res.text))
        if (data === null) return { ok: false, code: 'parse', message: '无法解析 credit_grants 响应' }
        return { ok: true, data }
      } catch (err) {
        return { ok: false, code: 'network', message: (err as { message?: string }).message ?? String(err) }
      }
    },
    async getUsage(): Promise<RemoteUsageOutcome> {
      return { ok: true, data: null }
    },
    async validateKey(apiKey, options = {}): Promise<boolean> {
      if (apiKey === '') return false
      const base = options.baseUrl ?? DEFAULT_BASE
      try {
        const res = await httpRequest({
          url: `${base}/v1/models`,
          headers: { authorization: `Bearer ${apiKey}`, ...options.headers },
          timeoutMs: options.timeoutMs,
          retries: options.retries,
        })
        return res.ok
      } catch {
        return false
      }
    },
  }
}
