/**
 * dsh-usage-monitor — shared pure core.
 *
 * This module is intentionally SELF-CONTAINED (zero relative imports) so it can
 * be compiled twice from the same source: once into the Node host bundle
 * (ESM, `src/core/*.ts` imports) and once into the browser client bundle
 * (CJS, extension-less imports). Everything here must stay free of `node:*`
 * and DOM imports.
 */
export type ProviderId = 'deepseek' | 'openai' | 'anthropic' | 'zhipu' | 'moonshot' | 'siliconflow';
export interface ProviderMeta {
    readonly id: ProviderId;
    /** Short display name (used in cards / dropdowns). */
    readonly label: string;
    /** Environment / credentials names tried in order when resolving the key. */
    readonly keyEnv: readonly string[];
    /** Default balance currency when the API response omits one. */
    readonly currencyHint: string;
    /** One line about what the official API can and cannot report. */
    readonly note: string;
    /** Official docs URL for balance/usage lookup. */
    readonly docs: string;
}
export declare const PROVIDERS: readonly ProviderMeta[];
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
export declare function canonicalProvider(id: string): string;
export declare function providerMeta(id: string): ProviderMeta;
export type ProviderStatus = 'ok' | 'missing-key' | 'unsupported' | 'error';
export type AlertLevel = 'ok' | 'warn' | 'critical';
export interface Money {
    amount: number;
    currency: string;
}
export interface BalanceView {
    supported: boolean;
    currency: string;
    amount: number;
    granted: number | null;
    toppedUp: number | null;
    /** Why balance is unavailable (unsupported / http / auth …). */
    reason: string | null;
}
export interface ProviderBudgetView {
    amount: number | null;
    currency: string;
    warnPct: number;
}
export interface ProviderUsageToday {
    total: number;
    input: number;
    output: number;
    cost: number | null;
    calls: number;
}
export interface ProviderView {
    provider: ProviderId;
    label: string;
    keyConfigured: boolean;
    status: ProviderStatus;
    /** Machine-readable error code for the status. */
    error: string | null;
    balance: BalanceView | null;
    budget: ProviderBudgetView | null;
    /** Balance remaining as a fraction of the budget (0..1+), null when unknowable. */
    remainingPct: number | null;
    alert: AlertLevel | null;
    today: ProviderUsageToday | null;
    refreshedAt: number;
}
export interface CurrentSelection {
    provider: string;
    model: string;
}
export interface OverviewData {
    at: number;
    current: CurrentSelection | null;
    providers: ProviderView[];
    /** Account-wide usage today, derived from the harness session logs. */
    today: {
        total: number;
        input: number;
        output: number;
        cost: number | null;
        calls: number;
    } | null;
    usageCoverage: UsageCoverage | null;
    /**
     * DeepSeek 平台实际消费快照（与估算花费并列展示）。null = 未启用/尚未取到；
     * status='loading' 表示 host 正在后台刷新，本次是上一份快照。
     */
    platform: PlatformSpend | null;
}
export interface UsageCoverage {
    listedSessions: number;
    scannedSessions: number;
    usageRecords: number;
    skippedRecords: number;
    failedSessions: number;
    earliestAt: number | null;
    latestAt: number | null;
}
export interface DailyPoint {
    date: string;
    input: number;
    output: number;
    cache: number;
    total: number;
    cost: number | null;
    calls: number;
}
/** One row of the details table (group=day: date × provider × model). */
export interface UsageRow {
    date: string;
    provider: string;
    model: string;
    input: number;
    output: number;
    cache: number;
    total: number;
    cost: number | null;
    calls: number;
    sessions: number;
    topSession: string;
}
/** One row of the details table (group=session). */
export interface SessionRow {
    date: string;
    sessionId: string;
    title: string;
    provider: string;
    model: string;
    input: number;
    output: number;
    cache: number;
    total: number;
    cost: number | null;
    calls: number;
}
export interface UsageData {
    days: number;
    at: number;
    provider: string;
    model: string;
    group: 'day' | 'session';
    daily: DailyPoint[];
    rows: UsageRow[];
    sessionRows: SessionRow[];
    models: string[];
    providers: string[];
    totals: {
        total: number;
        input: number;
        output: number;
        cost: number | null;
        calls: number;
    };
    coverage: UsageCoverage | null;
}
export type PlatformStatus = 'ok'
/** Host 正在后台取数，本次返回的是上一份快照（可能为 null）。 */
 | 'loading' | 'disabled' | 'missing-token' | 'auth' | 'http' | 'network' | 'parse';
