import { ProviderAdapter } from "./types.js";
import { MimoAdapter } from "./mimo.js";
import { SiliconFlowAdapter } from "./siliconflow.js";
import { FishAudioAdapter } from "./fishaudio.js";
import { ElevenLabsAdapter } from "./elevenlabs.js";
import { OpenAIAdapter } from "./openai.js";
import { VolcengineAdapter } from "./volcengine.js";
import { CustomAdapter } from "./custom.js";

export * from "./types.js";
export { MimoAdapter } from "./mimo.js";
export { SiliconFlowAdapter } from "./siliconflow.js";
export { FishAudioAdapter } from "./fishaudio.js";
export { ElevenLabsAdapter } from "./elevenlabs.js";
export { OpenAIAdapter } from "./openai.js";
export { VolcengineAdapter } from "./volcengine.js";
export { CustomAdapter } from "./custom.js";

const adapters: Record<string, ProviderAdapter> = {
  mimo: new MimoAdapter(),
  siliconflow: new SiliconFlowAdapter(),
  fishaudio: new FishAudioAdapter(),
  elevenlabs: new ElevenLabsAdapter(),
  openai: new OpenAIAdapter(),
  volcengine: new VolcengineAdapter(),
  custom: new CustomAdapter()
};

export function getProviderAdapter(providerId?: string): ProviderAdapter {
  const key = (providerId || "mimo").toLowerCase().trim();
  const adapter = adapters[key];
  if (!adapter) {
    console.warn(`[getProviderAdapter] 未识别的服务商 ID "${providerId}"，回退至 MiMo`);
    return adapters.mimo;
  }
  return adapter;
}

export function getAllProviderCapabilities(): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, adapter] of Object.entries(adapters)) {
    result[key] = {
      id: adapter.id,
      name: adapter.name,
      defaultEndpoint: adapter.defaultEndpoint,
      capabilities: adapter.capabilities
    };
  }
  return result;
}
