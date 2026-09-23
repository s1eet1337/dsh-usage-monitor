import { httpRequest, parseJson } from "./http.js";
export const PLATFORM_BASE = 'https://platform.deepseek.com/api/v0';
/* ------------------------------------------------------------------ *
 * Small helpers
 * ------------------------------------------------------------------ */
const isRec = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
/** Tolerant numeric parse: accepts numbers and numeric strings. */
export function num(v) {
    if (typeof v === 'number')
        return Number.isFinite(v) ? v : null;
    if (typeof v === 'string' && v.trim() !== '') {
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    }
    return null;
}
/** Auth-related platform codes: the web session expired. */
const AUTH_CODES = new Set([40002, 40003, 401]);
/**
 * Unwrap the platform envelope `{ code, msg, data: { biz_code, biz_msg,
 * biz_data } }`. Tolerates the biz container being an array, and a payload
 * that arrives unwrapped.
 */
export function unwrapEnvelope(json) {
    if (!isRec(json))
        return { ok: false, code: 'parse', message: '响应不是 JSON 对象' };
    const code = num(json.code);
    if (code !== null && code !== 0) {
        const msg = typeof json.msg === 'string' ? json.msg : '';
        if (AUTH_CODES.has(code)) {
            return { ok: false, code: 'auth', message: `平台登录态已失效（code ${code}）${msg === '' ? '' : `：${msg}`}，请重新粘贴 userToken` };
        }
        return { ok: false, code: 'parse', message: `接口返回错误（code ${code}${msg === '' ? '' : `：${msg}`}）` };
    }
    const raw = json.data;
    const containers = Array.isArray(raw) ? raw : [raw];
    for (const c of containers) {
        if (!isRec(c))
            continue;
        const bizCode = num(c.biz_code);
        if (bizCode !== null && bizCode !== 0) {
            const msg = typeof c.biz_msg === 'string' ? c.biz_msg : '';
            if (AUTH_CODES.has(bizCode)) {
                return { ok: false, code: 'auth', message: `平台登录态已失效（biz_code ${bizCode}）${msg === '' ? '' : `：${msg}`}，请重新粘贴 userToken` };
            }
            return { ok: false, code: 'parse', message: `接口返回错误（biz_code ${bizCode}${msg === '' ? '' : `：${msg}`}）` };
        }
        if (c.biz_data !== undefined)
            return { ok: true, data: c.biz_data };
    }
    if (raw !== undefined)
        return { ok: true, data: raw };
    return { ok: true, data: json };
}
function walletList(v) {
    return Array.isArray(v) ? v.filter(isRec) : [];
}
function walletAmount(list) {
    let total = null;
    for (const w of list) {
        const amount = num(w.balance) ?? num(w.amount);
        if (amount !== null)
            total = (total ?? 0) + amount;
    }
    return total;
}
/** Pure parser for `users/get_user_summary`'s biz_data. */
export function parseUserSummary(raw) {
    if (!isRec(raw))
        return null;
    const normal = walletAmount(walletList(raw.normal_wallets));
    const bonus = walletAmount(walletList(raw.bonus_wallets));
    const monthlyTokenUsage = num(raw.monthly_token_usage);
    let monthlyCost = null;
    for (const c of Array.isArray(raw.monthly_costs) ? raw.monthly_costs : []) {
        if (!isRec(c))
            continue;
        const amount = num(c.amount);
        if (amount !== null)
            monthlyCost = (monthlyCost ?? 0) + amount;
    }
    if (normal === null && bonus === null && monthlyTokenUsage === null && monthlyCost === null)
        return null;
    return { currency: 'CNY', normal, bonus, monthlyTokenUsage, monthlyCost };
}
/** Day container used by both usage endpoints. */
function daysOf(raw) {
    const payload = Array.isArray(raw) ? raw.find(isRec) : raw;
    if (!isRec(payload))
        return null;
    const days = payload.days;
    return Array.isArray(days) ? days.filter(isRec) : null;
}
/**
 * Pure parser for `usage/amount`: day → model → token breakdown.
 * Only PROMPT_TOKEN / PROMPT_CACHE_(HIT|MISS)_TOKEN / RESPONSE_TOKEN are read;
 * unknown types are ignored so a new type cannot corrupt the totals.
 */