export interface PlatformWallet {
    /** 充值余额（normal_wallets）。 */
    normal: number | null;
    /** 赠送余额（bonus_wallets）。 */
    bonus: number | null;
    currency: string;
}
export interface PlatformDayPoint {
    date: string;
    /** 输入 token 合计（含缓存命中 + 未命中）。 */
    input: number;
    cacheHit: number;
    cacheMiss: number;
    output: number;
    total: number;
    /** 平台口径的实际消费（币种见 PlatformSpend.currency）。 */
    cost: number;
}
export interface PlatformModelRow {
    model: string;
    input: number;
    output: number;
    cache: number;
    total: number;
    cost: number;
    /** 该模型占本月消费的比例（0..1）。 */
    share: number;
}
export interface PlatformMonthPoint {
    /** YYYY-MM */
    month: string;
    tokens: number;
    cost: number;
}
export interface PlatformSpend {
    at: number;
    status: PlatformStatus;
    /** status 非 ok/loading 时的人类可读原因。 */
    error: string | null;
    currency: string;
    wallet: PlatformWallet | null;
    /** 平台当前的月份桶（UTC 日界），today 取的就是这一桶。 */
    today: {
        date: string;
        tokens: number;
        cost: number;
    };
    month: {
        month: string;
        tokens: number;
        cost: number;
    };
    /** 全部历史累计（逐月回溯汇总）。 */
    lifetime: {
        cost: number;
        tokens: number;
        months: number;
        complete: boolean;
    };
    /** 本月按模型拆分，按消费降序。 */
    byModel: PlatformModelRow[];
    /** 本月 + 上月逐日（升序），用于趋势图。 */
    daily: PlatformDayPoint[];
    /** 逐月汇总（降序，含本月）。 */
    months: PlatformMonthPoint[];
}
export interface BudgetConfig {
    /** Budget ceiling, in the balance currency of the provider. */
    budget?: number;
    /** Currency override for the budget (defaults to provider currencyHint). */
    currency?: string;
    /** Alert when remaining balance drops to ≤ this percent of the budget. */
    warnPct?: number;
    /** Show / monitor this provider at all. Default true. */
    enabled?: boolean;
    /** Optional override of the balance API URL (proxies / relays). */
    balanceUrl?: string;
}
export interface WebhookConfig {
    url: string;
    /** Optional HMAC-SHA256 secret; header `x-dsh-usage-monitor-signature`. */
    secret?: string;
    /** Cooldown in ms between webhook fires for the same provider. */
    cooldownMs?: number;
    enabled?: boolean;
}
export interface PricingOverride {
    provider: string;
    /** Model name or substring (case-insensitive). */
    model: string;
    /** USD per 1M input tokens. */
    priceIn: number;
    /** USD per 1M output tokens. */
    priceOut: number;
}
/**
 * DeepSeek 开放平台同步配置。
 *
 * 官方 API 不提供消费查询；网页版用量页走的是登录态私有接口，认证凭据是
 * 浏览器 localStorage 里的 `userToken`。该凭据由用户手动粘贴、只保存在本机
 * 配置文件里，并在传给浏览器前置空（与 webhook secret 同等对待）。
 */
