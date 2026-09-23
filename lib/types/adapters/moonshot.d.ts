import type { AdapterOptions, ProviderAdapter, RemoteUsageOutcome } from './types.ts';
export declare const DEFAULT_BASE = "https://api.moonshot.cn";
export declare const KIMI_CODING_USAGE_URL = "https://api.kimi.com/coding/v1/usages";
export declare function createMoonshotAdapter(): ProviderAdapter;
/**
 * Kimi Coding 订阅用量（独立于普通 API Key）——为 kimi-coding provider 预留。
 * 需要 KIMI_CODING_API_KEY 类订阅凭据；普通 MOONSHOT_API_KEY 用不到它。
 */
export declare function fetchKimiCodingUsage(apiKey: string, options?: AdapterOptions): Promise<RemoteUsageOutcome>;
