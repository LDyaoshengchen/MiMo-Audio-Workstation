import { afterEach, beforeEach, expect, it } from "vitest";
import express from "express";
import type { Server } from "node:http";
import { mkdtemp, mkdir, rm, readFile, writeFile, readdir, stat, unlink } from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { registerVoiceLibrary } from "../server/utils/voiceLibrary";
import { prepareStorageMigration } from "../server/utils/storageMigration";
let directory: string, server: Server, base: string;
beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "mimo-voice-library-test-"));
  const app = express(); app.use(express.json()); registerVoiceLibrary(app, () => directory);
  app.use((error: any, _request: any, response: any, _next: any) => response.status(error.status || 500).json({ error: error.message }));
  server = await new Promise<Server>(resolve => { const listening = app.listen(0, "127.0.0.1", () => resolve(listening)); });
  base = `http://127.0.0.1:${(server.address() as any).port}/api/voice-library`;
});
afterEach(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await rm(directory, { recursive: true, force: true }); });
const asset = { name: "角色一", description: "低沉", naturalControl: "冷静", language: "中文", gender: "女性", voiceId: "voice-1", provider: "fishaudio", audio: { fileName: "voice.wav", mimeType: "audio/wav", dataUrl: "data:audio/wav;base64,AAAA" }, apiKey: "must-not-store" };
const post = (body: unknown) => fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const status = async (sources: string[]) => (await fetch(`${base}/favorite-status?sources=${encodeURIComponent(JSON.stringify(sources))}`)).json();
const hash = (encoded: string) => `sha256:${createHash("sha256").update(Buffer.from(encoded, "base64")).digest("hex")}`;
it("persists reusable audio and voice details without API credentials", async () => {
  const created = await post(asset); expect(created.status).toBe(201);
  const entries = await (await fetch(base)).json(); expect(entries).toHaveLength(1); expect(entries[0].voiceId).toBe("voice-1"); expect(entries[0].audio.dataUrl).toBe(asset.audio.dataUrl); expect(entries[0]).toMatchObject({ language: "中文", gender: "女性" }); expect(JSON.stringify(entries)).not.toContain("must-not-store");
  expect(entries[0].localAudioFileName).toBe('角色一.wav');
  expect(await readFile(path.join(directory, 'role-voice-library', '角色一.wav'))).toEqual(Buffer.from('AAAA', 'base64'));
  const removed = await (await fetch(`${base}/${entries[0].id}`, { method: "DELETE" })).json(); expect(removed).toEqual([]);
  expect(await readFile(path.join(directory, 'role-voice-library', '角色一.wav'))).toEqual(Buffer.from('AAAA', 'base64'));
});

it("preserves official MiMo preset mode and rejects presets assigned to another provider", async () => {
  const created = await post({ name: "Chloe", description: "官方预置音色", naturalControl: "", voiceId: "Chloe", provider: "mimo", voiceAssetMode: "preset" });
  expect(created.status).toBe(201);
  expect((await created.json())[0]).toMatchObject({ name: "Chloe", provider: "mimo", voiceId: "Chloe", voiceAssetMode: "preset" });
  const invalid = await post({ name: "Chloe", voiceId: "Chloe", provider: "openai", voiceAssetMode: "preset" });
  expect(invalid.status).toBe(400);
});

it("moves selected role assets to a group in one update and can return them to ungrouped", async () => {
  const firstId = (await (await post({ ...asset, name: "兔女郎" })).json()).at(-1).id;
  const secondId = (await (await post({ ...asset, name: "牛头" })).json()).at(-1).id;
  const untouchedId = (await (await post({ ...asset, name: "金毛队长" })).json()).at(-1).id;
  const createdGroup = await fetch(`${base}/groups`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "角色" }) });
  const group = (await createdGroup.json())[0];

  const moved = await fetch(`${base}/bulk-group`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assetIds: [firstId, secondId], groupId: group.id }) });
  expect(moved.status).toBe(200);
  const afterMove = await moved.json();
  expect(afterMove.find((entry: any) => entry.id === firstId).groupId).toBe(group.id);
  expect(afterMove.find((entry: any) => entry.id === secondId).groupId).toBe(group.id);
  expect(afterMove.find((entry: any) => entry.id === untouchedId).groupId).toBeUndefined();

  const ungrouped = await fetch(`${base}/bulk-group`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assetIds: [firstId, secondId], groupId: null }) });
  expect((await ungrouped.json()).filter((entry: any) => [firstId, secondId].includes(entry.id)).every((entry: any) => !entry.groupId)).toBe(true);
});

