/**
 * dsh-usage-monitor — shared pure core.
 *
 * This module is intentionally SELF-CONTAINED (zero relative imports) so it can
 * be compiled twice from the same source: once into the Node host bundle
 * (ESM, `src/core/*.ts` imports) and once into the browser client bundle
 * (CJS, extension-less imports). Everything here must stay free of `node:*`
 * and DOM imports.
 */
export const PROVIDERS = [
    {
        id: 'deepseek',
        label: 'DeepSeek',
        keyEnv: ['DEEPSEEK_API_KEY'],
        currencyHint: 'CNY',
        note: '官方 GET /user/balance 返回可用余额；用量从 DSH 会话日志统计。',
        docs: 'https://api-docs.deepseek.com/zh-cn/api/get-user-balance',
    },
    {
        id: 'openai',
        label: 'OpenAI',
        keyEnv: ['OPENAI_API_KEY'],
        currencyHint: 'USD',
        note: '官方已停用 credit_grants 余额查询（大多数新账号返回 404/401）；v1/models 仅校验 Key。余额默认不可用。',
        docs: 'https://platform.openai.com/docs/guides/usage',
    },
    {
        id: 'anthropic',
        label: 'Anthropic',
        keyEnv: ['ANTHROPIC_API_KEY'],
        currencyHint: 'USD',
        note: 'API Key 无公开余额/用量接口（组织 Admin API 需独立权限）。v1/models 仅校验 Key。',
        docs: 'https://docs.anthropic.com/en/api/admin-api/usage-costs',
    },
    {
        id: 'zhipu',
        label: '智谱 GLM',
        keyEnv: ['ZHIPUAI_API_KEY', 'GLM_API_KEY', 'ZAI_API_KEY'],
        currencyHint: 'CNY',
        note: '开放平台 GET /api/paas/v4/balance 返回余额；结构随账号类型略有差异，取不到时降级为“不可用”。',
        docs: 'https://open.bigmodel.cn/dev/api/normal-model/glm-4',
    },
    {
        id: 'moonshot',
        label: 'Moonshot / Kimi',
        keyEnv: ['MOONSHOT_API_KEY', 'KIMI_API_KEY'],
        currencyHint: 'CNY',
        note: 'API 余额查询接口未公开稳定契约（官方文档仅控制台查看）；v1/models 仅校验 Key。',
        docs: 'https://www.kimi.com/en/help/kimi-api/api-balance-and-usage',
    },
    {
        id: 'siliconflow',
        label: 'SiliconFlow',
        keyEnv: ['SILICONFLOW_API_KEY'],
        currencyHint: 'CNY',
        note: 'GET /v1/user/info 返回账户余额（data.totalBalance）。',
        docs: 'https://docs.siliconflow.cn/cn/userguide/account/balance',
    },
];
/**
 * Map a harness runtime provider id onto this plugin's registry id.
 *
 * The harness names providers for the runtime ("deepseek-official",
 * "llama-cpp-qwen3-14b"), while balances, budgets and the pricing table are
 * keyed by the registry id ("deepseek"). Without this mapping every provider
 * card reports 0 usage while the account burns millions of tokens, and no price
 * ever matches. Unknown providers (local models, future ones) pass through
 * unchanged so their usage still appears in the ledger.
 */
export function canonicalProvider(id) {
    for (const p of PROVIDERS) {
        if (id === p.id || id.startsWith(`${p.id}-`) || id.startsWith(`${p.id}_`))
            return p.id;
    }
    return id;
}
export function providerMeta(id) {
    const meta = PROVIDERS.find((p) => p.id === id);
    if (meta !== undefined)
        return meta;
    // Unknown provider (e.g. a future harness provider) degrades gracefully.
    return {
        id: id,
        label: id,
        keyEnv: [],
        currencyHint: 'USD',
        note: '未收录的 Provider，仅展示日志统计。',
        docs: '',
    };
}
/**
 * Extract the bare token from whatever shape arrived.
 *
 * Tokens are copied out of DevTools, so the field often receives a JSON wrapper
 * (`{"value":"…","__version":"0"}`) or just the trailing fragment
 * (`…","__version":"0"}`). Either one makes the Authorization header invalid
 * (platform code 40003), which looks like an expired login rather than a paste
 * mistake. A real token is a run of base64 characters, so anything the clipboard
 * added falls outside that set.
 */
