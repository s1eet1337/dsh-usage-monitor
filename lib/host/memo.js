export function memoize(ttlMs, compute) {
    let entry;
    let inflight;
    const run = () => {
        if (inflight !== undefined)
            return inflight;
        const task = compute().then((value) => {
            inflight = undefined;
            entry = { value, setAt: Date.now() };
            return value;
        }, (err) => {
            inflight = undefined;
            throw err;
        });
        inflight = task;
        return task;
    };
    return {
        get() {
            if (entry !== undefined && Date.now() - entry.setAt < ttlMs)
                return Promise.resolve(entry.value);
            return run();
        },
        refresh: () => run(),
        peek() {
            return entry;
        },
        clear() {
            entry = undefined;
        },
    };
}
