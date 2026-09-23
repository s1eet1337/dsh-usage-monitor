import type { MonitorConfig, ProviderView } from '../core/core.ts';
/**
 * Host-side alert router.
 *
 * Watches provider alert levels between overview refreshes and fires enabled
 * webhooks when a provider ENTERS `warn`/`critical` (or escalates
 * `warn → critical`). Continuous alerts do not re-fire on every poll — only on
 * level changes. Best-effort: a failed webhook is logged, never fatal.
 */
export declare class AlertNotifier {
    private readonly config;
    private readonly now;
    private readonly last;
    private readonly cooldownUntil;
    constructor(config: () => MonitorConfig, now?: () => number);
    process(providers: readonly ProviderView[]): void;
    private dispatch;
}
