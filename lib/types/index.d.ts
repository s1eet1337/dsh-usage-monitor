import type { HostContext } from './context.ts';
/** Plugin identity for the cordis.patch.yml row (and the client bundle id). */
export declare const name = "dsh-usage-monitor";
/**
 * NO hard service dependency.
 *
 * Declaring `inject: ['webServer']` makes the loader defer apply() until that
 * exact service name exists; on a harness that names or defers it differently
 * the row would silently never load, with no diagnostic at all. Instead this
 * row always applies, mounts its API the moment a web server appears (see
 * `mountRoutes`), and reports what the running harness actually provides
 * through the contract check below. Every other service was already read
 * lazily per call.
 */
export declare const inject: string[];
export declare function apply(ctx: HostContext, rawConfig?: unknown): void;
