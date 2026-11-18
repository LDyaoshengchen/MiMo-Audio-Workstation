import { afterEach, describe, expect, it, vi } from "vitest";
import { WebSocketServer } from "ws";
import { once } from "node:events";
import { getProviderAdapter } from "../server/providers/index";
import { volcHeaders } from "../server/providers/volcengine";
import { decodeVolcFrame, decodeVolcStream, encodeVolcFrame, synthesizeVolcWebSocket } from "../server/providers/volcengineProtocol";
import { runVolcengineTool } from "../server/providers/volcengineTools";
import { pcm16ToWav } from "../server/utils/wav";

afterEach(() => vi.unstubAllGlobals());
const ctx = { apiKey: "fixture-only-key" };
const pcm = Buffer.from([1, 0, 2, 0]);
const adapter = getProviderAdapter("volcengine");

describe("Volcengine official synthesis protocols", () => {
  it.each(["http", "sse"] as const)("collects %s audio and requires the completion marker", async transport => {
    const frame = JSON.stringify({ code: 0, data: pcm.toString("base64") });
    const end = JSON.stringify({ code: 20000000, data: null });
    const stream = transport === "sse" ? `event: 352\r\ndata: ${frame}\r\n\r\nevent: 152\r\ndata: ${end}\r\n\r\n` : frame + "\n" + end;
    const fetch = vi.fn(async () => new Response(stream));
    vi.stubGlobal("fetch", fetch);
    const result = await adapter.synthesizeVoiceClone({ text: "测试", instruction: "轻松", voiceId: "test-voice" },
      { ...ctx, volcengine: { transport, resourceId: "seed-tts-2.0" } });
    expect(result.audioBuffer).toEqual(pcm16ToWav(pcm, 24000));
    const [url, request] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://openspeech.bytedance.com/api/v3/tts/unidirectional" + (transport === "sse" ? "/sse" : ""));
    expect(request.redirect).toBe("error");
    expect(request.headers).toMatchObject({ "X-Api-Key": ctx.apiKey, "X-Api-Resource-Id": "seed-tts-2.0" });
    expect(JSON.parse(request.body as string).req_params).toMatchObject({ text: "测试", speaker: "test-voice", audio_params: { format: "pcm" } });
    expect(() => decodeVolcStream(transport === "sse" ? "data: " + frame + "\n\n" : frame, transport === "sse")).toThrow("中断");
  });

  it("preserves the legacy HTTP payload and token authentication", async () => {
    const fetch = vi.fn(async (_url: unknown, _request?: RequestInit) => new Response(JSON.stringify({ code: 3000, data: pcm16ToWav(pcm, 24000).toString("base64") })));
    vi.stubGlobal("fetch", fetch);
    await adapter.synthesizeVoiceClone({ text: "旧版", voiceId: "BV001_streaming" },
      { ...ctx, appId: "fixture-app", accessToken: "fixture-token", volcengine: { transport: "legacy" } });
    const request = fetch.mock.calls[0][1] as RequestInit;
    expect(request.headers).toMatchObject({ Authorization: "Bearer; fixture-token" });
    expect(JSON.parse(request.body as string).request.operation).toBe("query");
  });

  it("uses Seed-Audio for reference and text-designed generation without registering slots", async () => {
    const fetch = vi.fn(async (_url: unknown, _request?: RequestInit) => new Response(JSON.stringify({ code: 0, audio: pcm16ToWav(pcm, 24000).toString("base64") })));
    vi.stubGlobal("fetch", fetch);
    await adapter.synthesizeVoiceClone({ text: "台词", referenceAudioBuffer: pcm16ToWav(pcm, 24000) },
      { ...ctx, volcengine: { transport: "create" } });
    await adapter.synthesizeVoiceDesign({ text: "台词", voiceDescription: "温柔女声" }, ctx);
    for (const call of fetch.mock.calls) expect(call[0]).toBe("https://openspeech.bytedance.com/api/v3/tts/create");
    const body = JSON.parse((fetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.references[0].audio_data).toBeTruthy();
    expect(body.model).toBe("seed-audio-1.0");
  });

  it("rejects incomplete frames and upstream errors", () => {
    expect(() => decodeVolcFrame(Buffer.from([0x11, 0x94]))).toThrow();
    expect(() => decodeVolcStream('{"code":45000000,"message":"denied"}', false)).toThrow("45000000");
    const frame = encodeVolcFrame({ ok: true }, 150, "session");
    expect(decodeVolcFrame(frame)).toMatchObject({ event: 150 });
    expect(() => decodeVolcFrame(frame.subarray(0, frame.length - 1))).toThrow("长度");
  });

  it("prefers a new API key while preserving old header-only credentials", () => {
    expect(volcHeaders({ ...ctx, appId: "app", accessToken: "token" })).toHaveProperty("X-Api-Key", ctx.apiKey);
    expect(volcHeaders({ apiKey: "token", appId: "app", accessToken: "token" })).toHaveProperty("X-Api-App-Id", "app");
  });

  it("validates slot design input before consuming a request", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(runVolcengineTool("voice-design", { text: "试听", speakerId: "S_fixture", image: Buffer.from("<script>").toString("base64") }, ctx)).rejects.toThrow("图片");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("submits and queries V3 long text without fetching returned URLs", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ code: 20000000, data: { task_id: "task-fixture", audio_url: "http://127.0.0.1/private" } })));
    vi.stubGlobal("fetch", fetch);
    await runVolcengineTool("long-submit", { text: "长文", speakerId: "fixture-voice" }, ctx);
    await runVolcengineTool("long-query", { taskId: "task-fixture" }, ctx);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls.map(call => call[0])).toEqual([
      "https://openspeech.bytedance.com/api/v3/tts/submit", "https://openspeech.bytedance.com/api/v3/tts/query"
    ]);
  });

  it("registers and queries a slot and designs it with the documented old header", async () => {
    const fetch = vi.fn(async (_url: unknown, _request?: RequestInit) => Response.json({ speaker_id: "S_fixture", status: 2 }));
    vi.stubGlobal("fetch", fetch);
    await runVolcengineTool("voice-register", { speakerId: "S_fixture", audio: pcm16ToWav(pcm, 24000).toString("base64"), text: "样本", format: "wav" }, ctx);
    await runVolcengineTool("voice-query", { speakerId: "S_fixture" }, ctx);
    await runVolcengineTool("voice-design", { speakerId: "S_fixture", text: "试听", prompt: "温柔女声" },
      { apiKey: "old-token", accessToken: "old-token", appId: "old-app" });
    expect(fetch.mock.calls.map(call => call[0])).toEqual([
      "https://openspeech.bytedance.com/api/v3/tts/voice_clone",
      "https://openspeech.bytedance.com/api/v3/tts/get_voice",
      "https://openspeech.bytedance.com/api/v3/tts/voice_design"
    ]);
    expect((fetch.mock.calls[2][1] as RequestInit).headers).toMatchObject({
      "X-Api-App-Key": "old-app", "X-Api-Access-Key": "old-token"
    });
  });

  it.each(["legacy", "emotion"])("submits and queries %s long text using the expected resource", async kind => {
    const fetch = vi.fn(async (_url: unknown, _request?: RequestInit) => Response.json({ task_id: "task", task_status: 0 }));
    vi.stubGlobal("fetch", fetch);
    const old = { apiKey: "old-token", appId: "old-app", accessToken: "old-token" };
    await runVolcengineTool(kind + "-long-submit", { text: "长文", speakerId: "BV_fixture" }, old);
    await runVolcengineTool(kind + "-long-query", { taskId: "task" }, old);
    const base = kind === "emotion" ? "tts_async_with_emotion" : "tts_async";
    expect(fetch.mock.calls[0][0]).toBe("https://openspeech.bytedance.com/api/v1/" + base + "/submit");
    expect(String(fetch.mock.calls[1][0])).toContain(base + "/query?appid=old-app&task_id=task");
    expect((fetch.mock.calls[0][1] as RequestInit).headers).toMatchObject({
      "Resource-Id": kind === "emotion" ? "volc.tts_async.emotion" : "volc.tts_async.default"
    });
  });
});