export interface DeepSeekPlatformConfig {
    /** 关闭后完全跳过平台同步（不产生任何请求）。 */
    enabled?: boolean;
    /** 累计消费最多向前回溯的月数（1..60）。 */
    historyMonths?: number;
    /** 平台登录态 token。仅 host 持有；GET /config 回传时置空。 */
    userToken?: string;
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
export declare function normalizeUserToken(raw: string): string;
export interface MonitorConfig {
    balances: Record<string, BudgetConfig>;
    webhooks: WebhookConfig[];
    /** Browser poll interval in ms (default 60_000). */
    pollMs: number;
    /** Usage windows offered / persisted (days). Default 90. */
    retentionDays: number;
    /** Per-provider API-key environment overrides. */
    envKeys: Record<string, string>;
    pricing: PricingOverride[];
    /** DeepSeek 平台「实际消费」同步。 */
    deepseekPlatform: DeepSeekPlatformConfig;
    /** Persist path override (mainly for tests / odd installs). */
    storageDir?: string;
}
export declare const DAY_OPTIONS: readonly number[];
export declare function defaultBudgetConfig(provider: ProviderId): BudgetConfig;
export declare function defaultConfig(): MonitorConfig;
export declare function normalizeConfig(raw: unknown): MonitorConfig;
export interface BudgetState {
    amount: number | null;
    currency: string;
    warnPct: number;
}
export declare function budgetFor(config: MonitorConfig, id: string, fallbackCurrency: string): BudgetState;
/**
 * Evaluate the alert level for one provider.
 * - balance known: remaining = balance; remainingPct = balance / budget.
 * - balance unknown but monthly spend estimated and budget set:
 *   remaining ≈ budget − spend (best effort).
 */
export declare function evaluateAlert(args: {
    balanceAmount: number | null;
    spendAmount: number | null;
    budget: BudgetState;
}): {
    level: AlertLevel;
    remainingPct: number | null;
};
export interface UsageRecord {
    at: number;
    provider: string;
    model: string;
    input: number;
    output: number;
    cache: number;
    reasoning: number;
    sessionId: string;
    sessionTitle: string;
    /** Estimated USD cost (reference pricing), null when the model has no rate. */
    cost: number | null;
}
export interface Totals {
    input: number;
    output: number;
    cache: number;
    reasoning: number;
    total: number;
    /** Sum of known (estimated) cost in USD-equivalent; null until any priced. */
    cost: number | null;
    costCalls: number;
    calls: number;
}
export declare const emptyTotals: () => Totals;
export declare function addToTotals(t: Totals, input: number, output: number, cache: number, reasoning: number, cost: number | null): void;
export declare const dayKeyOf: (d: Date) => string;
export declare const dayKeyOfMs: (ms: number) => string;
export declare function dateBefore(now: Date, days: number): Date;
export declare function dayKeysBackTo(now: Date, count: number): string[];
/**
 * Filter records to the trailing `days` calendar days (inclusive), then fold
 * per-day totals. Cost folding: unknown-model records contribute 0 but are
 * counted separately by the caller when needed.
 */
export declare function rollDaily(records: readonly UsageRecord[], days: number, now?: Date): DailyPoint[];
export declare function totalsOf(records: readonly UsageRecord[]): Totals;
/**
 * Group day×provider×model rows (details table) over the trailing window.
 * `sessions` = number of distinct sessions contributing to that group.
 */
export declare function rollRows(records: readonly UsageRecord[], days: number, now?: Date): UsageRow[];
export declare function rollSessionRows(records: readonly UsageRecord[], days: number, now?: Date): SessionRow[];
export declare const pad2: (n: number) => string;
export declare function fmtTokens(n: number): string;
export declare const CURRENCY_SYMBOL: Record<string, string>;
export declare function currencySymbol(currency: string): string;
export declare function fmtMoney(amount: number, currency: string, digits?: number): string;
export declare function fmtPct(v: number | null): string;
export declare function isRecord(v: unknown): v is Record<string, unknown>;
export declare function pickNumber(v: unknown): number | undefined;
export declare function clamp(v: number, min: number, max: number): number;
export declare function errorMessage(err: unknown): string;
