import { randomUUID } from "node:crypto";
import type { ProviderAdapter, ProviderContext, VoiceCloneParams, VoiceDesignParams, TTSResult, TextOptimizeParams } from "./types.js";
import { normalizeVolcengineOptions, VOLCENGINE_PATHS } from "../../shared/volcengine.js";
import { decodeVolcStream, readVolcResponse, synthesizeVolcWebSocket } from "./volcengineProtocol.js";
import { pcm16ToWav } from "../utils/wav.js";

const ORIGIN = "https://openspeech.bytedance.com";
const badInput = (message: string) => Object.assign(new Error(message), { status: 400 });

export function volcHeaders(ctx: ProviderContext, resourceId?: string): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json", "X-Api-Request-Id": randomUUID() };
  if (ctx.appId && ctx.accessToken && (!ctx.apiKey || ctx.apiKey === ctx.accessToken)) {
    headers["X-Api-App-Id"] = ctx.appId;
    headers["X-Api-Access-Key"] = ctx.accessToken;
  } else {
    if (!ctx.apiKey) throw badInput("请填写火山引擎 API Key。");
    headers["X-Api-Key"] = ctx.apiKey;
  }
  if (resourceId) headers["X-Api-Resource-Id"] = resourceId;
  return headers;
}

export async function volcPost(path: string, body: object, ctx: ProviderContext, headers = volcHeaders(ctx)) {
  const response = await fetch(ORIGIN + path, {
    method: "POST", headers, body: JSON.stringify(body), redirect: "error", signal: AbortSignal.timeout(120_000)
  });
  const text = await readVolcResponse(response);
  let result: any;
  try { result = JSON.parse(text); } catch { throw new Error(`火山引擎返回无效数据（HTTP ${response.status}）。`); }
  if (!response.ok || (result.code !== undefined && ![0, 20000000, 3000].includes(result.code))) {
    let message = String(result.message || "").replace(/https?:\/\/\S+/g, "[链接]");
    for (const secret of [ctx.apiKey, ctx.accessToken]) if (secret) message = message.split(secret).join("[已隐藏]");
    message = message.slice(0, 300);
    throw new Error(`火山引擎请求失败（HTTP ${response.status}，代码 ${result.code ?? "未知"}）：${message}`);
  }
  return result;
}

export class VolcengineAdapter implements ProviderAdapter {
  readonly id = "volcengine";
  readonly name = "火山引擎（豆包语音）";
  readonly defaultEndpoint = ORIGIN + VOLCENGINE_PATHS.http;
  readonly capabilities = { textOptimization: false, presetTTS: true, voiceDesign: true, instantClone: true, trainedClone: true, asr: false };

