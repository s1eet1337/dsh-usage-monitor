import type { BalancePayload, ProviderAdapter } from './types.ts';
export declare const DEFAULT_BASE = "https://open.bigmodel.cn";
export interface ZhipuBalanceEntry extends Record<string, unknown> {
}
export interface ZhipuBalanceJson {
    code?: number;
    balance?: ZhipuBalanceEntry[];
    data?: Record<string, unknown>;
}
/**
 * 智谱开放平台 /api/paas/v4/balance 的响应结构随账号类型略有差异：
 * 常见形态是 balance: [{ total, available, used, … }]（单位元），
 * 这里对多种字段名做容错解析（sum 可用余额；缺 available 时用 total）。
 */
export declare function parseZhipuBalance(json: unknown): BalancePayload | null;
export declare function createZhipuAdapter(): ProviderAdapter;
