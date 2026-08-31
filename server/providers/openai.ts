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

export class OpenAIAdapter implements ProviderAdapter {
  readonly id = "openai";
  readonly name = "OpenAI Audio";
  readonly defaultEndpoint = "https://api.openai.com/v1/audio/speech";
  readonly capabilities: ProviderCapabilities = {
    textOptimization: true,
    presetTTS: true,
    voiceDesign: false,
    instantClone: false,
    trainedClone: false,
    asr: true
  };

  async synthesizeVoiceClone(params: VoiceCloneParams, ctx: ProviderContext): Promise<TTSResult> {
    const startedAt = Date.now();
    const endpoint = ctx.apiEndpoint || this.defaultEndpoint;
    const apiKey = ctx.apiKey;

    const validVoices = new Set(["alloy", "echo", "fable", "onyx", "nova", "shimmer"]);
    const voice = validVoices.has(params.voiceId || "") ? params.voiceId : "alloy";
    const responseFormat = params.format === "mp3" ? "mp3" : "wav";

    const payload = {
      model: params.model || "tts-1",
      input: params.text,
      voice,
      response_format: responseFormat,
      speed: params.speed || 1.0
    };

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
        msg = json.error?.message || errText;
      } catch {}
      throw new Error(`OpenAI Audio TTS 请求失败 (HTTP ${res.status}): ${msg}`);
    }

    const arrayBuf = await res.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuf);
    const mime = responseFormat === "mp3" ? "audio/mpeg" : "audio/wav";

    return {
      audioBuffer,
      mimeType: mime,
      format: responseFormat,
      elapsedMs,
      redactedRequest: payload
    };
  }

  async synthesizeVoiceDesign(params: VoiceDesignParams, ctx: ProviderContext): Promise<TTSResult> {
    throw new Error("OpenAI 官方 API 仅支持 6 种预置声音 (alloy/echo/fable/onyx/nova/shimmer)，暂不支持自然语言音色设计。");
  }

  async optimizePrompt(params: TextOptimizeParams, ctx: ProviderContext): Promise<TextOptimizeResult> {
    const startedAt = Date.now();
    const chatEndpoint = "https://api.openai.com/v1/chat/completions";
    const apiKey = ctx.apiKey;

    const payload = {
      model: params.model || "gpt-4o-mini",
      messages: [
        { role: "system", content: params.systemPrompt || "你是一个专业的音频语音导演与提示词润色专家。" },
        { role: "user", content: params.prompt }
      ],
      temperature: 0.7
    };

    const res = await fetch(chatEndpoint, {
      method: "POST",
      headers: {
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
      throw new Error(`OpenAI 文本润色返回非 JSON 响应: ${resText.slice(0, 300)}`);
    }

    if (!res.ok) {
      throw new Error(`OpenAI 文本润色失败: ${data?.error?.message || resText}`);
    }

    return {
      optimizedText: (data?.choices?.[0]?.message?.content || "").trim(),
      elapsedMs,
      rawResponse: data
    };
  }
}
