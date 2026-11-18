import type { ProviderAdapter, ProviderContext, VoiceCloneParams, VoiceDesignParams, TextOptimizeParams, TextOptimizeResult, TTSResult } from "./types.js";
import { detectAudioFormat, assertAudioFormat } from "../../shared/audioValidation.js";
import { randomUUID } from "node:crypto";
import { cachedMiniMaxVoice } from "./minimaxVoices.js";
import { parseWavDurationFromBytes } from "../../src/utils/audioDuration.js";

const ORIGIN = "https://api.minimax.cn";
const emotions: Record<string, string> = { happy: "happy", sad: "sad", angry: "angry", fearful: "fearful", disgusted: "disgusted", surprised: "surprised", calm: "calm", "高兴": "happy", "开心": "happy", "悲伤": "sad", "愤怒": "angry", "害怕": "fearful", "厌恶": "disgusted", "惊讶": "surprised", "平静": "calm" };
const fail = (message: string, status = 400) => Object.assign(new Error(message), { status });

export async function miniMaxRequest(path: "/v1/t2a_v2" | "/v1/voice_design" | "/v1/files/upload" | "/v1/voice_clone" | "/v1/get_voice" | "/v1/delete_voice", payload: object | FormData, ctx: ProviderContext) {
  // Only the official origin is contacted; never follow redirects or returned audio URLs.
  if (ctx.apiEndpoint && ctx.apiEndpoint.replace(/\/$/, "") !== `${ORIGIN}/v1/t2a_v2`) throw fail("MiniMax 请使用官方地址 https://api.minimax.cn/v1/t2a_v2。");
  if (!ctx.apiKey) throw fail("请填写 MiniMax API Key。");
  let response: Response;
  try {
    const multipart = payload instanceof FormData;
    response = await fetch(`${ORIGIN}${path}`, { method: "POST", headers: { Authorization: `Bearer ${ctx.apiKey}`, ...(!multipart ? { "Content-Type": "application/json" } : {}) }, body: multipart ? payload as FormData : JSON.stringify(payload), redirect: "error", signal: AbortSignal.timeout(120000) });
  } catch (error) {
    throw fail(error instanceof Error && /timeout|abort/i.test(error.name) ? "MiniMax 请求超过 120 秒，请稍后重试。" : "MiniMax 网络连接失败，请检查网络后重试。", 502);
  }
  if (!response.body) throw fail("MiniMax 返回空响应。", 502);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 64 * 1024 * 1024) throw fail("MiniMax 音频响应超过 64 MB，请缩短文本。", 502);
      chunks.push(value);
    }
  } catch (error) {
    if ((error as { status?: number })?.status) throw error;
    throw fail(error instanceof Error && /timeout|abort/i.test(error.name) ? "MiniMax 请求超过 120 秒，请稍后重试。" : "MiniMax 响应中断，未保存不完整音频，请重试。", 502);
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
  let json: any;
  try { json = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw fail(`MiniMax 返回无效响应（HTTP ${response.status}）。`, 502); }
  const code = json?.base_resp?.status_code;
  if (!response.ok || code !== 0) {
    const hints: Record<number, string> = { 1001: "服务端超时", 1002: "请求过于频繁", 1039: "达到每分钟用量限制", 1004: "密钥无效或权限不足", 1008: "余额不足", 2013: "参数或音色 ID 不合法（新建 ID 不能重复）", 2038: "请先在 MiniMax 平台完成实名认证" };
    // Upstream messages can echo credentials or request contents; only return known safe details.
    const status = response.status === 429 || code === 1002 || code === 1039 ? 429 : 502;
    throw fail(`MiniMax 调用失败（HTTP ${response.status}，代码 ${typeof code === "number" ? code : "未知"}）：${hints[code] || "请检查账户、模型权限与请求参数"}。`, status);
  }
  return json;
}

