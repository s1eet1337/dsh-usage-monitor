/**
 * HTTP transport shared by every provider adapter: bounded timeout (default
 * 5s) and bounded retry (default 3 attempts) per the plugin requirements.
 * Pure fetch wrapper — no node:* imports so the same code would work anywhere.
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export async function httpRequest(args) {
    const timeoutMs = args.timeoutMs ?? 5_000;
    const maxRetries = Math.max(0, Math.min(5, args.retries ?? 3));
    let last;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        let controller = null;
        let timer;
        try {
            controller = new AbortController();
            timer = setTimeout(() => controller?.abort(), timeoutMs);
            const res = await fetch(args.url, {
                method: args.method ?? 'GET',
                headers: { accept: 'application/json', ...args.headers },
                body: args.method === 'POST' ? args.body : undefined,
                signal: controller.signal,
            });
            const text = await res.text();
            const retryable = res.status === 429 || res.status >= 500;
            if (retryable && attempt < maxRetries) {
                await sleep(250 * 2 ** attempt);
                continue;
            }
            return { status: res.status, ok: res.ok, text };
        }
        catch (err) {
            last = err;
            const aborted = err.name === 'AbortError';
            if (attempt < maxRetries && !aborted) {
                await sleep(250 * 2 ** attempt);
                continue;
            }
            throw aborted
                ? new Error(`请求超时（${timeoutMs}ms）`)
                : new Error(`请求失败：${err?.message ?? String(err)}`);
        }
        finally {
            if (timer !== undefined)
                clearTimeout(timer);
        }
    }
    throw new Error(`请求失败：${last === undefined ? 'unknown' : String(last)}`);
}
/** Parse JSON defensively; returns null instead of throwing. */
export function parseJson(text) {
    try {
        return JSON.parse(text);
    }
    catch {
        return null;
    }
}
export function httpError(code, statusOrMessage) {
    if (typeof statusOrMessage === 'number') {
        return statusOrMessage === 401 || statusOrMessage === 403
            ? '认证失败（HTTP 401/403）：请检查 API Key'
            : `接口返回错误（HTTP ${statusOrMessage}）`;
    }
    return String(statusOrMessage);
}
