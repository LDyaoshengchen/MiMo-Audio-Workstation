import {
  ProviderAdapter,
  ProviderCapabilities,
  ProviderContext,
  TTSResult,
  TextOptimizeParams,
  TextOptimizeResult,
  VoiceCloneParams,
  VoiceDesignParams
} from "./types.js";
import { MimoAdapter } from "./mimo.js";
import { OpenAIAdapter } from "./openai.js";
import { FishAudioAdapter } from "./fishaudio.js";
import { SiliconFlowAdapter } from "./siliconflow.js";

export class CustomAdapter implements ProviderAdapter {
  readonly id = "custom";
  readonly name = "自定义 API 接口";
  readonly defaultEndpoint = "https://api.xiaomimimo.com/v1/chat/completions";
  readonly capabilities: ProviderCapabilities = {
    textOptimization: true,
    presetTTS: true,
    voiceDesign: true,
    instantClone: true,
    trainedClone: true,
    asr: false
  };

  private getDelegatedAdapter(ctx: ProviderContext): ProviderAdapter {
    const protocol = ctx.customProtocol || "mimo-chat";
    switch (protocol) {
      case "mimo-chat":
        return new MimoAdapter();
      case "openai-tts":
        return new OpenAIAdapter();
      case "fish-tts":
        return new FishAudioAdapter();
      case "siliconflow":
        return new SiliconFlowAdapter();
      default:
        throw new Error(
          `不支持的自定义协议类型: "${protocol}"。自定义 API 必须显式声明支持的协议: "mimo-chat" | "openai-tts" | "fish-tts" | "siliconflow"`
        );
    }
  }

  async synthesizeVoiceClone(params: VoiceCloneParams, ctx: ProviderContext): Promise<TTSResult> {
    const adapter = this.getDelegatedAdapter(ctx);
    return adapter.synthesizeVoiceClone(params, ctx);
  }

  async synthesizeVoiceDesign(params: VoiceDesignParams, ctx: ProviderContext): Promise<TTSResult> {
    const adapter = this.getDelegatedAdapter(ctx);
    return adapter.synthesizeVoiceDesign(params, ctx);
  }

  async optimizePrompt(params: TextOptimizeParams, ctx: ProviderContext): Promise<TextOptimizeResult> {
    const adapter = this.getDelegatedAdapter(ctx);
    return adapter.optimizePrompt(params, ctx);
  }
}
