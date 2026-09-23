/** TTL memo with in-flight coalescing — mirrors the ecosystem pattern. */
export interface Memo<T> {
    get(): Promise<T>;
    refresh(): Promise<T>;
    /** Current entry without computing (undefined when stale/absent). */
    peek(): {
        value: T;
        setAt: number;
    } | undefined;
    /** Forget the cached entry (the next get recomputes). */
    clear(): void;
}
export declare function memoize<T>(ttlMs: number, compute: () => Promise<T>): Memo<T>;
