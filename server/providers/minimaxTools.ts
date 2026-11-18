import type { ProviderContext, TTSResult } from "./types.js";
import { MiniMaxAdapter, cloneMiniMaxVoice, miniMaxRequest } from "./minimax.js";
import { forgetMiniMaxVoice } from "./minimaxVoices.js";

export type MiniMaxFile = { buffer: Buffer; originalname: string };
const fail = (message: string) => Object.assign(new Error(message), { status: 400 });
const text = (body: Record<string, unknown>, key: string, max: number, required = false): string => {
  const value = body[key];
  if (value != null && typeof value !== "string") throw fail(`${key} 格式无效。`);
  const result = (value as string | undefined)?.trim() || "";
  if (result.length > max || (required && !result)) throw fail(`${key} 不能为空且不能超过 ${max} 字符。`);
  return result;
};
export function miniMaxAudioOutput(result: TTSResult) {
  return { voiceId: result.voiceId, audioDataUrl: `data:${result.mimeType};base64,${result.audioBuffer.toString("base64")}`, format: result.format, elapsedMs: result.elapsedMs };
}
export async function runMiniMaxTool(operation: string, body: Record<string, unknown>, ctx: ProviderContext, files: Record<string, MiniMaxFile[] | undefined> = {}) {
  if (operation === "voice-list") {
    const type = text(body, "voiceType", 30) || "all";
    if (!["all", "system", "voice_cloning", "voice_generation"].includes(type)) throw fail("音色类型无效。");
    const result = await miniMaxRequest("/v1/get_voice", { voice_type: type }, ctx);
    return { voices: (["system_voice", "voice_cloning", "voice_generation"] as const).flatMap(key => {
      if (!Array.isArray(result[key])) return [];
      return result[key].filter((item: any) => typeof item?.voice_id === "string").map((item: any) => ({ voiceId: item.voice_id, name: typeof item.voice_name === "string" ? item.voice_name : item.voice_id, type: key === "system_voice" ? "system" : key, description: Array.isArray(item.description) ? item.description.filter((v: unknown) => typeof v === "string").join("；") : "" }));
    }) };
  }
  if (operation === "voice-delete") {
    const voiceId = text(body, "voiceId", 256, true), type = text(body, "voiceType", 30, true);
    if (!["voice_cloning", "voice_generation"].includes(type)) throw fail("仅能删除克隆或设计音色。");
    await miniMaxRequest("/v1/delete_voice", { voice_id: voiceId, voice_type: type }, ctx);
    await forgetMiniMaxVoice(ctx.minimaxCacheDir, voiceId, ctx.apiKey);
    return { voiceId, deleted: true };
  }
  if (operation === "voice-clone") {
    const sample = files.audio?.[0], prompt = files.promptAudio?.[0];
    if (!sample) throw fail("请上传克隆参考音频。");
    const voiceId = text(body, "voiceId", 256, true);
    const promptText = text(body, "promptText", 1000);
    if (!prompt && promptText) throw fail("填写示例原文时请同时上传示例音频。");
    const id = await cloneMiniMaxVoice(sample.buffer, sample.originalname, voiceId, ctx, {
      ...(prompt ? { prompt: { bytes: prompt.buffer, name: prompt.originalname, text: promptText } } : {}),
      noiseReduction: body.noiseReduction === true || body.noiseReduction === "true", volumeNormalization: body.volumeNormalization === true || body.volumeNormalization === "true"
    });
    return { voiceId: id, voiceType: "voice_cloning" };
  }
  const adapter = new MiniMaxAdapter();
  if (operation === "voice-design") {
    const result = await adapter.synthesizeVoiceDesign({ text: text(body, "text", 9999, true), voiceDescription: text(body, "prompt", 10000, true) }, ctx);
    return { ...miniMaxAudioOutput(result), voiceType: "voice_generation" };
  }
  if (operation === "speak") {
    const result = await adapter.synthesizeVoiceClone({ text: text(body, "text", 9999, true), voiceId: text(body, "voiceId", 256, true), model: text(body, "model", 100), instruction: text(body, "emotion", 30), speed: Number(body.speed ?? 1), volume: Number(body.volume ?? 1), pitch: Number(body.pitch ?? 0), language: text(body, "language", 40) || "auto", format: "wav" }, ctx);
    return miniMaxAudioOutput(result);
  }
  throw fail("未知 MiniMax 操作。");
}
