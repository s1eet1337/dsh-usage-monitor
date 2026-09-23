import type { MonitorConfig } from '../core/core.ts';
/** Default plugin state dir: $DSH_HOME/storages/dsh-usage-monitor (CLI: ~/.dsh/…). */
export declare function defaultStorageDir(storageDirOverride?: string): string;
/**
 * Config persisted to `<storageDir>/config.json`.
 *
 * Precedence: row config (cordis.patch.yml) seeds the file the first time;
 * afterwards the file (written by the Settings UI / the config API) is the
 * source of truth. Writes are serialised and atomic (tmp + rename).
 */
export declare class ConfigStore {
    private readonly file;
    private config;
    private queue;
    constructor(storageDir: string, rowConfig: unknown);
    get filePath(): string;
    get(): MonitorConfig;
    /** Merge a partial patch (already validated shape-wise by normalizeConfig). */
    update(patch: unknown): MonitorConfig;
    private scheduleSave;
    flush(): Promise<void>;
}
export declare function cloneDefaultConfig(): MonitorConfig;
