import type { MonitorConfig, OverviewData, ProviderView, UsageData, PlatformSpend } from '../core/core.ts';
import type { ScanResult } from './usage.ts';
import type { CredentialsLike, AgentDefaultModelLike } from '../context.ts';
export interface MonitorDeps {
    credentials?: CredentialsLike;
    agentDefaultModel?: AgentDefaultModelLike;
}
export interface BuildUsageParams {
    days: number;
    provider: string;
    model: string;
    group: 'day' | 'session';
}
export declare function buildOverview(config: MonitorConfig, deps: MonitorDeps, scan: () => Promise<ScanResult>, nowMs?: number, platform?: PlatformSpend | null): Promise<OverviewData>;
export declare function buildUsage(scan: () => Promise<ScanResult>, params: BuildUsageParams, nowMs?: number): Promise<UsageData>;
export declare function balanceMoney(view: ProviderView): {
    amount: number;
    currency: string;
} | null;
