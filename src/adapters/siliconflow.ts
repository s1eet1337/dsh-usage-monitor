import type { AdapterOptions, BalanceOutcome, BalancePayload, ProviderAdapter, RemoteUsageOutcome } from './types.ts'
import { httpRequest, parseJson } from './http.ts'

export const DEFAULT_BASE = 'https://api.siliconflow.cn'

export interface SiliconFlowUserInfoJson {
  balance?: string | number
  totalBalance?: string | number
  data?: { balance?: string | number; totalBalance?: string | number }
}

export function parseSiliconFlowBalance(json: unknown, defaultCurrency = 'CNY'): BalancePayload | null {
  const j = json as SiliconFlowUserInfoJson | null
  if (j === null || typeof j !== 'object') return null
  const raw = firstDefined(j.balance, j.totalBalance, j.data?.balance, j.data?.totalBalance)
  if (raw === undefined) return null
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n)) return null
  const currency = defaultCurrency
  return { currency, amount: n, granted: null, toppedUp: null }
}

const firstDefined = (...values: Array<string | number | undefined>): string | number | undefined =>
  values.find((v) => v !== undefined && v !== null && v !== '')

export function createSiliconFlowAdapter(): ProviderAdapter {
  return {
    id: 'siliconflow',
    async getBalance(apiKey, options = {}): Promise<BalanceOutcome> {
      if (apiKey === '') return { ok: false, code: 'missing-key', message: '未配置 SILICONFLOW_API_KEY' }
      const base = options.baseUrl ?? DEFAULT_BASE
      const currency = base.includes('.com') && !base.includes('.cn') ? 'USD' : 'CNY'
      try {
        const res = await httpRequest({
          url: `${base}/v1/user/info`,
          headers: { authorization: `Bearer ${apiKey}`, ...options.headers },
          timeoutMs: options.timeoutMs,
          retries: options.retries,
        })
        if (!res.ok) {
          const code = res.status === 401 || res.status === 403 ? 'auth' : 'http'
          return { ok: false, code, message: `用户信息接口返回错误（HTTP ${res.status}）` }
        }
        const parsed = parseSiliconFlowBalance(parseJson(res.text), currency)
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
