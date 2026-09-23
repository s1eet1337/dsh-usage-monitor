import type { BalancePayload, ProviderAdapter } from './types.ts';
import type { ProviderId } from '../core/core.ts';
export declare const DEFAULT_BASE = "https://api.deepseek.com";
export interface DeepSeekBalanceEntry {
    currency?: string;
    total_balance?: string | number;
    granted_balance?: string | number;
    topped_up_balance?: string | number;
}
export interface DeepSeekBalanceJson {
    is_available?: boolean;
    balance_infos?: DeepSeekBalanceEntry[];
}
/** Pure parser, exported for tests. Returns null when nothing usable is present. */
export declare function parseDeepSeekBalance(json: unknown): BalancePayload | null;
export declare function createDeepSeekAdapter(): ProviderAdapter;
export declare const deepseekMeta: {
    id: ProviderId;
    label: string;
};
