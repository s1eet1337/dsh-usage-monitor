/**
 * Structural service faces this plugin reads from the host Cordis context.
 *
 * Deliberately minimal (mirroring the convention used by ecosystem plugins):
 * only the members this plugin touches are declared, so the package builds
 * without importing `@deepseek-ai/cordis` type packages. The real runtime
 * objects satisfy these faces structurally.
 */
export interface RouteRequest {
    method?: string;
    url?: string;
    headers: Record<string, string | string[] | undefined>;
}
export interface RouteResponse {
    writeHead(status: number, headers?: Record<string, string>): unknown;
    end(chunk?: unknown): unknown;
}
export interface WebRouteDef {
    kind: 'exact' | 'prefix';
    path: string;
    handler: (req: RouteRequest, res: RouteResponse) => void | Promise<void>;
}
export interface WebServerLike {
    register(def: WebRouteDef): () => void;
}
export interface ResolvedCredential {
    value: string;
    source: string;
}
export interface CredentialsLike {
    resolve(ref: string): Promise<ResolvedCredential | undefined>;
}
export interface SessionHeaderRecord {
    id?: string;
    sessionId?: string;
}
export interface UsageEventData {
    inputTokens?: number;
    outputTokens?: number;
    cacheReadTokens?: number;
    reasoningTokens?: number;
}
export interface SessionEventData {
    title?: string;
    usage?: UsageEventData;
    header?: {
        config?: {
            provider?: string;
            model?: string;
        };
    };
    message?: {
        id?: string;
    };
    turn?: number;
    step?: number;
}
export interface SessionEventRecord {
    type?: string;
    time?: number;
    data?: SessionEventData;
}
/** One listing row: current builds return a snapshot carrying its header. */
export interface SessionSnapshotLike {
    header?: SessionHeaderRecord;
    /** Legacy builds: the listing row WAS the header. */
    id?: string;
    sessionId?: string;
}
/** Read handle returned by `sessionPersistence.open(id, 'read')`. */
export interface SessionReadHandleLike {
    header?: SessionHeaderRecord;
    read(offset: number, length?: number, options?: unknown): Promise<{
        events?: SessionEventRecord[];
    }>;
    close?(): Promise<void> | void;
}
export interface SessionPersistenceLike {
    /** Snapshot listing; each entry carries `header.id` on current builds. */
    list(): Promise<SessionSnapshotLike[]>;
    /**
     * Current builds (verified on harness 0.1.5-rc.2): stored logs are compressed
     * at rest, so events are read through an opened handle
     * (`open` → `read` → `close`). `list()` also returns snapshots, not headers.
     */
    open?(id: string, access: 'read', options?: unknown): Promise<SessionReadHandleLike>;
    /** Older builds exposed a direct sequential reader. */
    readFrom?(id: string, fromSeq: number): Promise<{
        events?: SessionEventRecord[];
    }>;
}
export interface ModelSelectionLike {
    provider?: string;
    model?: string;
}
export interface AgentDefaultModelLike {
    currentSelection(): ModelSelectionLike;
}
/** Minimal Cordis context surface used by the plugin. */
export interface CordisContextLike {
    effect(fn: (() => void) | (() => Promise<void>), label?: string): unknown;
    /**
     * Start `callback` once the named services exist (cordis `ctx.inject` =
     * `ctx.plugin({ inject })`). This is the dependency-declaring wait — unlike a
     * plain event listener it is actually notified when the service appears.
     */
    inject?(deps: string[], callback: (...args: never[]) => void): unknown;
    /**
     * Listen for a cordis event. `options.global` matters for scoped events such
     * as `internal/service`: cordis filters a dispatch against the emitting
     * context unless the listener is global, so a plain listener is dropped.
     */
    on(event: string, listener: (...args: never[]) => void, options?: {
        global?: boolean;
        prepend?: boolean;
    }): (() => void) | void;
    get<K extends string>(key: K): unknown;
}
export interface HostContext extends CordisContextLike {
    /** Raw config object from the cordis.patch.yml row (unknown shape). */
    config?: unknown;
}
