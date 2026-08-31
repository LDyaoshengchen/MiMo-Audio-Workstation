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

export class VolcengineAdapter implements ProviderAdapter {
  readonly id = "volcengine";
  readonly name = "火山引擎 (字节跳动)";
  readonly defaultEndpoint = "https://openspeech.bytedance.com/api/v1/tts";
  readonly capabilities: ProviderCapabilities = {
    textOptimization: false,
    presetTTS: true,
    voiceDesign: false,
    instantClone: false,
    trainedClone: true,
    asr: true
  };

  async synthesizeVoiceClone(params: VoiceCloneParams, ctx: ProviderContext): Promise<TTSResult> {
    const startedAt = Date.now();
    const endpoint = ctx.apiEndpoint || this.defaultEndpoint;
    const token = ctx.accessToken || ctx.apiKey;
    const appId = ctx.appId || "default_appid";

    const voiceType = params.voiceId || "BV001_streaming";
    const encoding = params.format === "mp3" ? "mp3" : "wav";

    const payload = {
      app: {
        appid: appId,
        token,
        cluster: "volcano_tts"
      },
      user: {
        uid: "mimo_workstation_user"
      },
      audio: {
        voice_type: voiceType,
        encoding,
        speed_ratio: params.speed || 1.0
      },
      request: {
        reqid: `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        text: params.text,
        operation: "query"
      }
    };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer; ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(120000)
    });

    const elapsedMs = Date.now() - startedAt;
    const resText = await res.text();
    let data: any;
    try {
      data = JSON.parse(resText);
    } catch {
      throw new Error(`火山引擎 API 返回非 JSON 数据: ${resText.slice(0, 300)}`);
    }

    if (!res.ok || (data.code && data.code !== 3000)) {
      const errMsg = data.message || data.error || `Error code ${data.code}`;
      throw new Error(`火山引擎 TTS 请求失败: ${errMsg}`);
    }

    const b64Audio = data.data;
    if (!b64Audio) {
      throw new Error("火山引擎响应未包含 data 音频数据");
    }

    const mime = encoding === "mp3" ? "audio/mpeg" : "audio/wav";
    return {
      audioBuffer: Buffer.from(b64Audio, "base64"),
      mimeType: mime,
      format: encoding,
      elapsedMs,
      rawResponse: data,
      redactedRequest: {
        appId,
        voice_type: voiceType,
        encoding,
        text: params.text
      }
    };
  }

  async synthesizeVoiceDesign(params: VoiceDesignParams, ctx: ProviderContext): Promise<TTSResult> {
    throw new Error("火山引擎暂不支持自然语言提示词音色设计，需使用预置音色库或已授权的定制音色 ID。");
  }

  async optimizePrompt(params: TextOptimizeParams, ctx: ProviderContext): Promise<TextOptimizeResult> {
    throw new Error("火山引擎语音服务未提供通用文本润色接口。");
  }
}