export function normalizeUserToken(raw) {
    const text = raw.trim();
    if (text === '')
        return '';
    const wrapped = /"value"\s*:\s*"([^"]+)"/.exec(text);
    if (wrapped !== null && typeof wrapped[1] === 'string' && wrapped[1] !== '')
        return wrapped[1].trim();
    const run = /[A-Za-z0-9_\-+/=]{16,}/.exec(text);
    if (run !== null)
        return run[0];
    return text.replace(/^Bearer\s+/i, '').trim();
}
export const DAY_OPTIONS = [7, 30, 90];
export function defaultBudgetConfig(provider) {
    return { budget: undefined, warnPct: 5, enabled: true };
}
export function defaultConfig() {
    const balances = {};
    for (const p of PROVIDERS)
        balances[p.id] = defaultBudgetConfig(p.id);
    return {
        balances,
        webhooks: [],
        pollMs: 60_000,
        retentionDays: 90,
        envKeys: {},
        pricing: [],
        deepseekPlatform: { enabled: true, historyMonths: 36 },
    };
}
export function normalizeConfig(raw) {
    const base = defaultConfig();
    if (raw === null || typeof raw !== 'object')
        return base;
    const src = raw;
    const balancesRaw = isRecord(src.balances) ? src.balances : {};
    for (const p of PROVIDERS) {
        const entry = isRecord(balancesRaw[p.id]) ? balancesRaw[p.id] : {};
        const budget = pickNumber(entry.budget);
        const currency = typeof entry.currency === 'string' && entry.currency !== '' ? entry.currency : undefined;
        const warnPct = pickNumber(entry.warnPct);
        const enabled = typeof entry.enabled === 'boolean' ? entry.enabled : true;
        const balanceUrl = typeof entry.balanceUrl === 'string' && entry.balanceUrl !== '' ? entry.balanceUrl : undefined;
        base.balances[p.id] = {
            budget: budget !== undefined && budget > 0 ? budget : undefined,
            currency,
            warnPct: warnPct === undefined ? 5 : clamp(warnPct, 0.1, 100),
            enabled,
            balanceUrl,
        };
    }
    if (Array.isArray(src.webhooks)) {
        base.webhooks = src.webhooks
            .filter((w) => isRecord(w))
            .map((w) => ({
            url: typeof w.url === 'string' ? w.url : '',
            secret: typeof w.secret === 'string' ? w.secret : undefined,
            cooldownMs: pickNumber(w.cooldownMs),
            enabled: typeof w.enabled === 'boolean' ? w.enabled : true,
        }))
            .filter((w) => w.url !== '');
    }
    const pollMs = pickNumber(src.pollMs);
    if (pollMs !== undefined)
        base.pollMs = clamp(pollMs, 5_000, 3_600_000);
    const retention = pickNumber(src.retentionDays);
    if (retention !== undefined)
        base.retentionDays = clamp(Math.round(retention), 7, 730);
    if (isRecord(src.envKeys)) {
        for (const [k, v] of Object.entries(src.envKeys)) {
            if (typeof v === 'string' && v !== '')
                base.envKeys[k] = v;
        }
    }
    if (Array.isArray(src.pricing)) {
        base.pricing = src.pricing
            .filter((p) => isRecord(p))
            .map((p) => ({
            provider: typeof p.provider === 'string' ? p.provider : '',
            model: typeof p.model === 'string' ? p.model : '',
            priceIn: pickNumber(p.priceIn) ?? 0,
            priceOut: pickNumber(p.priceOut) ?? 0,
        }))
            .filter((p) => p.provider !== '' && p.model !== '' && p.priceIn > 0 && p.priceOut > 0);
    }
    if (isRecord(src.deepseekPlatform)) {
        const plat = src.deepseekPlatform;
        base.deepseekPlatform = {
            enabled: typeof plat.enabled === 'boolean' ? plat.enabled : true,
            historyMonths: clamp(Math.round(pickNumber(plat.historyMonths) ?? 36), 1, 60),
            userToken: (() => {
                if (typeof plat.userToken !== 'string')
                    return undefined;
                const cleaned = normalizeUserToken(plat.userToken);
                return cleaned === '' ? undefined : cleaned;
            })(),
        };
    }
    if (typeof src.storageDir === 'string' && src.storageDir !== '')
        base.storageDir = src.storageDir;
    return base;
}
export function budgetFor(config, id, fallbackCurrency) {
    const entry = config.balances[id];
    const amount = entry?.budget !== undefined && entry.budget !== null && entry.budget > 0 ? entry.budget : null;
    const currency = entry?.currency ?? fallbackCurrency;
    const warnPct = entry?.warnPct ?? 5;
    return { amount, currency, warnPct };
}
/**
 * Evaluate the alert level for one provider.
 * - balance known: remaining = balance; remainingPct = balance / budget.
 * - balance unknown but monthly spend estimated and budget set:
 *   remaining ≈ budget − spend (best effort).
 */