export function validateMiniMaxSample(bytes: Buffer, fileName: string, prompt = false) {
  if (!bytes.length || bytes.length > 20 * 1024 * 1024) throw fail("克隆音频不能为空，且不能超过 20 MB。");
  const extension = fileName.toLowerCase().split(".").pop();
  if (extension === "m4a") {
    if (bytes.length < 16 || bytes.toString("ascii", 4, 8) !== "ftyp" || !["M4A ", "isom", "mp42", "M4B "].includes(bytes.toString("ascii", 8, 12))) throw fail("M4A 音频文件内容无效。");
  } else {
    if (extension !== "wav" && extension !== "mp3") throw fail("克隆音频仅支持 WAV、MP3、M4A。");
    assertAudioFormat(bytes, extension);
  }
  const duration = parseWavDurationFromBytes(bytes);
  if (duration !== null && (prompt ? duration >= 8 : duration < 10 || duration > 300)) throw fail(prompt ? "示例音频须小于 8 秒。" : "克隆参考音频须为 10 秒至 5 分钟。");
  return extension;
}

export async function cloneMiniMaxVoice(bytes: Buffer, fileName: string, voiceId: string, ctx: ProviderContext, options: { prompt?: { bytes: Buffer; name: string; text: string }; noiseReduction?: boolean; volumeNormalization?: boolean } = {}) {
  if (!/^[a-zA-Z][\w-]{6,254}[a-zA-Z0-9]$/.test(voiceId)) throw fail("新音色 ID 须为 8～256 位，以英文字母开头，以字母或数字结尾，仅含字母、数字、横线、下划线。");
  const extension = validateMiniMaxSample(bytes, fileName);
  if (options.prompt) {
    validateMiniMaxSample(options.prompt.bytes, options.prompt.name, true);
    if (!options.prompt.text.trim() || options.prompt.text.length > 1000) throw fail("请填写示例音频原文（不超过 1000 字符）。");
  }
  const upload = async (buffer: Buffer, ext: string, purpose: string) => {
    const form = new FormData();
    form.append("purpose", purpose);
    form.append("file", new Blob([new Uint8Array(buffer)], { type: ext === "wav" ? "audio/wav" : ext === "mp3" ? "audio/mpeg" : "audio/mp4" }), `sample.${ext}`);
    const result = await miniMaxRequest("/v1/files/upload", form, ctx);
    const id = result.file?.file_id;
    const numericId = typeof id === "string" && /^\d{1,18}$/.test(id) ? Number(id) : id;
    if (typeof numericId !== "number" || !Number.isSafeInteger(numericId) || numericId <= 0) throw fail("MiniMax 上传未返回有效 file_id。", 502);
    return numericId;
  };
  const fileId = await upload(bytes, extension, "voice_clone");
  const promptId = options.prompt ? await upload(options.prompt.bytes, options.prompt.name.toLowerCase().split(".").pop()!, "prompt_audio") : undefined;
  const result = await miniMaxRequest("/v1/voice_clone", { file_id: fileId, voice_id: voiceId,
    ...(promptId ? { clone_prompt: { prompt_audio: promptId, prompt_text: options.prompt!.text } } : {}),
    need_noise_reduction: options.noiseReduction === true, need_volume_normalization: options.volumeNormalization === true }, ctx);
  if (result.input_sensitive === true) throw fail("MiniMax 未通过音色样本审核，请更换参考音频。", 400);
  return voiceId;
}

function audio(hex: unknown): Buffer {
  if (typeof hex !== "string" || !hex.length || hex.length % 2 || !/^[\da-f]+$/i.test(hex)) throw fail("MiniMax 未返回完整的十六进制音频。", 502);
  return Buffer.from(hex, "hex");
}

export class MiniMaxAdapter implements ProviderAdapter {
  readonly id = "minimax";
  readonly name = "MiniMax";
  readonly defaultEndpoint = `${ORIGIN}/v1/t2a_v2`;
  readonly capabilities = { textOptimization: false, presetTTS: true, voiceDesign: true, instantClone: true, trainedClone: true, asr: false };

