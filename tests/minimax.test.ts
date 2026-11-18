import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { cloneMiniMaxVoice } from "../server/providers/minimax";
import { runMiniMaxTool } from "../server/providers/minimaxTools";
import { cachedMiniMaxVoice } from "../server/providers/minimaxVoices";
import { getProviderAdapter } from "../server/providers/index";
import { pcm16ToWav } from "../server/utils/wav";

const adapter = getProviderAdapter("minimax");
const ctx = { apiKey: "fixture-only-key" };
const wav = pcm16ToWav(Buffer.from([0, 0, 1, 0]), 32000);
const success = () => ({ base_resp: { status_code: 0 }, data: { status: 2, audio: wav.toString("hex") } });
afterEach(() => vi.unstubAllGlobals());

describe("MiniMax official protocol", () => {
  it("uses Bearer authentication, exact text, registered Voice ID and validated WAV output", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(success()));
    vi.stubGlobal("fetch", fetcher);
    const result = await adapter.synthesizeVoiceClone({ text: "Only this sentence.(laughs)", voiceId: "registered-character", instruction: "愤怒", speed: 1.2 }, ctx);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://api.minimax.cn/v1/t2a_v2");
    expect(init.headers.Authorization).toBe("Bearer fixture-only-key");
    expect(init.redirect).toBe("error");
    expect(JSON.parse(init.body)).toMatchObject({ text: "Only this sentence.(laughs)", stream: false, output_format: "hex", model: "speech-2.8-hd", voice_setting: { voice_id: "registered-character", emotion: "angry", speed: 1.2 }, audio_setting: { format: "wav", channel: 1 } });
    expect(result.audioBuffer).toEqual(wav);
    expect(JSON.stringify(result)).not.toContain(ctx.apiKey);
  });

  it("uses selected Turbo model, MP3 and automatic emotion when style is empty", async () => {
    const mp3 = Buffer.from([0xff, 0xfb, 0x90, 0, 0, 0]);
    const fetcher = vi.fn().mockResolvedValue(Response.json({ base_resp: { status_code: 0 }, data: { status: 2, audio: mp3.toString("hex") } }));
    vi.stubGlobal("fetch", fetcher);
    const result = await adapter.synthesizeVoiceClone({ text: "你好", format: "mp3", model: "speech-2.8-turbo" }, ctx);
    const body = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(body.model).toBe("speech-2.8-turbo");
    expect(body.voice_setting.emotion).toBeUndefined();
    expect(result.mimeType).toBe("audio/mpeg");
  });

  it.each([
    { base_resp: { status_code: 0 }, data: { status: 1, audio: wav.toString("hex") } },
    { base_resp: { status_code: 0 }, data: { status: 2, audio: "https://evil.example/audio" } },
    { base_resp: { status_code: 0 }, data: { status: 2, audio: "abc" } },
    { base_resp: { status_code: 0 }, data: null },
    { base_resp: { status_code: 0 }, data: { status: 2, audio: "00000000" } }
  ])("rejects incomplete or malformed audio without downloading any URL", async response => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(response));
    vi.stubGlobal("fetch", fetcher);
    await expect(adapter.synthesizeVoiceClone({ text: "你好" }, ctx)).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("detects provider errors inside HTTP 200 and never echoes a leaked secret", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ base_resp: { status_code: 1002, status_msg: ctx.apiKey } })));
    await expect(adapter.synthesizeVoiceClone({ text: "你好" }, ctx)).rejects.toMatchObject({ status: 429 });
    await expect(adapter.synthesizeVoiceClone({ text: "你好" }, ctx)).rejects.not.toThrow(ctx.apiKey);
  });

  it("rejects arbitrary endpoints, too-short samples and unsupported direction before requests", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expect(adapter.synthesizeVoiceClone({ text: "你好" }, { ...ctx, apiEndpoint: "https://attacker.example/v1/t2a_v2" })).rejects.toThrow("官方地址");
    await expect(adapter.synthesizeVoiceClone({ text: "你好", referenceAudioBuffer: wav, referenceAudioName: "short.wav" }, ctx)).rejects.toThrow("10 秒");
    await expect(adapter.synthesizeVoiceClone({ text: "你好", instruction: "A complicated director prompt" }, ctx)).rejects.toThrow("不支持自由导演");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("decodes design preview using actual format and retains reusable Voice ID", async () => {
    const mp3 = Buffer.from([0xff, 0xfb, 0x90, 0, 0, 0]);
    const fetcher = vi.fn().mockResolvedValue(Response.json({ base_resp: { status_code: 0 }, voice_id: "designed-character", trial_audio: mp3.toString("hex") }));
    vi.stubGlobal("fetch", fetcher);
    const result = await adapter.synthesizeVoiceDesign({ text: "指定台词", voiceDescription: "低沉男声", naturalControl: "沉稳", format: "wav" }, ctx);
    expect(fetcher.mock.calls[0][0]).toBe("https://api.minimax.cn/v1/voice_design");
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ prompt: "低沉男声\n沉稳", preview_text: "指定台词" });
    expect(result.format).toBe("mp3");
    expect(result.redactedRequest).toMatchObject({ voiceId: "designed-character" });
  });
});