export function evaluateAlert(args) {
    const { balanceAmount, spendAmount, budget } = args;
    const budgetAmount = budget.amount;
    if (budgetAmount === null) {
        // No user budget: no progress bar, no pct alerts (absolute floor is not
        // supported by design — the budget is the user's own number).
        return { level: 'ok', remainingPct: null };
    }
    if (balanceAmount !== null) {
        const remainingPct = budgetAmount > 0 ? balanceAmount / budgetAmount : 0;
        const level = balanceAmount <= 0 ? 'critical'
            : remainingPct * 100 <= budget.warnPct ? 'warn'
                : 'ok';
        return { level, remainingPct };
    }
    if (spendAmount !== null) {
        // Estimate remaining from budget minus observed spend (only meaningful
        // when the user set a budget as a top-up ceiling).
        const remaining = budgetAmount - spendAmount;
        const remainingPct = budgetAmount > 0 ? remaining / budgetAmount : 0;
        const level = remaining <= 0 ? 'critical'
            : remainingPct * 100 <= budget.warnPct ? 'warn'
                : 'ok';
        return { level, remainingPct };
    }
    return { level: 'ok', remainingPct: null };
}
export const emptyTotals = () => ({
    input: 0,
    output: 0,
    cache: 0,
    reasoning: 0,
    total: 0,
    cost: null,
    costCalls: 0,
    calls: 0,
});
export function addToTotals(t, input, output, cache, reasoning, cost) {
    t.input += input;
    t.output += output;
    t.cache += cache;
    t.reasoning += reasoning;
    t.total += input + output + cache;
    t.calls += 1;
    if (cost !== null) {
        t.cost = (t.cost ?? 0) + cost;
        t.costCalls += 1;
    }
}
export const dayKeyOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const dayKeyOfMs = (ms) => dayKeyOf(new Date(ms));
export function dateBefore(now, days) {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
}
export function dayKeysBackTo(now, count) {
    const keys = [];
    for (let i = count - 1; i >= 0; i--)
        keys.push(dayKeyOf(dateBefore(now, i)));
    return keys;
}
/**
 * Filter records to the trailing `days` calendar days (inclusive), then fold
 * per-day totals. Cost folding: unknown-model records contribute 0 but are
 * counted separately by the caller when needed.
 */
export function rollDaily(records, days, now = new Date()) {
    const first = dayKeyOf(dateBefore(now, days - 1));
    const last = dayKeyOf(now);
    const buckets = new Map();
    for (const r of records) {
        const key = dayKeyOfMs(r.at);
        if (key < first || key > last)
            continue;
        let b = buckets.get(key);
        if (b === undefined) {
            b = emptyTotals();
            buckets.set(key, b);
        }
        addToTotals(b, r.input, r.output, r.cache, r.reasoning, r.cost);
    }
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
        const key = dayKeyOf(dateBefore(now, i));
        const b = buckets.get(key) ?? emptyTotals();
        out.push({ date: key, input: b.input, output: b.output, cache: b.cache, total: b.total, cost: b.cost, calls: b.calls });
    }
    return out;
}
export function totalsOf(records) {
    const t = emptyTotals();
    for (const r of records)
        addToTotals(t, r.input, r.output, r.cache, r.reasoning, r.cost);
    return t;
}
/**
 * Group day×provider×model rows (details table) over the trailing window.
 * `sessions` = number of distinct sessions contributing to that group.
 */
