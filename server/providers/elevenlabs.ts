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

export class ElevenLabsAdapter implements ProviderAdapter {
  readonly id = "elevenlabs";
  readonly name = "ElevenLabs";
  readonly defaultEndpoint = "https://api.elevenlabs.io/v1/text-to-speech";
  readonly capabilities: ProviderCapabilities = {
    textOptimization: false,
    presetTTS: true,
    voiceDesign: false,
    instantClone: false,
    trainedClone: true,
    asr: false
  };

  async synthesizeVoiceClone(params: VoiceCloneParams, ctx: ProviderContext): Promise<TTSResult> {
    const startedAt = Date.now();
    const voiceId = params.voiceId || "21m00Tcm4TlvDq8ikWAM"; // Default Rachel
    const baseEndpoint = (ctx.apiEndpoint || this.defaultEndpoint).replace(/\/$/, "");
    const requestUrl = baseEndpoint.includes(voiceId) ? baseEndpoint : `${baseEndpoint}/${voiceId}`;
    const apiKey = ctx.apiKey;

    const payload = {
      text: params.text,
      model_id: params.model || "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75
      }
    };

    const res = await fetch(requestUrl, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg"
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(120000)
    });

    const elapsedMs = Date.now() - startedAt;

    if (!res.ok) {
      const errText = await res.text();
      let msg = errText;
      try {
        const json = JSON.parse(errText);
        msg = json.detail?.message || json.detail || errText;
      } catch {}
      throw new Error(`ElevenLabs TTS 合成失败 (HTTP ${res.status}): ${msg}`);
    }

    const arrayBuf = await res.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuf);

    return {
      audioBuffer,
      mimeType: "audio/mpeg",
      format: "mp3",
      elapsedMs,
      redactedRequest: {
        voiceId,
        model_id: payload.model_id,
        text: params.text
      }
    };
  }

  async synthesizeVoiceDesign(params: VoiceDesignParams, ctx: ProviderContext): Promise<TTSResult> {
    throw new Error("ElevenLabs 暂不支持基于自然语言提示词的零样本音色设计，请使用 Voice Library 或克隆声音 ID。");
  }

  async optimizePrompt(params: TextOptimizeParams, ctx: ProviderContext): Promise<TextOptimizeResult> {
    throw new Error("ElevenLabs 服务商专注于音频生成，未提供提示词文本润色接口。");
  }
}
