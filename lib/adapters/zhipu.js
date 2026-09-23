import { httpRequest, parseJson } from "./http.js";
export const DEFAULT_BASE = 'https://open.bigmodel.cn';
const numericField = (entry, keys) => {
    for (const key of keys) {
        const v = entry[key];
        if (v === undefined || v === null)
            continue;
        const n = typeof v === 'number' ? v : Number(v);
        if (Number.isFinite(n))
            return n;
    }
    return null;
};
/**
 * 智谱开放平台 /api/paas/v4/balance 的响应结构随账号类型略有差异：
 * 常见形态是 balance: [{ total, available, used, … }]（单位元），
 * 这里对多种字段名做容错解析（sum 可用余额；缺 available 时用 total）。
 */
export function parseZhipuBalance(json) {
    const j = json;
    if (j === null || typeof j !== 'object')
        return null;
    const list = Array.isArray(j.balance) ? j.balance : [];
    if (list.length > 0) {
        let sum = 0;
        let any = false;
        for (const entry of list) {
            const currency = typeof entry.currency === 'string' ? entry.currency : 'CNY';
            void currency;
            const available = numericField(entry, ['available_balance', 'availableBalance', 'available']);
            const total = numericField(entry, ['total_balance', 'totalBalance', 'total']);
            const value = available ?? total;
            if (value !== null) {
                sum += value;
                any = true;
            }
        }
        if (any)
            return { currency: 'CNY', amount: sum, granted: null, toppedUp: null };
    }
    const top = numericField(j, ['total_balance', 'totalBalance', 'available_balance', 'availableBalance']);
    if (top !== null)
        return { currency: 'CNY', amount: top, granted: null, toppedUp: null };
    if (j.data !== undefined && typeof j.data === 'object') {
        const inner = numericField(j.data, ['total_balance', 'totalBalance', 'available_balance', 'availableBalance']);
        if (inner !== null)
            return { currency: 'CNY', amount: inner, granted: null, toppedUp: null };
    }
    return null;
}
export function createZhipuAdapter() {
    return {
        id: 'zhipu',
        async getBalance(apiKey, options = {}) {
            if (apiKey === '')
                return { ok: false, code: 'missing-key', message: '未配置智谱 API Key' };
            const base = options.baseUrl ?? DEFAULT_BASE;
            try {
                const res = await httpRequest({
                    url: `${base}/api/paas/v4/balance`,
                    headers: { authorization: `Bearer ${apiKey}`, ...options.headers },
                    timeoutMs: options.timeoutMs,
                    retries: options.retries,
                });
                if (!res.ok) {
                    const code = res.status === 401 || res.status === 403 ? 'auth' : 'http';
                    return { ok: false, code, message: `余额接口返回错误（HTTP ${res.status}）` };
                }
                const json = parseJson(res.text);
                const parsed = parseZhipuBalance(json);
                if (parsed === null)
                    return { ok: false, code: 'parse', message: '无法解析余额响应（缺 balance 字段）' };
                return { ok: true, data: parsed };
            }
            catch (err) {
                return { ok: false, code: 'network', message: err.message ?? String(err) };
            }
        },
        async getUsage() {
            return { ok: true, data: null };
        },
        async validateKey(apiKey, options = {}) {
            const outcome = await this.getBalance(apiKey, options);
            return outcome.ok;
        },
    };
}