it("rejects invalid bulk moves without partially changing assets", async () => {
  const created = await (await post(asset)).json();
  const invalidGroup = await fetch(`${base}/bulk-group`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assetIds: [created[0].id], groupId: "missing-group" }) });
  expect(invalidGroup.status).toBe(404);
  const missingAsset = await fetch(`${base}/bulk-group`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assetIds: [created[0].id, "missing-asset"], groupId: null }) });
  expect(missingAsset.status).toBe(404);
  expect((await (await fetch(base)).json())[0].groupId).toBeUndefined();
  const invalidBody = await fetch(`${base}/bulk-group`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assetIds: [], groupId: null }) });
  expect(invalidBody.status).toBe(400);
});

it("matches existing favorites by content across renamed/cached audio and updates after un-favorite/delete", async () => {
  const created = await (await post({ ...asset, favorite: true })).json();
  const id = created[0].id;
  await mkdir(path.join(directory, "audios"));
  await writeFile(path.join(directory, "audios", "renamed.wav"), Buffer.from("AAAA", "base64"));
  expect(await status([hash("AAAA"), "/api/audio-cache/renamed.wav", hash("AQID")])).toEqual([true, true, false]);
  await writeFile(path.join(directory, "audios", "renamed.wav"), Buffer.from([1, 2, 3, 4]));
  expect(await status(["/api/audio-cache/renamed.wav"])).toEqual([false]);
  await fetch(`${base}/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ favorite: false }) });
  expect(await status([hash("AAAA")])).toEqual([false]);
  await fetch(`${base}/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ favorite: true }) });
  expect(await status([hash("AAAA")])).toEqual([true]);
  await fetch(`${base}/${id}`, { method: "DELETE" });
  expect(await status([hash("AAAA")])).toEqual([false]);
});

it("recognizes legacy favorites without new metadata and follows the current storage directory", async () => {
  await writeFile(path.join(directory, "voice-library.json"), JSON.stringify([{ ...asset, id: "legacy", favorite: true }]));
  expect(await status([hash("AAAA")])).toEqual([true]);
  const original = directory;
  try {
    directory = path.join(original, "other-data"); await mkdir(directory);
    expect(await status([hash("AAAA")])).toEqual([false]);
  } finally { directory = original; }
});

