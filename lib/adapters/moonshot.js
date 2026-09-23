import { httpRequest } from "./http.js";
export const DEFAULT_BASE = 'https://api.moonshot.cn';
export const KIMI_CODING_USAGE_URL = 'https://api.kimi.com/coding/v1/usages';
export function createMoonshotAdapter() {
    return {
        id: 'moonshot',
        async getBalance(_apiKey, options = {}) {
            const base = options.baseUrl ?? DEFAULT_BASE;
            void base;
            // Moonshot 开放平台暂未提供对 API Key 稳定的余额查询接口（官方文档只写
            // 控制台查看；Kimi 订阅类用量接口属于 kimi-coding 独立凭据，不在 API Key 边界内）。
            return {
                ok: false,
                code: 'unsupported',
                message: 'Moonshot/Kimi API Key 暂无公开余额查询接口；可配置自定义余额端点。',
            };
        },
        async getUsage() {
            return { ok: true, data: null };
        },
        async validateKey(apiKey, options = {}) {
            if (apiKey === '')
                return false;
            const base = options.baseUrl ?? DEFAULT_BASE;
            try {
                const res = await httpRequest({
                    url: `${base}/v1/models`,
                    headers: { authorization: `Bearer ${apiKey}`, ...options.headers },
                    timeoutMs: options.timeoutMs,
                    retries: options.retries,
                });
                return res.ok;
            }
            catch {
                return false;
            }
        },
    };
}
/**
 * Kimi Coding 订阅用量（独立于普通 API Key）——为 kimi-coding provider 预留。
 * 需要 KIMI_CODING_API_KEY 类订阅凭据；普通 MOONSHOT_API_KEY 用不到它。
 */
export async function fetchKimiCodingUsage(apiKey, options = {}) {
    try {
        const res = await httpRequest({
            url: options.baseUrl ?? KIMI_CODING_USAGE_URL,
            headers: { authorization: `Bearer ${apiKey}`, ...options.headers },
            timeoutMs: options.timeoutMs,
            retries: options.retries,
        });
        if (!res.ok)
            return { ok: false, code: res.status === 401 || res.status === 403 ? 'auth' : 'http', message: `用量接口返回错误（HTTP ${res.status}）` };
        return { ok: true, data: { amount: null, currency: null, input: null, output: null, total: null } };
    }
    catch (err) {
        return { ok: false, code: 'network', message: err.message ?? String(err) };
    }
}
