import type { ProviderId } from '../core/core.ts';
/** Transport options every adapter honours. */
export interface AdapterOptions {
    /** Base URL override (relays / proxies). Defaults to the provider official base. */
    baseUrl?: string;
    timeoutMs?: number;
    retries?: number;
    /** Extra headers merged into every request (e.g. `anthropic-version`). */
    headers?: Record<string, string>;
}
export interface BalancePayload {
    currency: string;
    amount: number;
    granted: number | null;
    toppedUp: number | null;
}
export type BalanceOutcome = {
    ok: true;
    data: BalancePayload;
} | {
    ok: false;
    code: 'unsupported' | 'missing-key' | 'auth' | 'http' | 'network' | 'parse';
    message: string;
};
export interface RemoteUsagePayload {
    /** When a provider exposes a spend/usage endpoint, `amount` is the spend. */
    amount: number | null;
    currency: string | null;
    input: number | null;
    output: number | null;
    total: number | null;
}
export type RemoteUsageOutcome = {
    ok: true;
    data: RemoteUsagePayload | null;
} | {
    ok: false;
    code: 'unsupported' | 'missing-key' | 'auth' | 'http' | 'network' | 'parse';
    message: string;
};
/**
 * The adapter contract the monitor core engine drives.
 *
 * `getUsage(apiKey, period)` returns remote spend/usage when the provider
 * exposes an API for it; for providers without one it resolves to
 * `{ ok: true, data: null }` and the monitor falls back to the harness's own
 * session-log statistics (which cover every provider the harness actually
 * routes to).
 */
export interface ProviderAdapter {
    readonly id: ProviderId;
    getBalance(apiKey: string, options?: AdapterOptions): Promise<BalanceOutcome>;
    getUsage(apiKey: string, period: 'day' | 'month', options?: AdapterOptions): Promise<RemoteUsageOutcome>;
    validateKey(apiKey: string, options?: AdapterOptions): Promise<boolean>;
}
export declare const unsupportedOutcome: (id: ProviderId, docs: string) => BalanceOutcome;
