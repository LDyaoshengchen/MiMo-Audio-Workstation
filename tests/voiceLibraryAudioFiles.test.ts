import { afterEach, beforeEach, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import { mkdtemp, mkdir, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { registerVoiceLibrary, type VoiceLibraryAsset } from "../server/utils/voiceLibrary";
import { prepareRoleAudioFiles, roleAudioFileStem } from "../server/utils/voiceLibraryAudioFiles";

const faults = vi.hoisted(() => ({ rename: false, diskFull: false }));
vi.mock("node:fs/promises", async importOriginal => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return { ...actual,
    rename: async (...args: Parameters<typeof actual.rename>) => {
      if (faults.rename) throw Object.assign(new Error("index commit denied"), { code: "EACCES" });
      return actual.rename(...args);
    },
    open: async (...args: Parameters<typeof actual.open>) => {
      if (faults.diskFull && String(args[0]).includes("磁盘满")) throw Object.assign(new Error("disk full"), { code: "ENOSPC" });
      return actual.open(...args);
    },
  };
});
let directory: string, server: Server | undefined;
beforeEach(async () => { directory = await mkdtemp(path.join(os.tmpdir(), "mimo-role-files-")); faults.rename = false; faults.diskFull = false; });
afterEach(async () => {
  faults.rename = false; faults.diskFull = false;
  if (server) { server.closeAllConnections(); await new Promise<void>(resolve => server!.close(() => resolve())); server = undefined; }
  await rm(directory, { recursive: true, force: true });
});
const asset = (name: string): VoiceLibraryAsset => ({ id: name, name, description: "", naturalControl: "", voiceId: "", provider: "mimo", favorite: true, audio: { fileName: "original.wav", mimeType: "audio/wav", size: 3, dataUrl: "data:audio/wav;base64,AQID" } });

it.each([
  ["兔女郎", "兔女郎"], ["  金毛队长. ", "金毛队长"], ["../坏:名/称\\test?*", "_坏_名_称_test__"],
  ["CON", "_CON"], ["nul.wav", "_nul.wav"], ["LPT1", "_LPT1"], ["..", "角色音频"], ["\u0000音\n频", "_音_频"],
])("uses safe Windows names without losing Chinese characters: %s", (input, expected) => {
  expect(roleAudioFileStem(input)).toBe(expected);
});

it("limits long names without splitting emoji and ignores unsafe metadata paths", async () => {
  const item = { ...asset("🐱".repeat(120)), localAudioFileName: "../../outside.wav" };
  const result = await prepareRoleAudioFiles(directory, [item]);
  expect(Array.from(result.assets[0].localAudioFileName!)).toHaveLength(49);
  expect(await readFile(path.join(directory, "role-voice-library", result.assets[0].localAudioFileName!))).toEqual(Buffer.from([1, 2, 3]));
  expect(await readdir(directory)).toEqual(["role-voice-library"]);
});

it("treats existing directories as collisions and rejects a linked library directory", async () => {
  const root = path.join(directory, "role-voice-library");
  await mkdir(path.join(root, "角色.wav"), { recursive: true });
  expect((await prepareRoleAudioFiles(directory, [asset("角色")])).assets[0].localAudioFileName).toBe("角色 (2).wav");
  const otherData = path.join(directory, "other-data"), outside = path.join(directory, "outside");
  await mkdir(otherData); await mkdir(outside);
  await symlink(outside, path.join(otherData, "role-voice-library"), process.platform === "win32" ? "junction" : "dir");
  await expect(prepareRoleAudioFiles(otherData, [asset("不能越界")])).rejects.toThrow("符号链接");
  expect(await readdir(outside)).toEqual([]);
});

it("retains unsupported legacy records and never fetches remote audio", async () => {
  const items = [asset("remote"), asset("invalid"), { ...asset("文字"), audio: undefined }];
  items[0].audio!.dataUrl = "https://example.invalid/audio.wav";
  items[1].audio!.dataUrl = "data:audio/wav;base64,%%%";
  const result = await prepareRoleAudioFiles(directory, items);
  expect(result.assets).toEqual(items); expect(await readdir(directory)).toEqual([]);
});

it("rolls back only newly created audio copies if a later audio write fails", async () => {
  const root = path.join(directory, "role-voice-library"); await mkdir(root);
  await writeFile(path.join(root, "原有.wav"), Buffer.from([1, 2, 3]));
  faults.diskFull = true;
  await expect(prepareRoleAudioFiles(directory, [asset("原有"), asset("新保存"), asset("磁盘满")])).rejects.toThrow("角色音频文件保存失败");
  expect(await readdir(root)).toEqual(["原有.wav"]);
  expect(await readFile(path.join(root, "原有.wav"))).toEqual(Buffer.from([1, 2, 3]));
});

it("reports save failure and rolls back new files if the role index cannot commit", async () => {
  const app = express(); app.use(express.json()); registerVoiceLibrary(app, () => directory);
  app.use((error: Error, _request: any, response: any, _next: any) => response.status(500).json({ error: error.message }));
  server = await new Promise<Server>(resolve => { const pending = app.listen(0, "127.0.0.1", () => resolve(pending)); });
  const base = `http://127.0.0.1:${(server.address() as any).port}/api/voice-library`;
  const post = (name: string) => fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(asset(name)) });
  expect((await post("原有")).status).toBe(201);
  const root = path.join(directory, "role-voice-library"), originalIndex = await readFile(path.join(root, "assets.json"), "utf8");
  faults.rename = true;
  expect((await post("不能提交")).status).toBe(500);
  expect(await readFile(path.join(root, "assets.json"), "utf8")).toBe(originalIndex);
  expect((await readdir(root)).sort()).toEqual(["assets.json", "原有.wav"].sort());
  faults.rename = false;
  expect((await post("不能提交")).status).toBe(201);
  expect(await readFile(path.join(root, "不能提交.wav"))).toEqual(Buffer.from([1, 2, 3]));
});
