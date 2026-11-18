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

const MIMO_TTS_TIMEOUT_MS = 120_000;
const MIMO_TEXT_TIMEOUT_MS = 60_000;
const MIMO_MAX_RATE_LIMIT_RETRIES = 2;

async function fetchMimo(endpoint: string, apiKey: string, payload: unknown, timeoutMs: number): Promise<Response> {
  for (let attempt = 0; ; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          // MiMo documents api-key and Bearer as alternatives; send exactly one.
          "api-key": apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs)
      });
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        const seconds = Math.round(timeoutMs / 1000);
        throw new Error(`MiMo 请求超过 ${seconds} 秒仍未返回，已停止等待；可缩短文本或稍后重试。`);
      }
      throw error;
    }

    if (response.status !== 429 || attempt >= MIMO_MAX_RATE_LIMIT_RETRIES) return response;

    const retryAfter = Number(response.headers.get("retry-after"));
    const delayMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? Math.min(retryAfter * 1000, 10_000)
      : Math.min(1_000 * 2 ** attempt, 4_000);
    await response.body?.cancel();
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

export class MimoAdapter implements ProviderAdapter {
  readonly id = "mimo";
  readonly name = "MiMo 官方 API";
  readonly defaultEndpoint = "https://api.xiaomimimo.com/v1/chat/completions";
  readonly capabilities: ProviderCapabilities = {
    textOptimization: true,
    presetTTS: true,
    voiceDesign: true,
    instantClone: true,
    trainedClone: false,
    asr: false
  };

  async synthesizeVoiceClone(params: VoiceCloneParams, ctx: ProviderContext): Promise<TTSResult> {
    const startedAt = Date.now();
    const endpoint = ctx.apiEndpoint || this.defaultEndpoint;
    const apiKey = ctx.apiKey;

    const isPreset = !params.referenceAudioBuffer;
    const mime = (params.referenceAudioMime || "audio/wav").toLowerCase();
    if (!isPreset && !MIMO_ALLOWED_MIMES.has(mime)) {
      throw new Error(`MiMo 官方接口仅支持 MP3 与 WAV 格式，不支持 ${mime}（已禁止 M4A/MP4 格式）。`);
    }

    if (!isPreset && params.referenceAudioBuffer!.length > 7.5 * 1024 * 1024) {
      throw new Error("参考音频体积过大（最大允许 7.5MB），Base64 编码后将超出厂商 10MB 限制。");
    }

    const voice = isPreset
      ? (params.voiceId || "mimo_default")
      : `data:${mime};base64,${params.referenceAudioBuffer!.toString("base64")}`;
    const payload = {
      model: params.model || (isPreset ? "mimo-v2.5-tts" : "mimo-v2.5-tts-voiceclone"),
      messages: [
        ...(isPreset && !params.instruction?.trim() ? [] : [{ role: "user" as const, content: params.instruction || "" }]),
        { role: "assistant" as const, content: params.text }
      ],
      audio: {
        format: "wav",
        voice
      }
    };

    const res = await fetchMimo(endpoint, apiKey, payload, MIMO_TTS_TIMEOUT_MS);

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
        audio: { format: "wav", voice: isPreset ? voice : `[BASE64_AUDIO_${params.referenceAudioBuffer!.length}_BYTES]` }
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

    const res = await fetchMimo(endpoint, apiKey, payload, MIMO_TTS_TIMEOUT_MS);

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
      model: params.model || "mimo-v2.5-pro",
      messages: [
        { role: "system", content: params.systemPrompt || "你是一个专业的音频语音导演与提示词润色专家。" },
        { role: "user", content: params.prompt }
      ],
      temperature: 0.7
    };

    const res = await fetchMimo(endpoint, apiKey, payload, MIMO_TEXT_TIMEOUT_MS);

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
