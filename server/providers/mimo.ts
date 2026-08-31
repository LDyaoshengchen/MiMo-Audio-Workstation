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

const MIMO_ALLOWED_MIMES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave"
]);

export class MimoAdapter implements ProviderAdapter {
  readonly id = "mimo";
  readonly name = "MiMo 官方 API";
  readonly defaultEndpoint = "https://api.xiaomimimo.com/v1/chat/completions";
  readonly capabilities: ProviderCapabilities = {
    textOptimization: true,
    presetTTS: false,
    voiceDesign: true,
    instantClone: true,
    trainedClone: false,
    asr: false
  };

  async synthesizeVoiceClone(params: VoiceCloneParams, ctx: ProviderContext): Promise<TTSResult> {
    const startedAt = Date.now();
    const endpoint = ctx.apiEndpoint || this.defaultEndpoint;
    const apiKey = ctx.apiKey;

    if (!params.referenceAudioBuffer) {
      throw new Error("MiMo 音色克隆需要上传参考音频文件。");
    }

    const mime = (params.referenceAudioMime || "audio/wav").toLowerCase();
    if (!MIMO_ALLOWED_MIMES.has(mime)) {
      throw new Error(`MiMo 官方接口仅支持 MP3 与 WAV 格式，不支持 ${mime}（已禁止 M4A/MP4 格式）。`);
    }

    // Check base64 size inflation to stay under 10MB upstream limit
    if (params.referenceAudioBuffer.length > 7.5 * 1024 * 1024) {
      throw new Error("参考音频体积过大（最大允许 7.5MB），Base64 编码后将超出厂商 10MB 限制。");
    }

    const audioBase64 = params.referenceAudioBuffer.toString("base64");
    const payload = {
      model: params.model || "mimo-v2.5-tts-voiceclone",
      messages: [
        { role: "user", content: params.instruction || "" },
        { role: "assistant", content: params.text }
      ],
      audio: {
        format: "wav",
        voice: `data:${mime};base64,${audioBase64}`
      }
    };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Authorization": `Bearer ${apiKey}`,
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
      throw new Error(`MiMo API 返回非 JSON 数据 (HTTP ${res.status}): ${resText.slice(0, 300)}`);
    }

    if (!res.ok) {
      const errDetail = data?.error?.message || data?.message || data?.msg || JSON.stringify(data);
      throw new Error(`MiMo 音色克隆失败 (HTTP ${res.status}): ${errDetail}`);
    }

    const b64Data = data?.choices?.[0]?.message?.audio?.data;
    if (!b64Data) {
      throw new Error("MiMo 响应中缺少 choices[0].message.audio.data 音频数据");
    }

    return {
      audioBuffer: Buffer.from(b64Data, "base64"),
      mimeType: "audio/wav",
      format: "wav",
      elapsedMs,
      rawResponse: data,
      redactedRequest: {
        model: payload.model,
        messages: payload.messages,
        audio: { format: "wav", voice: `[BASE64_AUDIO_${params.referenceAudioBuffer.length}_BYTES]` }
      }
    };
  }

  async synthesizeVoiceDesign(params: VoiceDesignParams, ctx: ProviderContext): Promise<TTSResult> {
    const startedAt = Date.now();
    const endpoint = ctx.apiEndpoint || this.defaultEndpoint;
    const apiKey = ctx.apiKey;

    let fullDesc = params.voiceDescription.trim();
    if (params.naturalControl) {
      fullDesc = fullDesc ? `${fullDesc} ${params.naturalControl.trim()}` : params.naturalControl.trim();
    }

    if (!fullDesc) {
      throw new Error("请先填写音色设计描述或自然语言控制。");
    }

    const payload = {
      model: params.model || "mimo-v2.5-tts-voicedesign",
      messages: [
        { role: "user", content: fullDesc },
        { role: "assistant", content: params.text }
      ],
      audio: {
        format: "wav"
      }
    };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Authorization": `Bearer ${apiKey}`,
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
      throw new Error(`MiMo API 返回非 JSON 数据 (HTTP ${res.status}): ${resText.slice(0, 300)}`);
    }

    if (!res.ok) {
      const errDetail = data?.error?.message || data?.message || data?.msg || JSON.stringify(data);
      throw new Error(`MiMo 音色设计失败 (HTTP ${res.status}): ${errDetail}`);
    }

    const b64Data = data?.choices?.[0]?.message?.audio?.data;
    if (!b64Data) {
      throw new Error("MiMo 响应中缺少 choices[0].message.audio.data 音频数据");
    }

    return {
      audioBuffer: Buffer.from(b64Data, "base64"),
      mimeType: "audio/wav",
      format: "wav",
      elapsedMs,
      rawResponse: data,
      redactedRequest: payload
    };
  }

  async optimizePrompt(params: TextOptimizeParams, ctx: ProviderContext): Promise<TextOptimizeResult> {
    const startedAt = Date.now();
    const endpoint = ctx.apiEndpoint || this.defaultEndpoint;
    const apiKey = ctx.apiKey;

    const payload = {
      model: params.model || "mimo-v2-flash",
      messages: [
        { role: "system", content: params.systemPrompt || "你是一个专业的音频语音导演与提示词润色专家。" },
        { role: "user", content: params.prompt }
      ],
      temperature: 0.7
    };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60000)
    });

    const elapsedMs = Date.now() - startedAt;
    const resText = await res.text();
    let data: any;
    try {
      data = JSON.parse(resText);
    } catch {
      throw new Error(`MiMo 文本润色返回非 JSON 数据 (HTTP ${res.status}): ${resText.slice(0, 300)}`);
    }

    if (!res.ok) {
      const errDetail = data?.error?.message || data?.message || data?.msg || JSON.stringify(data);
      throw new Error(`MiMo 文本润色失败 (HTTP ${res.status}): ${errDetail}`);
    }

    const content = data?.choices?.[0]?.message?.content || "";
    return {
      optimizedText: content.trim(),
      elapsedMs,
      rawResponse: data
    };
  }
}
