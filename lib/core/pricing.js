/**
 * Reference pricing table (pure, self-contained).
 *
 * These are PUBLIC list prices in **USD per 1M tokens** used only to turn
 * observed token usage into a rough cost estimate for the table / export /
 * budget rows. They are NOT billing records: provider prices change, plans
 * discount, relays reprice. Every number here is a manually curated
 * approximation with a “参考价” label in the UI; users can override any model
 * through the plugin config (`pricing` overrides) or ignore the cost column.
 *
 * Entries are matched case-insensitively with `model.includes(matcher)`.
 *
 * This module stays dependency-free (both build programs compile it with
 * different relative-import rules), so provider aliasing is done here with a
 * local prefix rule instead of importing the registry: the harness reports
 * runtime ids such as `deepseek-official`, which must still match the `deepseek`
 * rows or no price would ever apply.
 */
export const PRICE_TABLE = [
    // DeepSeek — current models, USD / 1M (source: api-docs.deepseek.com/quick_start/pricing).
    // The published rates have an off-peak/peak split (peak = 2× off-peak, peak =
    // 01:00–04:00 and 06:00–10:00 UTC on weekdays); a single-row table cannot
    // express that, so these entries use the midpoint and the column stays a
    // 参考价. The platform sync (platform.deepseek.com) is the real bill.
    // Matcher order matters: the most specific model name must come first.
    ['deepseek', 'deepseek-v4-flash', { input: 0.225, output: 0.9, cacheHit: 0.0045 }],
    ['deepseek', 'deepseek-flash', { input: 0.225, output: 0.9, cacheHit: 0.0045 }],
    ['deepseek', 'deepseek-v4-pro', { input: 0.99, output: 2.97, cacheHit: 0.033 }],
    // Legacy model names still routed to the same models.
    ['deepseek', 'deepseek-chat', { input: 0.27, output: 1.1, cacheHit: 0.07 }],
    ['deepseek', 'deepseek-reasoner', { input: 0.55, output: 2.19, cacheHit: 0.14 }],
    // OpenAI
    ['openai', 'gpt-4o-mini', { input: 0.15, output: 0.6, cacheHit: 0.075 }],
    ['openai', 'gpt-4o', { input: 2.5, output: 10, cacheHit: 1.25 }],
    ['openai', 'gpt-4.1-mini', { input: 0.4, output: 1.6, cacheHit: 0.2 }],
    ['openai', 'gpt-4.1-nano', { input: 0.1, output: 0.4, cacheHit: 0.05 }],
    ['openai', 'gpt-4.1', { input: 2, output: 8, cacheHit: 1 }],
    ['openai', 'o4-mini', { input: 1.1, output: 4.4, cacheHit: 0.55 }],
    ['openai', 'o3-mini', { input: 1.1, output: 4.4, cacheHit: 0.55 }],
    ['openai', 'o3', { input: 2, output: 8, cacheHit: 1 }],
    ['openai', 'o1-mini', { input: 1.1, output: 4.4, cacheHit: 0.55 }],
    ['openai', 'o1', { input: 15, output: 60, cacheHit: 7.5 }],
    // Anthropic
    ['anthropic', 'claude-opus', { input: 15, output: 75, cacheHit: 1.5 }],
    ['anthropic', 'claude-sonnet', { input: 3, output: 15, cacheHit: 0.3 }],
    ['anthropic', 'claude-haiku', { input: 0.8, output: 4, cacheHit: 0.08 }],
    // Moonshot / Kimi
    ['moonshot', 'kimi-k2', { input: 0.6, output: 2.5 }],
    ['moonshot', 'kimi-latest', { input: 0.6, output: 2.5 }],
    ['moonshot', 'moonshot-v1-128k', { input: 0.9, output: 2.4 }],
    ['moonshot', 'moonshot-v1-32k', { input: 0.6, output: 2.5 }],
    ['moonshot', 'moonshot-v1-8k', { input: 0.3, output: 0.6 }],
    // 智谱 GLM 与 SiliconFlow 未内置：价格随渠道/促销浮动，成本列显示 —
    // 可通过设置里的定价覆盖补充。
];
/** Matcher strings that should never hit (safety for prefix matches like `o1`). */
const EXACT_ONLY = new Set(['o1', 'o3', 'o4-mini', 'o3-mini', 'o1-mini']);
/** Provider ids match across the runtime/registry boundary ("deepseek" ↔ "deepseek-official"). */
const sameProvider = (a, b) => a === b || a.startsWith(`${b}-`) || b.startsWith(`${a}-`);
export function lookupRate(provider, model, overrides = []) {
    const lower = model.toLowerCase();
    for (const o of overrides) {
        if (sameProvider(o.provider, provider) && lower.includes(o.model.toLowerCase())) {
            return { input: o.priceIn, output: o.priceOut };
        }
    }
    for (const [prov, matcher, rate] of PRICE_TABLE) {
        if (!sameProvider(prov, provider))
            continue;
        const m = matcher.toLowerCase();
        if (EXACT_ONLY.has(matcher)) {
            if (lower === m)
                return rate;
        }
        else if (lower.includes(m)) {
            return rate;
        }
    }
    return undefined;
}
/** Estimated USD cost for one usage record, or null when no rate is known. */
export function estimateCostUsd(provider, model, input, cache, output, overrides = []) {
    const rate = lookupRate(provider, model, overrides);
    if (rate === undefined)
        return null;
    const cacheRate = rate.cacheHit ?? rate.input;
    return (input * rate.input + cache * cacheRate + output * rate.output) / 1e6;
}
