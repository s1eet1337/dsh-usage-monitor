import type { ProviderAdapter, AdapterOptions } from './types.ts';
import type { ProviderId } from '../core/core.ts';
export declare function hasAdapter(id: string): id is ProviderId;
export declare function getAdapter(id: ProviderId, options?: AdapterOptions): ProviderAdapter;