  async synthesizeVoiceClone(params: VoiceCloneParams, ctx: ProviderContext): Promise<TTSResult> {
    const startedAt = Date.now();
    const options = normalizeVolcengineOptions(ctx.volcengine ?? { transport: ctx.apiEndpoint?.endsWith("/api/v1/tts") ? "legacy" : "http" });
    const transport = options.transport!;
    const format = params.format === "mp3" ? "mp3" : "wav";
    if (!params.text.trim()) throw badInput("合成文本不能为空。");
    if (params.text.length > (transport === "create" ? 3000 : 10000)) throw badInput("合成文本过长，请拆分句段。");
    if (params.referenceAudioBuffer && transport !== "create") {
      throw badInput("参考音频直接生成请选择 Seed-Audio；固定音色请先在火山音色工具中注册，再使用 Voice ID 合成。");
    }
    if (transport === "create") return this.createAudio(params, ctx);
    if (transport === "legacy" || transport === "legacyWebsocket") {
      if (!ctx.appId || !(ctx.accessToken || ctx.apiKey)) throw badInput("旧版接口需要 AppID 与 AccessToken。");
      const token = ctx.accessToken || ctx.apiKey;
      const payload = {
        app: { appid: ctx.appId, token, cluster: options.cluster },
        user: { uid: "mimo_workstation_user" },
        audio: { voice_type: params.voiceId || "BV001_streaming", encoding: format, speed_ratio: params.speed || 1 },
        request: { reqid: randomUUID(), text: params.text, operation: transport === "legacy" ? "query" : "submit" }
      };
      const headers = { Authorization: `Bearer; ${token}`, "Content-Type": "application/json" };
      const audioBuffer = transport === "legacy"
        ? Buffer.from((await volcPost(VOLCENGINE_PATHS.legacy, payload, ctx, headers)).data || "", "base64")
        : await synthesizeVolcWebSocket(ORIGIN.replace("https:", "wss:") + VOLCENGINE_PATHS.legacyWebsocket, headers, payload, randomUUID(), false, true);
      if (!audioBuffer.length) throw new Error("火山引擎未返回音频。");
      return { audioBuffer, format, mimeType: format === "mp3" ? "audio/mpeg" : "audio/wav", elapsedMs: Date.now() - startedAt };
    }
    const speaker = params.voiceId || options.speakerId || "zh_female_vv_uranus_bigtts";
    const payload = {
      user: { uid: "mimo_workstation_user" },
      req_params: {
        text: params.text, speaker,
        ...(params.model ? { model: params.model } : {}),
        audio_params: { format: format === "wav" ? "pcm" : "mp3", sample_rate: 24000,
          speech_rate: Math.round((Math.min(2, Math.max(0.5, params.speed || 1)) - 1) * 100) },
        additions: JSON.stringify(params.instruction?.trim() ? { context_texts: [params.instruction.trim()] } : {})
      }
    };
    const headers = volcHeaders(ctx, options.resourceId);
    let audio: Buffer;
    if (transport === "websocket" || transport === "bidirectional") {
      audio = await synthesizeVolcWebSocket(ORIGIN.replace("https:", "wss:") + VOLCENGINE_PATHS[transport],
        headers, payload, randomUUID(), transport === "bidirectional", false);
    } else {
      const response = await fetch(ORIGIN + VOLCENGINE_PATHS[transport], {
        method: "POST", headers, body: JSON.stringify(payload), redirect: "error", signal: AbortSignal.timeout(120_000)
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error(`火山引擎合成失败（HTTP ${response.status}），请检查 API Key、资源 ID 和音色权限。`);
      }
      audio = decodeVolcStream(await readVolcResponse(response), transport === "sse");
    }
    return { audioBuffer: format === "wav" ? pcm16ToWav(audio, 24000) : audio, format,
      mimeType: format === "mp3" ? "audio/mpeg" : "audio/wav", elapsedMs: Date.now() - startedAt };
  }

  async createAudio(params: VoiceCloneParams, ctx: ProviderContext): Promise<TTSResult> {
    const startedAt = Date.now();
    const format = params.format === "mp3" ? "mp3" : "wav";
    if (params.referenceAudioBuffer && params.referenceAudioBuffer.length > 10 * 1024 * 1024) throw badInput("参考音频不能超过 10 MB。");
    const prompt = [params.instruction?.trim(), params.referenceAudioBuffer ? "@音频1 的声音朗读以下台词：" : "朗读以下台词：", params.text].filter(Boolean).join("\n");
    if (prompt.length > 3000) throw badInput("Seed-Audio 提示词与台词合计不能超过 3000 字符。");
    const result = await volcPost(VOLCENGINE_PATHS.create, {
      model: "seed-audio-1.0", text_prompt: prompt,
      ...(params.referenceAudioBuffer ? { references: [{ audio_data: params.referenceAudioBuffer.toString("base64") }] }
        : params.voiceId ? { references: [{ speaker: params.voiceId }] } : {}),
      audio_config: { format, sample_rate: 24000 }
    }, ctx);
    if (typeof result.audio !== "string" || !result.audio) throw new Error("Seed-Audio 未返回音频数据。");
    return { audioBuffer: Buffer.from(result.audio, "base64"), format, mimeType: format === "mp3" ? "audio/mpeg" : "audio/wav", elapsedMs: Date.now() - startedAt };
  }

  async synthesizeVoiceDesign(params: VoiceDesignParams, ctx: ProviderContext): Promise<TTSResult> {
    return this.createAudio({ text: params.text, format: params.format,
      instruction: [params.voiceDescription, params.naturalControl, params.instruction].filter(Boolean).join("\n") }, ctx);
  }

  async optimizePrompt(_params: TextOptimizeParams, _ctx: ProviderContext): Promise<never> {
    throw badInput("火山引擎语音接口未接入文本润色。");
  }
}
