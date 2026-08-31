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

export class SiliconFlowAdapter implements ProviderAdapter {
  readonly id = "siliconflow";
  readonly name = "SiliconFlow 硅基流动";
  readonly defaultEndpoint = "https://api.siliconflow.cn/v1/audio/speech";
  readonly capabilities: ProviderCapabilities = {
    textOptimization: true,
    presetTTS: true,
    voiceDesign: false,
    instantClone: true,
    trainedClone: false,
    asr: false
  };

  async synthesizeVoiceClone(params: VoiceCloneParams, ctx: ProviderContext): Promise<TTSResult> {
    const startedAt = Date.now();
    const endpoint = ctx.apiEndpoint || this.defaultEndpoint;
    const apiKey = ctx.apiKey;

    const model = params.model || "FunAudioLLM/CosyVoice2-0.5B";
    const responseFormat = params.format === "mp3" ? "mp3" : "wav";

    let voiceParam = params.voiceId || "FunAudioLLM/CosyVoice2-0.5B:alex";
    let references: any[] | undefined;

    if (params.referenceAudioBuffer) {
      const mime = (params.referenceAudioMime || "audio/wav").toLowerCase();
      const audioB64 = params.referenceAudioBuffer.toString("base64");
      const audioUri = `data:${mime};base64,${audioB64}`;
      references = [
        {
          audio: audioUri,
          text: params.instruction || params.text
        }
      ];
      // For models accepting custom voice data
      voiceParam = audioUri;
    }

    const payload: any = {
      model,
      input: params.text,
      voice: voiceParam,
      response_format: responseFormat,
      speed: params.speed || 1.0
    };

    if (references) {
      payload.references = references;
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
        msg = json.message || json.error?.message || errText;
      } catch {}
      throw new Error(`SiliconFlow 音频合成失败 (HTTP ${res.status}): ${msg}`);
    }

    const contentType = res.headers.get("content-type") || "";
    let audioBuffer: Buffer;

    if (contentType.includes("json")) {
      const json = await res.json() as any;
      if (json.audio) {
        audioBuffer = Buffer.from(json.audio, "base64");
      } else if (json.data?.[0]?.b64_json) {
        audioBuffer = Buffer.from(json.data[0].b64_json, "base64");
      } else {
        throw new Error("SiliconFlow 响应未包含有效音频数据");
      }
    } else {
      const arrayBuf = await res.arrayBuffer();
      audioBuffer = Buffer.from(arrayBuf);
    }

    const mime = responseFormat === "mp3" ? "audio/mpeg" : "audio/wav";
    return {
      audioBuffer,
      mimeType: mime,
      format: responseFormat,
      elapsedMs,
      redactedRequest: {
        model,
        input: params.text,
        response_format: responseFormat,
        hasReference: Boolean(params.referenceAudioBuffer)
      }
    };
  }

  async synthesizeVoiceDesign(params: VoiceDesignParams, ctx: ProviderContext): Promise<TTSResult> {
    throw new Error("SiliconFlow 暂未提供基于自然语言提示词的音色设计能力（建议切换至 MiMo 模型）。");
  }

  async optimizePrompt(params: TextOptimizeParams, ctx: ProviderContext): Promise<TextOptimizeResult> {
    const startedAt = Date.now();
    const chatEndpoint = "https://api.siliconflow.cn/v1/chat/completions";
    const apiKey = ctx.apiKey;

    const payload = {
      model: params.model || "Qwen/Qwen2.5-7B-Instruct",
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
      throw new Error(`SiliconFlow 文本润色返回非 JSON 数据: ${resText.slice(0, 300)}`);
    }

    if (!res.ok) {
      throw new Error(`SiliconFlow 文本润色失败 (HTTP ${res.status}): ${data?.message || resText}`);
    }

    return {
      optimizedText: (data?.choices?.[0]?.message?.content || "").trim(),
      elapsedMs,
      rawResponse: data
    };
  }
}
