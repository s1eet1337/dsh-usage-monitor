import type { AdapterOptions, BalanceOutcome, ProviderAdapter, RemoteUsageOutcome } from './types.ts'
import { httpRequest } from './http.ts'

export const DEFAULT_BASE = 'https://api.anthropic.com'
export const ANTHROPIC_VERSION = '2023-06-01'

const commonHeaders = (apiKey: string, extra?: Record<string, string>) => ({
  'x-api-key': apiKey,
  'anthropic-version': extra?.['anthropic-version'] ?? ANTHROPIC_VERSION,
  ...extra,
})

export function createAnthropicAdapter(): ProviderAdapter {
  return {
    id: 'anthropic',
    async getBalance(_apiKey, options = {}): Promise<BalanceOutcome> {
      const base = options.baseUrl ?? DEFAULT_BASE
      // 没有面向 API Key 的公开余额接口；组织级用量 API 需要独立 Admin Key 且
      // 属于另一个安全边界。除非用户配置了自定义余额端点，否则明确标注不可用。
      void base
      return {
        ok: false,
        code: 'unsupported',
        message: 'Anthropic 未向 API Key 开放余额查询（组织 Admin API 需独立权限）。',
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
          headers: commonHeaders(apiKey, options.headers),
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