export function rollRows(records, days, now = new Date()) {
    const first = dayKeyOf(dateBefore(now, days - 1));
    const last = dayKeyOf(now);
    const map = new Map();
    for (const r of records) {
        const key = dayKeyOfMs(r.at);
        if (key < first || key > last)
            continue;
        const group = `${key}\u0000${r.provider}\u0000${r.model}`;
        let acc = map.get(group);
        if (acc === undefined) {
            acc = { ...emptyTotals(), sessions: new Set(), topSession: new Map() };
            map.set(group, acc);
        }
        addToTotals(acc, r.input, r.output, r.cache, r.reasoning, r.cost);
        const eventTotal = r.input + r.output + r.cache;
        acc.sessions.add(r.sessionId);
        acc.topSession.set(r.sessionId, (acc.topSession.get(r.sessionId) ?? 0) + eventTotal);
    }
    const out = [];
    for (const [group, acc] of map) {
        const [date, provider, model] = group.split('\u0000');
        let topSession = '';
        let top = -1;
        for (const [sid, total] of acc.topSession) {
            if (total > top) {
                top = total;
                topSession = sid;
            }
        }
        out.push({
            date: date ?? '',
            provider: provider ?? '',
            model: model ?? '',
            input: acc.input,
            output: acc.output,
            cache: acc.cache,
            total: acc.total,
            cost: acc.cost,
            calls: acc.calls,
            sessions: acc.sessions.size,
            topSession,
        });
    }
    out.sort((a, b) => (a.date === b.date ? b.total - a.total : a.date < b.date ? -1 : 1));
    return out;
}
export function rollSessionRows(records, days, now = new Date()) {
    const first = dayKeyOf(dateBefore(now, days - 1));
    const last = dayKeyOf(now);
    const map = new Map();
    for (const r of records) {
        const key = dayKeyOfMs(r.at);
        if (key < first || key > last)
            continue;
        const group = `${key}\u0000${r.sessionId}\u0000${r.provider}\u0000${r.model}`;
        let acc = map.get(group);
        if (acc === undefined) {
            acc = { ...emptyTotals() };
            map.set(group, acc);
        }
        addToTotals(acc, r.input, r.output, r.cache, r.reasoning, r.cost);
    }
    const out = [];
    const titleBySession = new Map();
    for (const r of records) {
        if (!titleBySession.has(r.sessionId) && r.sessionTitle !== '')
            titleBySession.set(r.sessionId, r.sessionTitle);
    }
    for (const [group, acc] of map) {
        const [date, sessionId, provider, model] = group.split('\u0000');
        out.push({
            date: date ?? '',
            sessionId: sessionId ?? '',
            title: titleBySession.get(sessionId ?? '') ?? `会话 ${(sessionId ?? '').slice(0, 8)}`,
            provider: provider ?? '',
            model: model ?? '',
            input: acc.input,
            output: acc.output,
            cache: acc.cache,
            total: acc.total,
            cost: acc.cost,
            calls: acc.calls,
        });
    }
    out.sort((a, b) => (a.date === b.date ? b.total - a.total : a.date < b.date ? -1 : 1));
    return out;
}
/* ------------------------------------------------------------------ *
 * Formatting helpers
 * ------------------------------------------------------------------ */
export const pad2 = (n) => (n < 10 ? `0${n}` : String(n));
export function fmtTokens(n) {
    if (!Number.isFinite(n) || n < 0)
        return '—';
    if (n >= 1e9)
        return `${trim(n / 1e9)}B`;
    if (n >= 1e6)
        return `${trim(n / 1e6)}M`;
    if (n >= 1e3)
        return `${trim(n / 1e3)}k`;
    return String(Math.round(n));
}
const trim = (v) => (Math.abs(v) >= 100 ? String(Math.round(v)) : String(Math.round(v * 10) / 10));
export const CURRENCY_SYMBOL = {
    CNY: '¥',
    USD: '$',
    EUR: '€',
    JPY: '¥',
};
export function currencySymbol(currency) {
    return CURRENCY_SYMBOL[currency] ?? `${currency} `;
}
export function fmtMoney(amount, currency, digits = 2) {
    if (amount === null || amount === undefined || !Number.isFinite(amount))
        return '—';
    const abs = Math.abs(amount);
    const d = abs >= 100 ? 0 : abs >= 1 ? digits : 4;
    return `${currencySymbol(currency)}${amount.toFixed(d)}`;
}
export function fmtPct(v) {
    if (v === null || !Number.isFinite(v))
        return '—';
    return `${Math.round(v * 1000) / 10}%`;
}
/* ------------------------------------------------------------------ *
 * Small guards
 * ------------------------------------------------------------------ */
export function isRecord(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
}
export function pickNumber(v) {
    if (typeof v === 'number' && Number.isFinite(v))
        return v;
    if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)))
        return Number(v);
    return undefined;
}
export function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
}
export function errorMessage(err) {
    const m = err?.message;
    return typeof m === 'string' && m !== '' ? m : String(err);
}
