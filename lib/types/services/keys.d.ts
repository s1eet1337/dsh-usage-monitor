import type { CredentialsLike } from '../context.ts';
import type { ProviderMeta } from '../core/core.ts';
export type KeySource = 'credentials' | 'env';
export interface ResolvedKey {
    value: string;
    source: KeySource;
}
/**
 * Resolve one provider's API key WITHOUT storing it: first ask the DSH
 * credentials service (the same store the Settings → Models page writes),
 * then fall back to the process environment. Never logs or persists it.
 */
export declare function resolveProviderKey(credentials: CredentialsLike | undefined, meta: ProviderMeta, envNameOverride: string | undefined): Promise<ResolvedKey | undefined>;