  async synthesizeVoiceClone(params: VoiceCloneParams, ctx: ProviderContext): Promise<TTSResult> {
    if (!params.text.trim() || Array.from(params.text).length >= 10000) throw fail("MiniMax 合成文本须为 1～9999 个字符。");
    const format = params.format || "wav";
    if (!["wav", "mp3"].includes(format)) throw fail("MiniMax 当前支持 WAV / MP3 输出。");
    const instruction = params.instruction?.trim().toLowerCase();
    const emotion = instruction ? emotions[instruction] : undefined;
    if (instruction && !emotion) throw fail("MiniMax 的语音风格请留空自动判断，或填写：高兴、悲伤、愤怒、害怕、厌恶、惊讶、平静；不支持自由导演提示词。");
    const speed = params.speed ?? 1;
    if (!Number.isFinite(speed) || speed < 0.5 || speed > 2) throw fail("MiniMax 语速范围为 0.5～2。");
    const volume = params.volume ?? 1, pitch = params.pitch ?? 0;
    if (!Number.isFinite(volume) || volume <= 0 || volume > 10 || !Number.isInteger(pitch) || pitch < -12 || pitch > 12) throw fail("MiniMax 音量范围为大于 0 至 10，音调范围为 -12 至 12 的整数。");
    const started = Date.now();
    const voiceId = params.referenceAudioBuffer ? await cachedMiniMaxVoice(ctx.apiKey, params.referenceAudioBuffer, ctx.minimaxCacheDir,
      () => cloneMiniMaxVoice(params.referenceAudioBuffer!, params.referenceAudioName || (params.referenceAudioMime?.includes("wav") ? "reference.wav" : "reference.mp3"), `mimo_${randomUUID().replace(/-/g, "")}`, ctx)) : params.voiceId || "male-qn-qingse";
    const payload = { model: params.model || "speech-2.8-hd", text: params.text, stream: false, output_format: "hex", ...(params.language ? { language_boost: params.language } : {}), voice_setting: { voice_id: voiceId, speed, vol: volume, pitch, ...(emotion ? { emotion } : {}) }, audio_setting: { format, sample_rate: 32000, channel: 1, ...(format === "mp3" ? { bitrate: 128000 } : {}) } };
    const json = await miniMaxRequest("/v1/t2a_v2", payload, ctx);
    if (json.data?.status !== 2) throw fail("MiniMax 合成未完成，已拒绝保存不完整产物。", 502);
    const buffer = audio(json.data.audio);
    assertAudioFormat(buffer, format);
    return { voiceId, audioBuffer: buffer, format, mimeType: format === "wav" ? "audio/wav" : "audio/mpeg", elapsedMs: Date.now() - started, redactedRequest: payload };
  }

  async synthesizeVoiceDesign(params: VoiceDesignParams, ctx: ProviderContext): Promise<TTSResult> {
    const prompt = [params.voiceDescription, params.naturalControl, params.instruction].filter(Boolean).join("\n").trim();
    if (!prompt || !params.text.trim()) throw fail("请填写音色描述和试听文本。");
    const payload = { prompt, preview_text: params.text };
    const started = Date.now();
    const json = await miniMaxRequest("/v1/voice_design", payload, ctx);
    if (typeof json.voice_id !== "string" || !json.voice_id.trim()) throw fail("MiniMax 未返回设计音色的 Voice ID。", 502);
    const buffer = audio(json.trial_audio);
    const format = detectAudioFormat(buffer);
    return { voiceId: json.voice_id, audioBuffer: buffer, format, mimeType: format === "wav" ? "audio/wav" : "audio/mpeg", elapsedMs: Date.now() - started, redactedRequest: { ...payload, voiceId: json.voice_id } };
  }

  async optimizePrompt(_params: TextOptimizeParams, _ctx: ProviderContext): Promise<TextOptimizeResult> {
    throw fail("MiniMax 当前接入语音生成，未接入文本润色。");
  }
}
