import { httpRequest, parseJson } from "./http.js";
export const DEFAULT_BASE = 'https://api.siliconflow.cn';
export function parseSiliconFlowBalance(json, defaultCurrency = 'CNY') {
    const j = json;
    if (j === null || typeof j !== 'object')
        return null;
    const raw = firstDefined(j.balance, j.totalBalance, j.data?.balance, j.data?.totalBalance);
    if (raw === undefined)
        return null;
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(n))
        return null;
    const currency = defaultCurrency;
    return { currency, amount: n, granted: null, toppedUp: null };
}
const firstDefined = (...values) => values.find((v) => v !== undefined && v !== null && v !== '');
export function createSiliconFlowAdapter() {
    return {
        id: 'siliconflow',
        async getBalance(apiKey, options = {}) {
            if (apiKey === '')
                return { ok: false, code: 'missing-key', message: '未配置 SILICONFLOW_API_KEY' };
            const base = options.baseUrl ?? DEFAULT_BASE;
            const currency = base.includes('.com') && !base.includes('.cn') ? 'USD' : 'CNY';
            try {
                const res = await httpRequest({
                    url: `${base}/v1/user/info`,
                    headers: { authorization: `Bearer ${apiKey}`, ...options.headers },
                    timeoutMs: options.timeoutMs,
                    retries: options.retries,
                });
                if (!res.ok) {
                    const code = res.status === 401 || res.status === 403 ? 'auth' : 'http';
                    return { ok: false, code, message: `用户信息接口返回错误（HTTP ${res.status}）` };
                }
                const parsed = parseSiliconFlowBalance(parseJson(res.text), currency);
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
