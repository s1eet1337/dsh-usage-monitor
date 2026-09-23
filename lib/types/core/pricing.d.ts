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
export interface PriceRate {
    input: number;
    output: number;
    /** Cache-hit input price; defaults to input when the row has no cache column. */
    cacheHit?: number;
}
export type PriceEntry = readonly [provider: string, matcher: string, rate: PriceRate];
export declare const PRICE_TABLE: readonly PriceEntry[];
export interface PricingOverride {
    provider: string;
    model: string;
    priceIn: number;
    priceOut: number;
}
export declare function lookupRate(provider: string, model: string, overrides?: readonly PricingOverride[]): PriceRate | undefined;
/** Estimated USD cost for one usage record, or null when no rate is known. */
export declare function estimateCostUsd(provider: string, model: string, input: number, cache: number, output: number, overrides?: readonly PricingOverride[]): number | null;
