import type { BalancePayload, ProviderAdapter } from './types.ts';
export declare const DEFAULT_BASE = "https://api.siliconflow.cn";
export interface SiliconFlowUserInfoJson {
    balance?: string | number;
    totalBalance?: string | number;
    data?: {
        balance?: string | number;
        totalBalance?: string | number;
    };
}
export declare function parseSiliconFlowBalance(json: unknown, defaultCurrency?: string): BalancePayload | null;
export declare function createSiliconFlowAdapter(): ProviderAdapter;
