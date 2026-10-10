import { ProviderAdapter } from "./types.js";
import { MimoAdapter } from "./mimo.js";
import { SiliconFlowAdapter } from "./siliconflow.js";
import { FishAudioAdapter } from "./fishaudio.js";
import { ElevenLabsAdapter } from "./elevenlabs.js";
import { OpenAIAdapter } from "./openai.js";
import { VolcengineAdapter } from "./volcengine.js";
import { CustomAdapter } from "./custom.js";
import { assertAudioFormat } from "../../shared/audioValidation.js";

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

for (const adapter of Object.values(adapters)) {
  for (const method of ["synthesizeVoiceClone", "synthesizeVoiceDesign"] as const) {
    const original = adapter[method].bind(adapter) as (...args: any[]) => Promise<import("./types.js").TTSResult>;
    adapter[method] = async (...args: any[]) => {
      const result = await original(...args);
      try { assertAudioFormat(result.audioBuffer, result.format); }
      catch (error) { throw Object.assign(new Error(`${adapter.name}：${error instanceof Error ? error.message : "音频无效"}`), { status: 502 }); }
      return result;
    };
  }
}

export function getProviderAdapter(providerId?: string): ProviderAdapter {
  const key = (providerId || "mimo").toLowerCase().trim();
  const adapter = adapters[key];
  if (!adapter) {
    throw Object.assign(new Error(`未知服务商: ${providerId}`), { status: 400 });
  }
  return adapter;
}

export function getEffectiveProviderAdapter(ctx: { apiProvider?: string; customProtocol?: string }): ProviderAdapter {
  if (ctx.apiProvider !== "custom") return getProviderAdapter(ctx.apiProvider);
  const protocols: Record<string, string> = { "mimo-chat": "mimo", "openai-tts": "openai", "fish-tts": "fishaudio", siliconflow: "siliconflow" };
  const provider = protocols[ctx.customProtocol || ""];
  if (!provider) throw Object.assign(new Error("自定义 API 必须显式选择有效协议。"), { status: 400 });
  return getProviderAdapter(provider);
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
