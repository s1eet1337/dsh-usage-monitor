/**
 * DeepSeek 开放平台「用量 / 消费」适配器（登录态私有接口）。
 *
 * 官方 API（api.deepseek.com）只公开 `GET /user/balance`，没有任何消费查询；
 * 网页版 https://platform.deepseek.com/usage 走的是下面这些内部接口：
 *
 *   GET /api/v0/users/get_user_summary        钱包余额 + 本月 token/消费
 *   GET /api/v0/usage/amount?month=&year=     逐日 token（按模型）
 *   GET /api/v0/usage/cost?month=&year=       逐日消费
 *
 * 认证用的是浏览器 localStorage 里的 `userToken`（Bearer），**不是 API Key**；
 * 这些接口属于私有契约，随时可能变更，所以这里所有解析函数都容错并单独导出，
 * 便于离线单测。
 *
 * 币种：平台以人民币结算，接口不总带币种字段，因此缺失时按 CNY 处理。
 */
import type { PlatformDayPoint, PlatformModelRow, PlatformMonthPoint } from '../core/core.ts';
export declare const PLATFORM_BASE = "https://platform.deepseek.com/api/v0";
export type PlatformErrorCode = 'auth' | 'http' | 'network' | 'parse';
export type PlatformOutcome<T> = {
    ok: true;
    data: T;
} | {
    ok: false;
    code: PlatformErrorCode;
    message: string;
};
export interface PlatformRequestOptions {
    /** Base override (mirrors / proxies); defaults to PLATFORM_BASE. */
    baseUrl?: string;
    timeoutMs?: number;
    retries?: number;
}
/** Tolerant numeric parse: accepts numbers and numeric strings. */
export declare function num(v: unknown): number | null;
/**
 * Unwrap the platform envelope `{ code, msg, data: { biz_code, biz_msg,
 * biz_data } }`. Tolerates the biz container being an array, and a payload
 * that arrives unwrapped.
 */
export declare function unwrapEnvelope(json: unknown): {
    ok: true;
    data: unknown;
} | {
    ok: false;
    code: 'auth' | 'parse';
    message: string;
};
export interface PlatformSummary {
    currency: string;
    /** 充值余额（normal_wallets 合计）。 */
    normal: number | null;
    /** 赠送余额（bonus_wallets 合计）。 */
    bonus: number | null;
    /** 平台自报的本月 token 用量。 */
    monthlyTokenUsage: number | null;
    /** 平台自报的本月消费。 */
    monthlyCost: number | null;
}
/** Pure parser for `users/get_user_summary`'s biz_data. */
export declare function parseUserSummary(raw: unknown): PlatformSummary | null;
export interface PlatformModelUsage {
    input: number;
    output: number;
    cacheHit: number;
    cacheMiss: number;
}
export type PlatformUsageDays = Map<string, Map<string, PlatformModelUsage>>;
export type PlatformCostDays = Map<string, Map<string, number>>;
/**
 * Pure parser for `usage/amount`: day → model → token breakdown.
 * Only PROMPT_TOKEN / PROMPT_CACHE_(HIT|MISS)_TOKEN / RESPONSE_TOKEN are read;
 * unknown types are ignored so a new type cannot corrupt the totals.
 */
export declare function parseUsageAmountDays(raw: unknown): PlatformUsageDays | null;
/**
 * Pure parser for `usage/cost`: day → model → amount. Entries without a model
 * land under the '' key (unattributed) and are later spread proportionally.
 */
export declare function parseUsageCostDays(raw: unknown): PlatformCostDays | null;
export interface PlatformMonth {
    /** YYYY-MM */
    month: string;
    days: PlatformDayPoint[];
    byModel: PlatformModelRow[];
    tokens: number;
    cost: number;
}
/**
 * Merge the two month endpoints into one view. Day-level cost without a model
 * attribution is spread across that day's models by token share — the platform
 * does not always carry a model on cost rows.
 */
export declare function mergeMonth(month: string, usage: PlatformUsageDays | null, cost: PlatformCostDays | null): PlatformMonth;
export declare const monthPointOf: (m: PlatformMonth) => PlatformMonthPoint;
/** `YYYY-MM` → the platform's `month`/`year` query pair. */
export declare function monthParam(month: string): {
    month: number;
    year: number;
};
/** Wallet + this-month totals. */
export declare function fetchUserSummary(token: string, options?: PlatformRequestOptions): Promise<PlatformOutcome<PlatformSummary | null>>;
/** One calendar month of usage + cost, already merged. */
export declare function fetchMonth(token: string, month: string, options?: PlatformRequestOptions): Promise<PlatformOutcome<PlatformMonth>>;
