import type { Express } from "express";
import { mkdir, readFile, writeFile, rename, unlink, lstat } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { registerVoiceFavoriteStatus } from "./voiceFavoriteStatus";
import { prepareRoleAudioFiles } from "./voiceLibraryAudioFiles";

export type VoiceLibraryAsset = { id: string; name: string; description: string; naturalControl: string; voiceId: string; provider: string; voiceAssetMode?: "preset"; language?: string; gender?: string; favorite?: boolean; groupId?: string; localAudioFileName?: string; audio?: { fileName: string; mimeType: string; size: number; dataUrl: string } };
export type VoiceLibraryGroup = { id: string; name: string };
export function registerVoiceLibrary(app: Express, getDataDir: () => string) {
  let queue = Promise.resolve();
  const enqueue = <T,>(operation: () => Promise<T>) => {
    const pending = queue.then(operation);
    queue = pending.then(() => {}, () => {});
    return pending;
  };
  const read = async (directory: string): Promise<VoiceLibraryAsset[]> => {
    try { return JSON.parse(await readFile(path.join(directory, "role-voice-library", "assets.json"), "utf8")); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      try { return JSON.parse(await readFile(path.join(directory, "voice-library.json"), "utf8")); }
      catch (legacyError) { if ((legacyError as NodeJS.ErrnoException).code === "ENOENT") return []; throw legacyError; }
    }
  };
  const readGroups = async (directory: string): Promise<VoiceLibraryGroup[]> => {
    try {
      const groups = JSON.parse(await readFile(path.join(directory, "role-voice-library", "groups.json"), "utf8"));
      return Array.isArray(groups) ? groups.filter(group => typeof group?.id === "string" && typeof group?.name === "string") : [];
    } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
  };
  const writeJson = async (directory: string, fileName: string, value: unknown) => {
    const folder = path.join(directory, "role-voice-library");
    const temporary = path.join(folder, `${fileName}-${randomUUID()}.tmp`);
    try {
      await mkdir(folder, { recursive: true });
      const folderInfo = await lstat(folder);
      if (folderInfo.isSymbolicLink() || !folderInfo.isDirectory()) throw new Error("角色库目录不能是符号链接或普通文件。");
      await writeFile(temporary, JSON.stringify(value), { encoding: "utf8", flag: "wx" });
      await rename(temporary, path.join(folder, fileName));
    } catch (error) { await unlink(temporary).catch(() => {}); throw error; }
  };
  registerVoiceFavoriteStatus(app, getDataDir, read, () => queue);
  app.get("/api/voice-library", async (_request, response, next) => { try { response.setHeader("Cache-Control", "no-store"); response.json(await update(assets => assets, true)); } catch (error) { next(error); } });
  app.get("/api/voice-library/location", (_request, response) => response.json({ directory: path.join(getDataDir(), "role-voice-library") }));
  const update = (mutation: (assets: VoiceLibraryAsset[]) => VoiceLibraryAsset[], onlyIfChanged = false, validate?: (directory: string) => Promise<void>) => {
    const directory = getDataDir();
    return enqueue(async () => {
      await validate?.(directory);
      const previous = await read(directory);
      const prepared = await prepareRoleAudioFiles(directory, mutation(previous));
      const assets = prepared.assets;
      if (onlyIfChanged && assets.length === previous.length && assets.every((asset, index) => asset === previous[index])) return assets;
      try { await writeJson(directory, "assets.json", assets); return assets; }
      catch (error) { await prepared.rollback(); throw error; }
    });
  };
  app.get("/api/voice-library/groups", async (_request, response, next) => {
    try { response.setHeader("Cache-Control", "no-store"); response.json(await queue.then(() => readGroups(getDataDir()))); }
    catch (error) { next(error); }
  });
  app.post("/api/voice-library/groups", async (request, response, next) => {
    try {
      const name = typeof request.body?.name === "string" ? request.body.name.trim() : "";
      if (!name || name.length > 60) throw Object.assign(new Error("分组名称不能为空，且不能超过 60 个字符。"), { status: 400 });
      const groups = await enqueue(async () => {
        const directory = getDataDir(), previous = await readGroups(directory);
        if (previous.some(group => group.name.toLocaleLowerCase() === name.toLocaleLowerCase())) throw Object.assign(new Error("已存在同名分组。"), { status: 409 });
        const next = [...previous, { id: randomUUID(), name }];
        await writeJson(directory, "groups.json", next); return next;
      });
      response.status(201).json(groups);
    } catch (error) { next(error); }
  });
  app.patch("/api/voice-library/groups/:id", async (request, response, next) => {
    try {
      const name = typeof request.body?.name === "string" ? request.body.name.trim() : "";
      if (!name || name.length > 60) throw Object.assign(new Error("分组名称不能为空，且不能超过 60 个字符。"), { status: 400 });
      response.json(await enqueue(async () => {
        const directory = getDataDir(), previous = await readGroups(directory);
        if (!previous.some(group => group.id === request.params.id)) throw Object.assign(new Error("分组不存在。"), { status: 404 });
        if (previous.some(group => group.id !== request.params.id && group.name.toLocaleLowerCase() === name.toLocaleLowerCase())) throw Object.assign(new Error("已存在同名分组。"), { status: 409 });
        const next = previous.map(group => group.id === request.params.id ? { ...group, name } : group);
        await writeJson(directory, "groups.json", next); return next;
      }));
    } catch (error) { next(error); }
  });
  app.patch("/api/voice-library/bulk-group", async (request, response, next) => {
    try {
      const rawIds = request.body?.assetIds;
      const groupValue = request.body?.groupId;
      if (!Array.isArray(rawIds) || rawIds.length === 0 || rawIds.length > 500 || rawIds.some(id => typeof id !== "string" || !id.trim()) || (groupValue !== null && typeof groupValue !== "string")) {
        throw Object.assign(new Error("批量移动内容无效，请重新选择角色。"), { status: 400 });
      }
      const assetIds = [...new Set((rawIds as string[]).map(id => id.trim()))];
      const selectedIds = new Set(assetIds);
      const groupId = typeof groupValue === "string" ? groupValue.trim() : "";
      response.json(await update(assets => {
        const foundIds = new Set(assets.filter(asset => selectedIds.has(asset.id)).map(asset => asset.id));
        if (foundIds.size !== selectedIds.size) throw Object.assign(new Error("部分角色资产已不存在，请刷新角色库后重试。"), { status: 404 });
        return assets.map(asset => selectedIds.has(asset.id) ? { ...asset, groupId: groupId || undefined } : asset);
      }, false, async directory => {
        if (groupId && !(await readGroups(directory)).some(group => group.id === groupId)) throw Object.assign(new Error("所选分组不存在，请刷新后重试。"), { status: 404 });
      }));
    } catch (error) { next(error); }
  });
  app.delete("/api/voice-library/groups/:id", async (request, response, next) => {
    try {
      const result = await enqueue(async () => {
        const directory = getDataDir(), groups = await readGroups(directory);
        if (!groups.some(group => group.id === request.params.id)) throw Object.assign(new Error("分组不存在。"), { status: 404 });
        const assets = (await read(directory)).map(asset => asset.groupId === request.params.id ? { ...asset, groupId: undefined } : asset);
        const nextGroups = groups.filter(group => group.id !== request.params.id);
        await writeJson(directory, "assets.json", assets);
        await writeJson(directory, "groups.json", nextGroups);
        return { groups: nextGroups, assets };
      });
      response.json(result);
    } catch (error) { next(error); }
  });
  app.post("/api/voice-library", async (request, response, next) => {
    try {
      const input = request.body;
      if (typeof input.name !== "string" || !input.name.trim() || input.name.length > 120) throw Object.assign(new Error("角色名称不能为空，且不能超过 120 字。"), { status: 400 });
      const audio = input.audio;
      if (audio && (typeof audio.dataUrl !== "string" || audio.dataUrl.length > 11 * 1024 * 1024 || !/^data:audio\/[\w.+-]+;base64,[A-Za-z0-9+/=]+$/.test(audio.dataUrl))) throw Object.assign(new Error("参考音频需要是有效音频数据，大小不超过 7.5MB。"), { status: 400 });
      const audioSize = audio ? Buffer.from(audio.dataUrl.split(",")[1], "base64").length : 0;
      if (audio && !audioSize) throw Object.assign(new Error("参考音频不能为空。"), { status: 400 });
      if (audioSize > 7.5 * 1024 * 1024) throw Object.assign(new Error("参考音频大小不能超过 7.5MB。"), { status: 400 });
      const text = (key: string) => typeof input[key] === "string" ? input[key].slice(0, 16000) : "";
      const groupId = typeof input.groupId === "string" ? input.groupId.trim() : "";
      if (input.groupId != null && typeof input.groupId !== "string") throw Object.assign(new Error("所选分组无效。"), { status: 400 });
      if (input.voiceAssetMode != null && (input.voiceAssetMode !== "preset" || input.provider !== "mimo" || !text("voiceId"))) throw Object.assign(new Error("预置音色资产信息无效。"), { status: 400 });
      const asset: VoiceLibraryAsset = { id: randomUUID(), name: input.name.trim(), description: text("description"), naturalControl: text("naturalControl"), voiceId: text("voiceId"), provider: text("provider"), ...(text("language") ? { language: text("language").slice(0, 40) } : {}), ...(text("gender") ? { gender: text("gender").slice(0, 40) } : {}), ...(input.voiceAssetMode === "preset" ? { voiceAssetMode: "preset" as const } : {}), favorite: input.favorite === true, ...(groupId ? { groupId } : {}), ...(audio ? { audio: { fileName: String(audio.fileName || "reference.wav").slice(0, 160), mimeType: String(audio.mimeType || "audio/wav").slice(0, 80), size: audioSize, dataUrl: audio.dataUrl } } : {}) };
      response.status(201).json(await update(assets => [...assets, asset], false, async directory => {
        if (groupId && !(await readGroups(directory)).some(group => group.id === groupId)) throw Object.assign(new Error("所选分组不存在。"), { status: 404 });
      }));
    } catch (error) { next(error); }
  });
  app.patch("/api/voice-library/:id", async (request, response, next) => { try {
    const body = request.body || {};
    const nameProvided = Object.prototype.hasOwnProperty.call(body, "name");
    const favoriteProvided = Object.prototype.hasOwnProperty.call(body, "favorite");
    const groupProvided = Object.prototype.hasOwnProperty.call(body, "groupId");
    const groupId = typeof body.groupId === "string" ? body.groupId.trim() : "";
    if (nameProvided && (typeof body.name !== "string" || !body.name.trim() || body.name.length > 120)) throw Object.assign(new Error("角色名称不能为空，且不能超过 120 字。"), { status: 400 });
    if ((!nameProvided && !favoriteProvided && !groupProvided) || (favoriteProvided && typeof body.favorite !== "boolean") || (groupProvided && typeof body.groupId !== "string" && body.groupId !== null)) throw Object.assign(new Error("角色资产更新内容无效。"), { status: 400 });
    response.json(await update(assets => {
      if (!assets.some(asset => asset.id === request.params.id)) throw Object.assign(new Error("角色资产不存在。"), { status: 404 });
      return assets.map(asset => asset.id === request.params.id ? { ...asset, ...(nameProvided ? { name: body.name.trim() } : {}), ...(favoriteProvided ? { favorite: body.favorite } : {}), ...(groupProvided ? { groupId: groupId || undefined } : {}) } : asset);
    }, false, async directory => {
      if (groupId && !(await readGroups(directory)).some(group => group.id === groupId)) throw Object.assign(new Error("所选分组不存在。"), { status: 404 });
    }));
  } catch (error) { next(error); } });
  app.delete("/api/voice-library/:id", async (request, response, next) => { try { response.json(await update(assets => assets.filter(asset => asset.id !== request.params.id))); } catch (error) { next(error); } });
  return { settled: () => queue };
}
