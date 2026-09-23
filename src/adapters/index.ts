import type { ProviderAdapter, AdapterOptions } from './types.ts'
import { createDeepSeekAdapter } from './deepseek.ts'
import { createOpenAiAdapter } from './openai.ts'
import { createAnthropicAdapter } from './anthropic.ts'
import { createZhipuAdapter } from './zhipu.ts'
import { createMoonshotAdapter } from './moonshot.ts'
import { createSiliconFlowAdapter } from './siliconflow.ts'
import type { ProviderId } from '../core/core.ts'

type Factory = (options?: AdapterOptions) => ProviderAdapter

const REGISTRY: Record<ProviderId, Factory> = {
  deepseek: () => createDeepSeekAdapter(),
  openai: () => createOpenAiAdapter(),
  anthropic: () => createAnthropicAdapter(),
  zhipu: () => createZhipuAdapter(),
  moonshot: () => createMoonshotAdapter(),
  siliconflow: () => createSiliconFlowAdapter(),
}

export function hasAdapter(id: string): id is ProviderId {
  return id in REGISTRY
}

export function getAdapter(id: ProviderId, options?: AdapterOptions): ProviderAdapter {
  const factory = REGISTRY[id]
  if (factory === undefined) {
    throw new Error(`没有为 provider "${id}" 注册适配器`)
  }
  return factory(options)
}
