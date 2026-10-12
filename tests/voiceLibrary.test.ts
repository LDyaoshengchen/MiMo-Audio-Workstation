import { afterEach, beforeEach, expect, it } from "vitest";
import express from "express";
import type { Server } from "node:http";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { registerVoiceLibrary } from "../server/utils/voiceLibrary";
let directory: string, server: Server, base: string;
beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "mimo-voice-library-test-"));
  const app = express(); app.use(express.json()); registerVoiceLibrary(app, () => directory);
  app.use((error: any, _request: any, response: any, _next: any) => response.status(error.status || 500).json({ error: error.message }));
  server = await new Promise<Server>(resolve => { const listening = app.listen(0, "127.0.0.1", () => resolve(listening)); });
  base = `http://127.0.0.1:${(server.address() as any).port}/api/voice-library`;
});
afterEach(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await rm(directory, { recursive: true, force: true }); });
const asset = { name: "角色一", description: "低沉", naturalControl: "冷静", voiceId: "voice-1", provider: "fishaudio", audio: { fileName: "voice.wav", mimeType: "audio/wav", dataUrl: "data:audio/wav;base64,AAAA" }, apiKey: "must-not-store" };
const post = (body: unknown) => fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
it("persists reusable audio and voice details without API credentials", async () => {
  const created = await post(asset); expect(created.status).toBe(201);
  const entries = await (await fetch(base)).json(); expect(entries).toHaveLength(1); expect(entries[0].voiceId).toBe("voice-1"); expect(entries[0].audio.dataUrl).toBe(asset.audio.dataUrl); expect(JSON.stringify(entries)).not.toContain("must-not-store");
  const removed = await (await fetch(`${base}/${entries[0].id}`, { method: "DELETE" })).json(); expect(removed).toEqual([]);
});
it("serializes concurrent writes and rejects invalid/remote audio", async () => {
  await Promise.all([post(asset), post({ ...asset, name: "角色二" })]); expect(await (await fetch(base)).json()).toHaveLength(2);
  expect((await post({ ...asset, name: "" })).status).toBe(400);
  expect((await post({ ...asset, audio: { ...asset.audio, dataUrl: "https://example.com/secret.wav" } })).status).toBe(400);
});
it("stores favorites in a dedicated folder and retains legacy assets", async () => {
  await writeFile(path.join(directory, "voice-library.json"), JSON.stringify([{ ...asset, id: "legacy" }]));
  const created = await post({ ...asset, favorite: true }); expect(created.status).toBe(201);
  const entries = await created.json(); expect(entries).toHaveLength(2);
  expect(JSON.parse(await readFile(path.join(directory, "role-voice-library", "assets.json"), "utf8"))).toHaveLength(2);
  const toggled = await fetch(`${base}/${entries[1].id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ favorite: false }) });
  expect((await toggled.json())[1].favorite).toBe(false);
  expect((await (await fetch(`${base}/location`)).json()).directory).toBe(path.join(directory, "role-voice-library"));
  expect(JSON.parse(await readFile(path.join(directory, "voice-library.json"), "utf8"))).toHaveLength(1);
});
