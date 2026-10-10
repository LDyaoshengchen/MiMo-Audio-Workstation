import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm, writeFile, mkdir, readFile } from "node:fs/promises";
import { pcm16ToWav } from "../server/utils/wav";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Server } from "node:http";
import { appendSynthesisInputs, normalizeProviderOptions } from "../src/utils/providerConfig";

vi.mock("node:child_process", () => ({ exec: vi.fn(), execFile: vi.fn() }));

describe("Provider configuration → HTTP route → upstream protocol", () => {
  const nativeFetch = globalThis.fetch;
  let server: Server;
  let base: string;
  let dataDir: string;
  const upstream: Array<{ url: string; body: any; headers: any }> = [];
  const originalEnv = { ...process.env };
  const call = (route: string, init?: RequestInit) => nativeFetch(`${base}${route}`, init);
  const save = (settings: any) => call("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });

  beforeAll(async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), "mimo-provider-routes-"));
    process.env.MIMO_DATA_DIR = dataDir;
    process.env.MIMO_NO_AUTO_LISTEN = "1";
    process.env.MIMO_API_KEY = "fixture-env-key";
    process.env.MIMO_HOST = "127.0.0.1";
    const { app } = await import("../server/index");
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server.once("listening", resolve));
    const address = server.address();
    base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
    vi.stubGlobal("fetch", vi.fn(async (url: any, init: any) => {
      upstream.push({ url: String(url), body: JSON.parse(init.body), headers: init.headers });
      if (String(url).includes("text-to-speech")) return new Response(new Uint8Array([0, 0, 1, 0]), { headers: { "Content-Type": "audio/pcm" } });
      if (String(url).includes("/chat/completions")) return Response.json({ choices: [{ message: { content: "润色结果" } }] });
      const wav = pcm16ToWav(Buffer.from([0, 0, 1, 0]), 24000);
      if (String(url).includes("bytedance")) return Response.json({ code: 3000, data: wav.toString("base64") });
      return new Response(wav, { headers: { "Content-Type": "audio/wav" } });
    }));
  });
  beforeEach(() => { upstream.length = 0; });
  afterAll(async () => {
    vi.unstubAllGlobals();
    await new Promise<void>(resolve => server.close(() => resolve()));
    await rm(dataDir, { recursive: true, force: true });
    process.env = originalEnv;
  });

  it("saved keys stay on server, survive blank updates, and synthesize without a key header", async () => {
    expect((await save({ apiProvider: "openai", apiKey: "fixture-saved-secret", apiEndpoint: "https://speech-proxy.example/v1/audio/speech", synthesisMode: "preset" })).status).toBe(200);
    expect((await save({ apiProvider: "openai", apiKey: "", apiEndpoint: "https://speech-proxy.example/v1/audio/speech", synthesisMode: "preset" })).status).toBe(200);
    for (const endpoint of ["/api/settings", "/api/bootstrap"]) {
      const text = await (await call(endpoint)).text();
      expect(text).not.toContain("fixture-saved-secret");
      expect(JSON.parse(text).apiKey).toBeUndefined();
    }
    const form = new FormData();
    await appendSynthesisInputs(form, normalizeProviderOptions({ synthesisMode: "preset", voiceId: "nova" }));
    form.append("text", "你好");
    expect((await call("/api/tts/voiceclone", { method: "POST", body: form })).status).toBe(200);
    expect(upstream[0].url).toBe("https://speech-proxy.example/v1/audio/speech");
    expect(upstream[0].headers.Authorization).toBe("Bearer fixture-saved-secret");
    expect(upstream[0].body).toMatchObject({ voice: "nova", input: "你好" });
    expect(upstream[0].body.messages).toBeUndefined();
  });

  it("unsupported reference cloning is rejected before an upstream call", async () => {
    const form = new FormData();
    form.append("text", "不能假装克隆");
    form.append("voice", new Blob(["RIFF"], { type: "audio/wav" }), "ref.wav");
    const res = await call("/api/tts/voiceclone", { method: "POST", headers: { "X-API-Provider": "openai", "X-API-Key": "fixture" }, body: form });
    expect(res.status).toBe(400);
    expect(upstream).toHaveLength(0);
  });

  it("SiliconFlow clone sends references alone with the actual reference transcript", async () => {
    const form = new FormData();
    await appendSynthesisInputs(form, normalizeProviderOptions({ referenceText: "参考音频原文" }), { dataUrl: "data:audio/wav;base64,UklGRg==", fileName: "ref.wav", mimeType: "audio/wav" });
    form.append("text", "新台词");
    form.append("instruction", "愉快地说");
    const res = await call("/api/tts/voiceclone", { method: "POST", headers: { "X-API-Provider": "siliconflow", "X-API-Key": "fixture" }, body: form });
    expect(res.status).toBe(200);
    expect(upstream[0].url).toBe("https://api.siliconflow.cn/v1/audio/speech");
    expect(upstream[0].body.voice).toBeUndefined();
    expect(upstream[0].body.references[0].text).toBe("参考音频原文");
  });

  it("missing transcript fails rather than replacing it with target text", async () => {
    const form = new FormData();
    form.append("text", "新台词");
    form.append("voice", new Blob(["RIFF"], { type: "audio/wav" }), "ref.wav");
    expect((await call("/api/tts/voiceclone", { method: "POST", headers: { "X-API-Provider": "siliconflow", "X-API-Key": "fixture" }, body: form })).status).toBe(400);
    expect(upstream).toHaveLength(0);
  });

  it("custom protocol must be explicit and dispatches to the declared speech protocol", async () => {
    expect((await save({ apiProvider: "custom", apiKey: "fixture", apiEndpoint: "https://custom.example/v1/audio/speech" })).status).toBe(400);
    expect((await save({ apiProvider: "custom", apiKey: "fixture", apiEndpoint: "https://custom.example/v1/audio/speech", customProtocol: "openai-tts", synthesisMode: "preset" })).status).toBe(200);
    const form = new FormData(); form.append("text", "自定义合成");
    expect((await call("/api/tts/voiceclone", { method: "POST", body: form })).status).toBe(200);
    expect(upstream[0].url).toBe("https://custom.example/v1/audio/speech");
    expect(upstream[0].body.messages).toBeUndefined();
  });

  it("Volcengine requires credentials and preserves its token without returning it", async () => {
    expect((await save({ apiProvider: "volcengine", apiKey: "" })).status).toBe(400);
    expect((await save({ apiProvider: "volcengine", appId: "fixture-app", accessToken: "fixture-token", synthesisMode: "preset" })).status).toBe(200);
    const settings = await (await call("/api/settings")).json();
    expect(settings.hasAccessToken).toBe(true); expect(settings.accessToken).toBeUndefined();
    const form = new FormData(); form.append("text", "豆包测试");
    expect((await call("/api/tts/voiceclone", { method: "POST", body: form })).status).toBe(200);
    expect(upstream[0].body.app.appid).toBe("fixture-app");
    expect(upstream[0].headers.Authorization).toBe("Bearer; fixture-token");
  });

  it("MiMo-only planning rejects another provider before any HTTP call", async () => {
    const res = await call("/api/workspaces/smart", { method: "POST", headers: { "Content-Type": "application/json", "X-API-Provider": "openai", "X-API-Key": "fixture" }, body: JSON.stringify({ sceneDescription: "测试", script: "台词" }) });
    expect(res.status).toBe(400); expect(upstream).toHaveLength(0);
  });

  it("invalid endpoints and unknown providers never silently fall back to MiMo", async () => {
    for (const headers of [{ "X-API-Provider": "unknown" }, { "X-API-Provider": "openai", "X-API-Endpoint": "http://remote.example/speech" }]) {
      const form = new FormData(); form.append("text", "测试");
      expect((await call("/api/tts/voiceclone", { method: "POST", headers, body: form })).status).toBe(400);
    }
    expect(upstream).toHaveLength(0);
  });

  it("cross-origin requests cannot read settings or invoke local file operations", async () => {
    expect((await call("/api/settings", { headers: { Origin: "https://untrusted.example" } })).status).toBe(403);
    expect((await call("/api/settings", { headers: { Origin: "http://localhost:9999" } })).status).toBe(403);
  });

  it("audiobook synthesis converts ElevenLabs PCM into a real WAV", async () => {
    const { synthesizeAudiobookProduct } = await import("../server/index");
    const wsDir = path.join(dataDir, "workspaces");
    const book = { id: "fixture-book", type: "audiobook", name: "fixture", novelText: "台词", characters: [{
      id: "fixture-character", name: "角色", voiceDataUrl: "registered-voice", voiceStatus: "ready"
    }], segments: [], products: [], chapters: [] };
    await writeFile(path.join(wsDir, "fixture-book.json"), JSON.stringify(book));
    await writeFile(path.join(wsDir, "index.json"), JSON.stringify({ activeWorkspaceId: book.id, workspaces: [{ id: book.id }] }));
    const result = await synthesizeAudiobookProduct(book.id, { id: "fixture-product", text: "新台词", characterId: "fixture-character", characterName: "角色", instruction: "" } as Parameters<typeof synthesizeAudiobookProduct>[1], {
      apiKey: "fixture", apiProvider: "elevenlabs", apiEndpoint: "https://api.elevenlabs.io/v1/text-to-speech"
    });
    expect(result).toMatch(/^data:audio\/wav;base64,/);
    const wav = Buffer.from(result.split(",")[1], "base64");
    expect(wav.toString("ascii", 8, 12)).toBe("WAVE");
    expect(wav.readUInt32LE(40)).toBe(4);
    expect(upstream[0].url).toContain("registered-voice");
  });

  it("text optimization follows the configured proxy and does not send credentials to the official host", async () => {
    const response = await call("/api/voice-style/optimize", {
      method: "POST", headers: { "Content-Type": "application/json", "X-API-Provider": "openai", "X-API-Key": "fixture", "X-API-Endpoint": "https://proxy.example/v1/audio/speech" },
      body: JSON.stringify({ style: "愉快地说" })
    });
    expect(response.status).toBe(200);
    expect(upstream[0].url).toBe("https://proxy.example/v1/chat/completions");
  });

  it("rejects stale board snapshots instead of overwriting newer edits", async () => {
    const created = await call("/api/workspaces", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "save-conflict-fixture", nodes: [], edges: [] }) });
    const board = await created.json();
    const put = (body: any) => call(`/api/workspaces/${board.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const first = await put({ name: "newer", baseUpdatedAt: board.updatedAt });
    expect(first.status).toBe(200);
    expect((await put({ name: "older", baseUpdatedAt: board.updatedAt })).status).toBe(409);
    expect((await put({ name: "no-version" })).status).toBe(428);
    expect((await (await call(`/api/workspaces/${board.id}`)).json()).name).toBe("newer");
  });

  it("migrates cache files and fixed settings, then restores the default directory", async () => {
    const target = await mkdtemp(path.join(tmpdir(), "mimo-route-migration-"));
    try {
      await mkdir(path.join(dataDir, "audios"), { recursive: true });
      const wav = pcm16ToWav(Buffer.from([0, 0, 1, 0]), 24000);
      await writeFile(path.join(dataDir, "audios", "migration.wav"), wav);
      await save({ apiProvider: "openai", apiKey: "migration-fixture-key", synthesisMode: "preset" });
      const response = await call("/api/settings/storage-path", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetDir: target }) });
      expect(response.status).toBe(200);
      expect(Buffer.from(await (await call("/api/audio-cache/migration.wav")).arrayBuffer())).toEqual(wav);
      const fixedSettings = JSON.parse(await readFile(path.join(dataDir, "settings.json"), "utf8"));
      expect(fixedSettings.customDataDir).toBe(target);
      expect(fixedSettings.apiKey).toBe("migration-fixture-key");
      expect((await (await call("/api/settings")).json()).hasApiKey).toBe(true);
      // 模拟完全重启服务，不能依赖旧进程内的 activeCustomDataDir。
      vi.resetModules();
      const restartedApp = (await import("../server/index")).app;
      const restarted = restartedApp.listen(0, "127.0.0.1");
      await new Promise<void>(resolve => restarted.once("listening", resolve));
      const address = restarted.address();
      const restartedBase = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
      try {
        const settings = await nativeFetch(`${restartedBase}/api/settings/storage-path`);
        expect((await settings.json()).dataDir).toBe(target);
        const audio = await nativeFetch(`${restartedBase}/api/audio-cache/migration.wav`);
        expect(Buffer.from(await audio.arrayBuffer())).toEqual(wav);
        expect((await (await nativeFetch(`${restartedBase}/api/settings`)).json()).hasApiKey).toBe(true);
      } finally { await new Promise<void>(resolve => restarted.close(() => resolve())); }
      expect((await call("/api/settings/reset-storage-path", { method: "POST" })).status).toBe(200);
      expect(JSON.parse(await readFile(path.join(dataDir, "settings.json"), "utf8")).customDataDir).toBeUndefined();
      expect(await readFile(path.join(dataDir, "audios", "migration.wav"))).toEqual(wav);
    } finally { await rm(target, { recursive: true, force: true }); }
  });

  it("folder paths are passed as arguments without executing a shell", async () => {
    const { execFile, exec } = await import("node:child_process");
    vi.mocked(execFile).mockClear();
    const target = path.resolve(dataDir, 'folder" & injected-command');
    const response = await call("/api/workspaces/open-folder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ folderPath: target }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ path: path.normalize(target) });
    expect(execFile).toHaveBeenCalled(); expect(exec).not.toHaveBeenCalled();
    const [command, args] = vi.mocked(execFile).mock.calls[0];
    expect(command).toBe(process.platform === "win32" ? "explorer.exe" : process.platform === "darwin" ? "open" : "xdg-open");
    expect(args).toContain(process.platform === "win32" ? `/select,${target}` : target);
    expect((await call("/api/workspaces/open-folder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ folderPath: "relative-folder" }) })).status).toBe(400);
  });
  it("returns native absolute paths for default workspace and audio folders", async () => {
    for (const endpoint of ["/api/workspaces/open-folder", "/api/workspaces/open-audios-folder"]) {
      const response = await call(endpoint, { method: "POST" });
      expect(response.status).toBe(200);
      const result = await response.json();
      expect(path.isAbsolute(result.path)).toBe(true);
      expect(result.path).toBe(path.normalize(result.path));
      if (process.platform !== "win32") expect(result.path).not.toContain("\\");
    }
  });
});
