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

export class FishAudioAdapter implements ProviderAdapter {
  readonly id = "fishaudio";
  readonly name = "Fish Audio";
  readonly defaultEndpoint = "https://api.fish.audio/v1/tts";
  readonly capabilities: ProviderCapabilities = {
    textOptimization: false,
    presetTTS: true,
    voiceDesign: false,
    instantClone: true,
    trainedClone: true,
    asr: false
  };

  async synthesizeVoiceClone(params: VoiceCloneParams, ctx: ProviderContext): Promise<TTSResult> {
    const startedAt = Date.now();
    const endpoint = ctx.apiEndpoint || this.defaultEndpoint;
    const apiKey = ctx.apiKey;

    const payload: any = {
      text: params.text,
      format: params.format === "mp3" ? "mp3" : "wav"
    };

    if (params.voiceId) {
      payload.reference_id = params.voiceId;
    }

    if (params.referenceAudioBuffer) {
      payload.references = [
        {
          audio: params.referenceAudioBuffer.toString("base64"),
          text: params.instruction || ""
        }
      ];
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
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
        msg = json.message || json.detail || errText;
      } catch {}
      throw new Error(`Fish Audio TTS 请求失败 (HTTP ${res.status}): ${msg}`);
    }

    const arrayBuf = await res.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuf);
    const mime = payload.format === "mp3" ? "audio/mpeg" : "audio/wav";

    return {
      audioBuffer,
      mimeType: mime,
      format: payload.format,
      elapsedMs,
      redactedRequest: {
        text: params.text,
        reference_id: params.voiceId,
        format: payload.format,
        hasReferences: Boolean(params.referenceAudioBuffer)
      }
    };
  }

  async synthesizeVoiceDesign(params: VoiceDesignParams, ctx: ProviderContext): Promise<TTSResult> {
    throw new Error("Fish Audio 暂不支持自然语言提示词音色设计，支持即时声音样本克隆与预置模型 ID。");
  }

  async optimizePrompt(params: TextOptimizeParams, ctx: ProviderContext): Promise<TextOptimizeResult> {
    throw new Error("Fish Audio 服务商未提供文本大模型润色接口。");
  }
}