describe("MiniMax cloning and voice management", () => {
  const sample = pcm16ToWav(Buffer.alloc(16000 * 2 * 10), 16000);
  const prompt = pcm16ToWav(Buffer.alloc(16000 * 2 * 2), 16000);
  it("uploads the main and optional prompt samples before registering the requested voice", async () => {
    let upload = 0;
    const fetcher = vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith("/upload")) {
        const form = init.body as FormData;
        expect(init.headers).not.toHaveProperty("Content-Type");
        expect(form.get("purpose")).toBe(upload ? "prompt_audio" : "voice_clone");
        expect((form.get("file") as File).name).toBe("sample.wav");
        return Response.json({ base_resp: { status_code: 0 }, file: { file_id: String(++upload) } });
      }
      expect(JSON.parse(init.body as string)).toEqual({ file_id: 1, voice_id: "MyVoice123", clone_prompt: { prompt_audio: 2, prompt_text: "示例原文" }, need_noise_reduction: true, need_volume_normalization: true });
      return Response.json({ base_resp: { status_code: 0 }, demo_audio: "https://untrusted.example/audio" });
    });
    vi.stubGlobal("fetch", fetcher);
    expect(await cloneMiniMaxVoice(sample, "role.wav", "MyVoice123", ctx, { prompt: { bytes: prompt, name: "sample.wav", text: "示例原文" }, noiseReduction: true, volumeNormalization: true })).toBe("MyVoice123");
    expect(fetcher.mock.calls.map(call => call[0])).toEqual(["https://api.minimax.cn/v1/files/upload", "https://api.minimax.cn/v1/files/upload", "https://api.minimax.cn/v1/voice_clone"]);
  });

  it("reuses a persisted voice across parallel and subsequent reference synthesis, separated by API account", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "minimax-voice-cache-"));
    let uploads = 0, clones = 0;
    const fetcher = vi.fn(async (url: string) => {
      if (url.endsWith("/upload")) { uploads++; return Response.json({ base_resp: { status_code: 0 }, file: { file_id: uploads } }); }
      if (url.endsWith("/voice_clone")) { clones++; return Response.json({ base_resp: { status_code: 0 } }); }
      return Response.json(success());
    });
    vi.stubGlobal("fetch", fetcher);
    try {
      const config = { ...ctx, minimaxCacheDir: directory }, params = { text: "固定台词", referenceAudioBuffer: sample, referenceAudioName: "same.wav" };
      const results = await Promise.all([adapter.synthesizeVoiceClone(params, config), adapter.synthesizeVoiceClone(params, config)]);
      const later = await adapter.synthesizeVoiceClone(params, config);
      expect(results[0].voiceId).toBe(results[1].voiceId);
      expect(later.voiceId).toBe(results[0].voiceId);
      expect(uploads).toBe(1); expect(clones).toBe(1);
      await adapter.synthesizeVoiceClone(params, { ...config, apiKey: "different-account-fixture" });
      expect(clones).toBe(2);
      expect(uploads).toBe(2);
    } finally { await rm(directory, { recursive: true, force: true }); }
  });

  it("does not cache failed registration and lets a later retry create a voice", async () => {
    const create = vi.fn().mockRejectedValueOnce(new Error("registration failed")).mockResolvedValue("MyVoice456");
    await expect(cachedMiniMaxVoice("cache-retry-fixture", sample, undefined, create)).rejects.toThrow("registration failed");
    expect(await cachedMiniMaxVoice("cache-retry-fixture", sample, undefined, create)).toBe("MyVoice456");
  });

  it("lists voice types, blocks system-voice deletion and invalid operations before upstream calls", async () => {
    const fetcher = vi.fn().mockImplementation(async () => Response.json({ base_resp: { status_code: 0 }, system_voice: [{ voice_id: "preset", voice_name: "预置", description: ["低沉"] }], voice_cloning: [{ voice_id: "MyClone123" }], voice_generation: [{ voice_id: "MyDesign123" }] }));
    vi.stubGlobal("fetch", fetcher);
    const listed = await runMiniMaxTool("voice-list", {}, ctx) as any;
    expect(listed.voices.map((voice: any) => voice.type)).toEqual(["system", "voice_cloning", "voice_generation"]);
    await expect(runMiniMaxTool("voice-delete", { voiceId: "preset", voiceType: "system" }, ctx)).rejects.toThrow("仅能删除");
    await expect(runMiniMaxTool("invalid", {}, ctx)).rejects.toThrow("未知");
    await expect(runMiniMaxTool("voice-clone", { voiceId: "MyClone123" }, ctx)).rejects.toThrow("请上传");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("deletes the cloud voice and its reference cache so the next use registers again", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "minimax-delete-cache-"));
    const config = { ...ctx, minimaxCacheDir: directory };
    try {
      await cachedMiniMaxVoice(ctx.apiKey, sample, directory, async () => "DeleteVoice123");
      const fetcher = vi.fn().mockResolvedValue(Response.json({ base_resp: { status_code: 0 } }));
      vi.stubGlobal("fetch", fetcher);
      expect(await runMiniMaxTool("voice-delete", { voiceId: "DeleteVoice123", voiceType: "voice_cloning" }, config)).toMatchObject({ deleted: true });
      expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ voice_id: "DeleteVoice123", voice_type: "voice_cloning" });
      const create = vi.fn().mockResolvedValue("NewVoice123");
      expect(await cachedMiniMaxVoice(ctx.apiKey, sample, directory, create)).toBe("NewVoice123");
      expect(create).toHaveBeenCalledOnce();
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
});