describe("Volcengine WebSocket session lifecycle", () => {
  it.each([false, true])("handles a legacy final packet or early close (%s)", async earlyClose => {
    const server = new WebSocketServer({ port: 0, host: "127.0.0.1" });
    await once(server, "listening");
    const address = server.address() as { port: number };
    server.on("connection", socket => socket.on("message", () => {
      if (earlyClose) return socket.close();
      const header = Buffer.from([0x11, 0xb3, 0, 0]);
      const sequenceAndSize = Buffer.alloc(8);
      sequenceAndSize.writeInt32BE(-1);
      sequenceAndSize.writeUInt32BE(pcm.length, 4);
      socket.send(Buffer.concat([header, sequenceAndSize, pcm]));
    }));
    try {
      const request = synthesizeVolcWebSocket(`ws://127.0.0.1:${address.port}`, {}, {}, "session", false, true);
      if (earlyClose) await expect(request).rejects.toThrow("提前断开");
      else expect(await request).toEqual(pcm);
    } finally {
      for (const socket of server.clients) socket.terminate();
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });
  it.each([false, true])("completes a %s bidirectional session with one full audio result", async bidirectional => {
    const server = new WebSocketServer({ port: 0, host: "127.0.0.1" });
    await once(server, "listening");
    const address = server.address() as { port: number };
    const events: (number | undefined)[] = [];
    server.on("connection", socket => {
      socket.on("message", raw => {
        const frame = decodeVolcFrame(Buffer.from(raw as Buffer));
        events.push(frame.event);
        if (frame.event === 1) socket.send(encodeVolcFrame({}, 50, "connection"));
        else if (frame.event === 100) {
          expect(JSON.parse(frame.payload.toString()).req_params.text).toBeUndefined();
          socket.send(encodeVolcFrame({}, 150, "session"));
        }
        else if (!bidirectional || frame.event === 102) {
          const audio = encodeVolcFrame({}, 352, "session");
          const prefix = audio.subarray(0, audio.length - 2 - 4);
          prefix[1] = 0xb4; prefix[2] = 0;
          const length = Buffer.alloc(4); length.writeUInt32BE(pcm.length);
          socket.send(Buffer.concat([prefix, length, pcm]));
          socket.send(encodeVolcFrame({ status_code: 20000000 }, 152, "session"));
        }
      });
    });
    try {
      expect(await synthesizeVolcWebSocket(`ws://127.0.0.1:${address.port}`, {}, { req_params: { text: "hello" } }, "session", bidirectional, false)).toEqual(pcm);
      if (bidirectional) expect(events).toEqual([1, 100, 200, 102]);
    } finally {
      for (const socket of server.clients) socket.terminate();
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });
});
