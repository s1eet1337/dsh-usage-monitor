/**
 * HTTP transport shared by every provider adapter: bounded timeout (default
 * 5s) and bounded retry (default 3 attempts) per the plugin requirements.
 * Pure fetch wrapper — no node:* imports so the same code would work anywhere.
 */
export interface HttpArgs {
    url: string;
    method?: 'GET' | 'POST';
    headers?: Record<string, string>;
    body?: string;
    timeoutMs?: number;
    retries?: number;
}
export interface HttpResult {
    status: number;
    ok: boolean;
    /** Raw response body (never throws on parse). */
    text: string;
}
export declare function httpRequest(args: HttpArgs): Promise<HttpResult>;
/** Parse JSON defensively; returns null instead of throwing. */
export declare function parseJson(text: string): unknown;
export declare function httpError(code: 'auth' | 'http' | 'network', statusOrMessage: number | string): string;
