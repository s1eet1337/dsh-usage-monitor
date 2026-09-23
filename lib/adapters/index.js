import { createDeepSeekAdapter } from "./deepseek.js";
import { createOpenAiAdapter } from "./openai.js";
import { createAnthropicAdapter } from "./anthropic.js";
import { createZhipuAdapter } from "./zhipu.js";
import { createMoonshotAdapter } from "./moonshot.js";
import { createSiliconFlowAdapter } from "./siliconflow.js";
const REGISTRY = {
    deepseek: () => createDeepSeekAdapter(),
    openai: () => createOpenAiAdapter(),
    anthropic: () => createAnthropicAdapter(),
    zhipu: () => createZhipuAdapter(),
    moonshot: () => createMoonshotAdapter(),
    siliconflow: () => createSiliconFlowAdapter(),
};
export function hasAdapter(id) {
    return id in REGISTRY;
}
export function getAdapter(id, options) {
    const factory = REGISTRY[id];
    if (factory === undefined) {
        throw new Error(`没有为 provider "${id}" 注册适配器`);
    }
    return factory(options);
}
