import { randomUUID } from "node:crypto";
import type { ProviderContext } from "./types.js";
import { volcHeaders, volcPost } from "./volcengine.js";
import { readVolcResponse } from "./volcengineProtocol.js";
import { assertAudioFormat } from "../../shared/audioValidation.js";

const invalid = (message: string) => Object.assign(new Error(message), { status: 400 });
function text(body: Record<string, unknown>, key: string, limit: number, required = true) {
  const value = body[key];
  if (value === undefined && !required) return "";
  if (typeof value !== "string" || value.length > limit || (required && !value.trim())) throw invalid(`${key} 不能为空或超过 ${limit} 字符。`);
  return value.trim();
}

function binary(body: Record<string, unknown>, key: string, required: boolean) {
  const value = text(body, key, 14 * 1024 * 1024, required);
  if (!value) return undefined;
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw invalid("文件编码无效。");
  const bytes = Buffer.from(value, "base64");
  if (!bytes.length || bytes.length > 10 * 1024 * 1024) throw invalid("文件须在 10 MB 以内。");
  return bytes;
}

function imageBytes(body: Record<string, unknown>) {
  const image = binary(body, "image", false);
  if (image) {
    const isPng = image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const isJpeg = image[0] === 255 && image[1] === 216 && image[2] === 255;
    const isWebp = image.toString("ascii", 0, 4) === "RIFF" && image.toString("ascii", 8, 12) === "WEBP";
    if (!isPng && !isJpeg && !isWebp) throw invalid("仅支持 PNG、JPEG、WebP 图片。");
  }
  return image;
}

export async function runVolcengineTool(operation: string, body: Record<string, unknown>, ctx: ProviderContext) {
  const resourceId = ctx.volcengine?.resourceId || "seed-tts-2.0";
  if (operation === "audio-create") {
    const references = body.references === undefined ? [] : body.references;
    if (!Array.isArray(references) || references.length > 3) throw invalid("最多三条参考音频。");
    const audioReferences = references.map(reference => {
      if (!reference || typeof reference !== "object") throw invalid("参考音频无效。");
      const bytes = binary(reference, "audio", true)!;
      assertAudioFormat(bytes, reference.format === "mp3" ? "mp3" : "wav");
      return { audio_data: bytes.toString("base64") };
    });
    const image = imageBytes(body);
    const speaker = text(body, "speakerId", 256, false);
    if (image && (speaker || audioReferences.length)) throw invalid("角色图片不能与音色 ID 或参考音频混用。");
    if (speaker && audioReferences.length) throw invalid("音色 ID 与参考音频请选择一种。");
    const output = await volcPost("/api/v3/tts/create", {
      model: "seed-audio-1.0", text_prompt: text(body, "text", 3000),
      references: image ? [{ image_data: image.toString("base64") }] : speaker ? [{ speaker }] : audioReferences,
      audio_config: { format: "wav", sample_rate: 24000 }
    }, ctx);
    if (typeof output.audio !== "string" || !output.audio) throw new Error("未收到音频。");
    assertAudioFormat(Buffer.from(output.audio, "base64"), "wav");
    return { audioDataUrl: `data:audio/wav;base64,${output.audio}` };
  }
  if (operation === "voice-query") {
    const speaker = text(body, "speakerId", 256);
    return volcPost("/api/v3/tts/get_voice", { speaker_id: speaker }, ctx);
  }
  if (operation === "voice-design") {
    const prompt = text(body, "prompt", 200, false);
    const image = imageBytes(body);
    if (!prompt && !image) throw invalid("请填写音色描述或选择角色图片。");
    const headers = volcHeaders(ctx);
    if (headers["X-Api-App-Id"]) {
      headers["X-Api-App-Key"] = headers["X-Api-App-Id"];
      delete headers["X-Api-App-Id"];
    }
    return volcPost("/api/v3/tts/voice_design", {
      speaker_id: text(body, "speakerId", 256), text: text(body, "text", 300),
      language: body.language === 1 ? 1 : 0,
      prompt: { ...(prompt ? { text_prompt: prompt } : {}), ...(image ? { image_prompt: { image_bytes: image.toString("base64") } } : {}) }
    }, ctx, headers);
  }
  if (operation === "voice-register") {
    const audio = binary(body, "audio", true)!;
    const format = body.format === "mp3" ? "mp3" : "wav";
    assertAudioFormat(audio, format);
    return volcPost("/api/v3/tts/voice_clone", {
      speaker_id: text(body, "speakerId", 256),
      audio: { data: audio.toString("base64"), format },
      ...(body.text ? { text: text(body, "text", 300) } : {}),
      language: body.language === 1 ? 1 : 0
    }, ctx);
  }
  if (operation === "long-submit") {
    return volcPost("/api/v3/tts/submit", {
      unique_id: randomUUID(), user: { uid: "mimo_workstation_user" },
      req_params: { text: text(body, "text", 100000), speaker: text(body, "speakerId", 256),
        audio_params: { format: "mp3", sample_rate: 24000, enable_subtitle: true } }
    }, ctx, volcHeaders(ctx, resourceId));
  }
  if (operation === "long-query") {
    return volcPost("/api/v3/tts/query", { task_id: text(body, "taskId", 256) }, ctx, volcHeaders(ctx, resourceId));
  }
  if (["legacy-long-submit", "legacy-long-query", "emotion-long-submit", "emotion-long-query"].includes(operation)) {
    if (!ctx.appId || !ctx.accessToken) throw invalid("旧版长文本需要 AppID 和 AccessToken。");
    const resource = text(body, "resourceId", 120, false) ||
      (operation.startsWith("emotion") ? "volc.tts_async.emotion" : "volc.tts_async.default");
    const headers = { "Content-Type": "application/json", Authorization: `Bearer; ${ctx.accessToken}`, "Resource-Id": resource };
    const base = operation.startsWith("emotion") ? "/api/v1/tts_async_with_emotion" : "/api/v1/tts_async";
    if (operation.endsWith("submit")) return volcPost(base + "/submit", {
      appid: ctx.appId, reqid: randomUUID(), text: text(body, "text", 99999),
      voice_type: text(body, "speakerId", 256), format: "mp3"
    }, ctx, headers);
    const url = new URL("https://openspeech.bytedance.com" + base + "/query");
    url.searchParams.set("appid", ctx.appId);
    url.searchParams.set("task_id", text(body, "taskId", 256));
    const response = await fetch(url, { headers, redirect: "error", signal: AbortSignal.timeout(30_000) });
    if (!response.ok) { await response.body?.cancel(); throw new Error(`长文本查询失败（HTTP ${response.status}）。`); }
    const result = JSON.parse(await readVolcResponse(response));
    if (result.code) throw new Error(`火山引擎长文本错误 ${result.code}。`);
    return result;
  }
  throw invalid("不支持的火山引擎操作。");
}