it("rejects invalid status batches and never resolves external or traversal audio paths", async () => {
  await post({ ...asset, favorite: true });
  expect(await status(["https://example.com/a.wav", "/api/audio-cache/../voice.wav", "/api/audio-cache/..%5cvoice.wav", "/api/audio-cache/no-file.wav"])).toEqual([false, false, false, false]);
  expect((await fetch(`${base}/favorite-status?sources=bad-json`)).status).toBe(400);
  expect((await fetch(`${base}/favorite-status?sources=${encodeURIComponent(JSON.stringify(Array(65).fill(hash("AAAA"))))}`)).status).toBe(400);
});
it("serializes concurrent writes and rejects invalid/remote audio", async () => {
  await Promise.all([post(asset), post({ ...asset, name: "角色二" })]); expect(await (await fetch(base)).json()).toHaveLength(2);
  expect((await post({ ...asset, name: "" })).status).toBe(400);
  expect((await post({ ...asset, audio: { ...asset.audio, dataUrl: "https://example.com/secret.wav" } })).status).toBe(400);
  expect((await post({ ...asset, audio: { ...asset.audio, dataUrl: "data:audio/wav;base64,==" } })).status).toBe(400);
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

it('writes favorites using the chosen Chinese name, real audio extension and unchanged bytes', async () => {
  const entries = await (await post({ ...asset, name: '兔女郎.mp3', favorite: true, audio: { fileName: 'unrelated.wav', mimeType: 'audio/wav', dataUrl: 'data:audio/mpeg;base64,AQIDBA==' } })).json();
  expect(entries[0].localAudioFileName).toBe('兔女郎.mp3');
  expect(entries[0].audio.fileName).toBe('unrelated.wav');
  expect(await readFile(path.join(directory, 'role-voice-library', '兔女郎.mp3'))).toEqual(Buffer.from([1, 2, 3, 4]));
  const recorded = await (await post({ ...asset, name: '现场录音', audio: { ...asset.audio, dataUrl: 'data:audio/webm;base64,AAEC' } })).json();
  expect(recorded[1].localAudioFileName).toBe('现场录音.webm');
});

it('serializes duplicate names without overwriting different audio or unrelated files', async () => {
  const root = path.join(directory, 'role-voice-library'); await mkdir(root);
  await writeFile(path.join(root, '金毛队长.wav'), 'keep-user-file');
  const bodies = ['AQID', 'BAUG', 'BwgJ'].map(data => ({ ...asset, name: '金毛队长', favorite: true, audio: { ...asset.audio, dataUrl: `data:audio/wav;base64,${data}` } }));
  const responses = await Promise.all(bodies.map(post)); expect(responses.every(response => response.status === 201)).toBe(true);
  const entries = await (await fetch(base)).json();
  expect(entries.map((entry: any) => entry.localAudioFileName).sort()).toEqual(['金毛队长 (2).wav', '金毛队长 (3).wav', '金毛队长 (4).wav']);
  for (const entry of entries) expect(await readFile(path.join(root, entry.localAudioFileName))).toEqual(Buffer.from(entry.audio.dataUrl.split(',')[1], 'base64'));
  expect(await readFile(path.join(root, '金毛队长.wav'), 'utf8')).toBe('keep-user-file');
  const repeated = await (await post(bodies[0])).json();
  expect(repeated.at(-1).localAudioFileName).toBe(entries.find((entry: any) => entry.audio.dataUrl === bodies[0].audio.dataUrl).localAudioFileName);
  expect((await readdir(root)).filter(name => name.endsWith('.wav'))).toHaveLength(4);
});

it('backfills existing favorites on opening, recreates missing copies and leaves legacy source data intact', async () => {
  const legacy = JSON.stringify([{ ...asset, id: 'legacy', name: '原有收藏', favorite: true }, { ...asset, id: 'text-only', name: '文字角色', audio: undefined }]);
  await writeFile(path.join(directory, 'voice-library.json'), legacy);
  const root = path.join(directory, 'role-voice-library'), index = path.join(root, 'assets.json');
  const first = await (await fetch(base)).json();
  expect(first[0].localAudioFileName).toBe('原有收藏.wav'); expect(first[1].localAudioFileName).toBeUndefined();
  const modified = (await stat(index)).mtimeMs;
  await fetch(base);
  expect((await stat(index)).mtimeMs).toBe(modified);
  expect((await readdir(root)).filter(name => name.endsWith('.wav'))).toEqual(['原有收藏.wav']);
  await unlink(path.join(root, '原有收藏.wav')); await fetch(base);
  expect(await readFile(path.join(root, '原有收藏.wav'))).toEqual(Buffer.from('AAAA', 'base64'));
  expect(await readFile(path.join(directory, 'voice-library.json'), 'utf8')).toBe(legacy);
  await writeFile(path.join(root, '原有收藏.wav'), 'user-edited');
  const restored = await (await fetch(base)).json();
  expect(restored[0].localAudioFileName).toBe('原有收藏 (2).wav');
  expect(await readFile(path.join(root, '原有收藏.wav'), 'utf8')).toBe('user-edited');
});

it('keeps generated file paths relative and moves named audio with the data directory', async () => {
  const original = directory, source = path.join(original, 'source'), target = path.join(original, 'target');
  try {
    directory = source;
    const created = await (await post({ ...asset, name: '迁移角色', favorite: true })).json();
    await prepareStorageMigration(source, target);
    directory = target;
    const migrated = await (await fetch(base)).json();
    expect(migrated[0].localAudioFileName).toBe(created[0].localAudioFileName);
    expect(await readFile(path.join(target, 'role-voice-library', '迁移角色.wav'))).toEqual(await readFile(path.join(source, 'role-voice-library', '迁移角色.wav')));
    expect(await status([hash('AAAA')])).toEqual([true]);
    await post({ ...asset, name: '迁移后保存' });
    expect(await readFile(path.join(target, 'role-voice-library', '迁移后保存.wav'))).toEqual(Buffer.from('AAAA', 'base64'));
    expect(await readdir(path.join(source, 'role-voice-library'))).not.toContain('迁移后保存.wav');
  } finally { directory = original; }
});