export function parseUsageAmountDays(raw) {
    const days = daysOf(raw);
    if (days === null)
        return null;
    const out = new Map();
    for (const day of days) {
        const date = typeof day.date === 'string' ? day.date : null;
        if (date === null || date === '')
            continue;
        const models = new Map();
        for (const entry of Array.isArray(day.data) ? day.data : []) {
            if (!isRec(entry))
                continue;
            const model = typeof entry.model === 'string' && entry.model !== '' ? entry.model : 'unknown';
            const acc = models.get(model) ?? { input: 0, output: 0, cacheHit: 0, cacheMiss: 0 };
            for (const u of Array.isArray(entry.usage) ? entry.usage : []) {
                if (!isRec(u))
                    continue;
                const amount = num(u.amount) ?? 0;
                switch (typeof u.type === 'string' ? u.type : '') {
                    case 'PROMPT_TOKEN':
                        acc.input += amount;
                        break;
                    case 'PROMPT_CACHE_HIT_TOKEN':
                        acc.input += amount;
                        acc.cacheHit += amount;
                        break;
                    case 'PROMPT_CACHE_MISS_TOKEN':
                        acc.input += amount;
                        acc.cacheMiss += amount;
                        break;
                    case 'RESPONSE_TOKEN':
                        acc.output += amount;
                        break;
                    default:
                        break;
                }
            }
            models.set(model, acc);
        }
        out.set(date, models);
    }
    return out;
}
/**
 * Pure parser for `usage/cost`: day → model → amount. Entries without a model
 * land under the '' key (unattributed) and are later spread proportionally.
 */
export function parseUsageCostDays(raw) {
    const days = daysOf(raw);
    if (days === null)
        return null;
    const out = new Map();
    for (const day of days) {
        const date = typeof day.date === 'string' ? day.date : null;
        if (date === null || date === '')
            continue;
        const perModel = new Map();
        for (const entry of Array.isArray(day.data) ? day.data : []) {
            if (!isRec(entry))
                continue;
            const model = typeof entry.model === 'string' && entry.model !== '' ? entry.model : '';
            let sum = 0;
            for (const u of Array.isArray(entry.usage) ? entry.usage : []) {
                if (!isRec(u))
                    continue;
                sum += num(u.amount) ?? num(u.cost) ?? 0;
            }
            perModel.set(model, (perModel.get(model) ?? 0) + sum);
        }
        out.set(date, perModel);
    }
    return out;
}
const tokenTotalOf = (u) => u.input + u.output;
/**
 * Merge the two month endpoints into one view. Day-level cost without a model
 * attribution is spread across that day's models by token share — the platform
 * does not always carry a model on cost rows.
 */
