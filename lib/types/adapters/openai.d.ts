import type { BalancePayload, ProviderAdapter } from './types.ts';
export declare const DEFAULT_BASE = "https://api.openai.com";
export interface OpenAiCreditGrantsJson {
    total_granted?: number;
    total_used?: number;
    total_available?: number;
    hard_limit_usd?: number;
    soft_limit_usd?: number;
}
/** Pure parser for the legacy credit-grants payload (tests). */
export declare function parseOpenAiCredits(json: unknown): BalancePayload | null;
export declare function createOpenAiAdapter(): ProviderAdapter;
