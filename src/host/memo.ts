/** TTL memo with in-flight coalescing — mirrors the ecosystem pattern. */
export interface Memo<T> {
  get(): Promise<T>
  refresh(): Promise<T>
  /** Current entry without computing (undefined when stale/absent). */
  peek(): { value: T; setAt: number } | undefined
  /** Forget the cached entry (the next get recomputes). */
  clear(): void
}

export function memoize<T>(ttlMs: number, compute: () => Promise<T>): Memo<T> {
  let entry: { value: T; setAt: number } | undefined
  let inflight: Promise<T> | undefined
  const run = (): Promise<T> => {
    if (inflight !== undefined) return inflight
    const task = compute().then(
      (value) => {
        inflight = undefined
        entry = { value, setAt: Date.now() }
        return value
      },
      (err) => {
        inflight = undefined
        throw err
      },
    )
    inflight = task
    return task
  }
  return {
    get(): Promise<T> {
      if (entry !== undefined && Date.now() - entry.setAt < ttlMs) return Promise.resolve(entry.value)
      return run()
    },
    refresh: () => run(),
    peek() {
      return entry
    },
    clear() {
      entry = undefined
    },
  }
}
