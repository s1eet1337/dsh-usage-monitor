import type { PlatformDayPoint, PlatformModelRow, PlatformMonthPoint, PlatformSpend, PlatformStatus } from '../core/core.ts';
import type { PlatformRequestOptions } from '../adapters/deepseek-platform.ts';
export declare const monthKeyOf: (ms: number) => string;
export declare function shiftMonth(key: string, delta: number): string;
export interface PlatformMonthEntry {
    tokens: number;
    cost: number;
}
/** Atomic JSON store for closed-month totals. */
export declare class PlatformMonthCache {
    private readonly dir;
    private readonly file;
    private months;
    private startMonth;
    private queue;
    constructor(dir: string);
    get filePath(): string;
    get(month: string): PlatformMonthEntry | undefined;
    /** Oldest month known to contain data (null when still unknown). */
    get knownStart(): string | null;
    set(month: string, entry: PlatformMonthEntry): void;
    setStart(month: string): void;
    private scheduleSave;
    flush(): Promise<void>;
}
/** Drop day buckets later than `todayKey` (the month payload includes them). */
export declare function trimAfter(days: readonly PlatformDayPoint[], todayKey: string): PlatformDayPoint[];
/** Drop model rows the platform reports with no usage (legacy/retired names). */
export declare function pruneEmptyModels(rows: readonly PlatformModelRow[]): PlatformModelRow[];
/** Drop months with no usage, so "N 个月" counts months that actually billed. */
export declare function pruneEmptyMonths(months: readonly PlatformMonthPoint[]): PlatformMonthPoint[];
/** Snapshot used while the first background refresh is still running. */
export declare function platformPlaceholder(at: number, status?: PlatformStatus, message?: string | null): PlatformSpend;
export interface BuildPlatformArgs {
    enabled: boolean;
    token: string | undefined;
    historyMonths: number;
    cache: PlatformMonthCache;
    nowMs?: number;
    options?: PlatformRequestOptions;
}
export declare function buildPlatformSpend(args: BuildPlatformArgs): Promise<PlatformSpend>;
