import type { SessionPersistenceLike } from '../context.ts';
import type { UsageCoverage, UsageRecord } from '../core/core.ts';
import type { PricingOverride } from '../core/pricing.ts';
export interface ScanResult {
    records: UsageRecord[];
    coverage: UsageCoverage;
}
/**
 * Fold usage out of the DSH session logs — the harness's own durable record
 * of what every provider/model actually consumed. Attribution:
 *   - `request/header` events carry `data.header.config.{provider,model}` and
 *     apply to every following `assistant/message` event;
 *   - `assistant/message` events carry `data.usage.{inputTokens,…}`;
 *   - `session/title` events name the session (last wins).
 * Records older than the retention window are dropped during the scan so the
 * per-poll work stays bounded.
 */
export declare function scanUsage(persistence: SessionPersistenceLike | undefined, retentionDays: number, pricingOverrides: readonly PricingOverride[], nowMs?: number): Promise<ScanResult>;
