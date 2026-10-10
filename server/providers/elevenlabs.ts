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
import { pcm16ToWav } from "../utils/wav.js";
import { assertAudioFormat } from "../../shared/audioValidation.js";

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
    if (params.referenceAudioBuffer) throw Object.assign(new Error("当前适配器不支持即时克隆，请填写已创建的 Voice ID。"), { status: 400 });
    const startedAt = Date.now();
    const voiceId = params.voiceId || "21m00Tcm4TlvDq8ikWAM"; // Default Rachel
    const requestUrl = new URL(ctx.apiEndpoint || this.defaultEndpoint);
    const basePath = requestUrl.pathname.replace(/\/$/, "");
    requestUrl.pathname = basePath.endsWith(`/${voiceId}`) ? basePath : `${basePath}/${encodeURIComponent(voiceId)}`;
    requestUrl.searchParams.set("output_format", "pcm_24000");
    const apiKey = ctx.apiKey;

    const payload = {
      text: params.text,
      model_id: params.model || "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75
      }
    };

    const res = await fetch(requestUrl.toString(), {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        "Accept": "application/octet-stream"
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
    const pcm = Buffer.from(arrayBuf);
    const contentType = res.headers.get("content-type") || "";
    if (/mpeg|mp3|json|text\/|xml/i.test(contentType) || pcm.subarray(0, 3).toString() === "ID3") {
      throw new Error("ElevenLabs 未返回所请求的 PCM 音频，无法生成合法 WAV 文件。");
    }
    let audioBuffer: Buffer;
    if (pcm.subarray(0, 4).toString() === "RIFF") {
      assertAudioFormat(pcm, "wav");
      audioBuffer = pcm;
    } else {
      if (!/audio\/(?:pcm|raw)|application\/octet-stream/i.test(contentType)) throw new Error("ElevenLabs 返回类型不是 PCM，已拒绝将未知内容转换为音频。");
      audioBuffer = pcm16ToWav(pcm, 24000);
    }

    return {
      audioBuffer,
      mimeType: "audio/wav",
      format: "wav",
      elapsedMs,
      redactedRequest: {
        voiceId,
        model_id: payload.model_id,
        text: params.text
      }
    };
  }

  async synthesizeVoiceDesign(params: VoiceDesignParams, ctx: ProviderContext): Promise<TTSResult> {
    throw new Error("ElevenLabs 音色设计暂未接入本项目，请使用 Voice Library 或克隆声音 ID。");
  }

  async optimizePrompt(params: TextOptimizeParams, ctx: ProviderContext): Promise<TextOptimizeResult> {
    throw new Error("ElevenLabs 服务商专注于音频生成，未提供提示词文本润色接口。");
  }
}