export function mergeMonth(month, usage, cost) {
    const dates = new Set([...(usage?.keys() ?? []), ...(cost?.keys() ?? [])]);
    const days = [];
    const modelAcc = new Map();
    const addModel = (model, u, cost) => {
        const acc = modelAcc.get(model) ?? { input: 0, output: 0, cacheHit: 0, cacheMiss: 0, cost: 0 };
        if (u !== undefined) {
            acc.input += u.input;
            acc.output += u.output;
            acc.cacheHit += u.cacheHit;
            acc.cacheMiss += u.cacheMiss;
        }
        acc.cost += cost;
        modelAcc.set(model, acc);
    };
    for (const date of [...dates].sort()) {
        const models = usage?.get(date) ?? new Map();
        const costs = cost?.get(date) ?? new Map();
        const unattributed = costs.get('') ?? 0;
        const dayTokens = [...models.values()].reduce((sum, u) => sum + tokenTotalOf(u), 0);
        let dayCost = 0;
        let dayInput = 0;
        let dayOutput = 0;
        let dayHit = 0;
        let dayMiss = 0;
        const named = [...costs.entries()].filter(([model]) => model !== '');
        // Attribute cost: named rows first, then the unattributed remainder by tokens.
        const byModel = new Map();
        for (const [model, amount] of named)
            byModel.set(model, (byModel.get(model) ?? 0) + amount);
        for (const [model, u] of models) {
            const share = dayTokens > 0 ? tokenTotalOf(u) / dayTokens : 0;
            byModel.set(model, (byModel.get(model) ?? 0) + unattributed * share);
        }
        if (models.size === 0 && unattributed !== 0)
            byModel.set('unknown', (byModel.get('unknown') ?? 0) + unattributed);
        for (const [model, u] of models) {
            dayInput += u.input;
            dayOutput += u.output;
            dayHit += u.cacheHit;
            dayMiss += u.cacheMiss;
            addModel(model, u, byModel.get(model) ?? 0);
        }
        for (const [model, amount] of byModel) {
            dayCost += amount;
            if (!models.has(model))
                addModel(model, undefined, amount);
        }
        days.push({
            date,
            input: dayInput,
            output: dayOutput,
            cacheHit: dayHit,
            cacheMiss: dayMiss,
            total: dayInput + dayOutput,
            cost: dayCost,
        });
    }
    const tokens = days.reduce((sum, d) => sum + d.total, 0);
    const cost_ = days.reduce((sum, d) => sum + d.cost, 0);
    const byModel = [...modelAcc.entries()]
        .map(([model, acc]) => ({
        model,
        input: acc.input,
        output: acc.output,
        cache: acc.cacheHit + acc.cacheMiss,
        total: acc.input + acc.output,
        cost: acc.cost,
        share: cost_ > 0 ? acc.cost / cost_ : 0,
    }))
        .sort((a, b) => b.cost - a.cost || b.total - a.total);
    return { month, days, byModel, tokens, cost: cost_ };
}
export const monthPointOf = (m) => ({
    month: m.month,
    tokens: m.tokens,
    cost: m.cost,
});
/* ------------------------------------------------------------------ *
 * Transport
 * ------------------------------------------------------------------ */
/** `YYYY-MM` → the platform's `month`/`year` query pair. */
export function monthParam(month) {
    const [y, m] = month.split('-');
    return { month: Number(m), year: Number(y) };
}
async function platformGet(token, path, params, options) {
    const base = options.baseUrl ?? PLATFORM_BASE;
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params))
        search.set(k, String(v));
    const url = `${base}${path}${search.size > 0 ? `?${search.toString()}` : ''}`;
    let res;
    try {
        res = await httpRequest({
            url,
            headers: {
                authorization: `Bearer ${token}`,
                accept: 'application/json',
                'x-client-platform': 'web',
                origin: 'https://platform.deepseek.com',
                referer: 'https://platform.deepseek.com/usage',
            },
            timeoutMs: options.timeoutMs ?? 8_000,
            retries: options.retries ?? 2,
        });
    }
    catch (err) {
        return { ok: false, code: 'network', message: err.message ?? String(err) };
    }
    if (!res.ok) {
        const code = res.status === 401 || res.status === 403 ? 'auth' : 'http';
        return {
            ok: false,
            code,
            message: code === 'auth'
                ? `平台登录态已失效（HTTP ${res.status}），请重新粘贴 userToken`
                : `平台接口返回 HTTP ${res.status}`,
        };
    }
    const payload = unwrapEnvelope(parseJson(res.text));
    if (!payload.ok)
        return payload;
    return { ok: true, data: payload.data };
}
/** Wallet + this-month totals. */
export async function fetchUserSummary(token, options = {}) {
    const res = await platformGet(token, '/users/get_user_summary', {}, options);
    if (!res.ok)
        return res;
    return { ok: true, data: parseUserSummary(res.data) };
}
/** One calendar month of usage + cost, already merged. */
export async function fetchMonth(token, month, options = {}) {
    const params = monthParam(month);
    const [amount, cost] = await Promise.all([
        platformGet(token, '/usage/amount', params, options),
        platformGet(token, '/usage/cost', params, options),
    ]);
    if (!amount.ok)
        return amount;
    if (!cost.ok)
        return cost;
    return { ok: true, data: mergeMonth(month, parseUsageAmountDays(amount.data), parseUsageCostDays(cost.data)) };
}
