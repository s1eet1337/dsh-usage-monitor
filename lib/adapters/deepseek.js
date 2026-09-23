import { httpRequest, parseJson } from "./http.js";
export const DEFAULT_BASE = 'https://api.deepseek.com';
/** Pure parser, exported for tests. Returns null when nothing usable is present. */
export function parseDeepSeekBalance(json) {
    const j = json;
    if (j === null || typeof j !== 'object')
        return null;
    const list = Array.isArray(j.balance_infos) ? j.balance_infos : [];
    if (list.length === 0)
        return null;
    const pick = list.find((b) => b?.currency === 'CNY') ?? list[0];
    if (pick === undefined)
        return null;
    const amount = toNum(pick.total_balance);
    if (amount === null)
        return null;
    return {
        currency: pick.currency ?? 'CNY',
        amount,
        granted: toNum(pick.granted_balance),
        toppedUp: toNum(pick.topped_up_balance),
    };
}
const toNum = (v) => {
    if (v === undefined || v === null)
        return null;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
};
export function createDeepSeekAdapter() {
    return {
        id: 'deepseek',
        async getBalance(apiKey, options = {}) {
            if (apiKey === '')
                return { ok: false, code: 'missing-key', message: '未配置 DEEPSEEK_API_KEY' };
            const base = options.baseUrl ?? DEFAULT_BASE;
            try {
                const res = await httpRequest({
                    url: `${base}/user/balance`,
                    headers: { authorization: `Bearer ${apiKey}`, ...options.headers },
                    timeoutMs: options.timeoutMs,
                    retries: options.retries,
                });
                if (!res.ok) {
                    const code = res.status === 401 || res.status === 403 ? 'auth' : 'http';
                    return { ok: false, code, message: `余额接口返回错误（HTTP ${res.status}）` };
                }
                const data = parseDeepSeekBalance(parseJson(res.text));
                if (data === null)
                    return { ok: false, code: 'parse', message: '无法解析余额响应（缺 balance_infos）' };
                return { ok: true, data };
            }
            catch (err) {
                return { ok: false, code: 'network', message: err.message ?? String(err) };
            }
        },
        async getUsage() {
            // 官方 API 不开放用量查询（平台用量需 userToken，属另一安全边界）。
            return { ok: true, data: null };
        },
        async validateKey(apiKey, options = {}) {
            const outcome = await this.getBalance(apiKey, options);
            return outcome.ok;
        },
    };
}
export const deepseekMeta = { id: 'deepseek', label: 'DeepSeek' };
