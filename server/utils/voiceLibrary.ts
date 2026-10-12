import type { Express } from "express";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type VoiceLibraryAsset = { id: string; name: string; description: string; naturalControl: string; voiceId: string; provider: string; favorite?: boolean; audio?: { fileName: string; mimeType: string; size: number; dataUrl: string } };
export function registerVoiceLibrary(app: Express, getDataDir: () => string) {
  let queue = Promise.resolve();
  const read = async (directory: string): Promise<VoiceLibraryAsset[]> => {
    try { return JSON.parse(await readFile(path.join(directory, "role-voice-library", "assets.json"), "utf8")); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      try { return JSON.parse(await readFile(path.join(directory, "voice-library.json"), "utf8")); }
      catch (legacyError) { if ((legacyError as NodeJS.ErrnoException).code === "ENOENT") return []; throw legacyError; }
    }
  };
  app.get("/api/voice-library", async (_request, response, next) => { try { await queue; response.json(await read(getDataDir())); } catch (error) { next(error); } });
  app.get("/api/voice-library/location", (_request, response) => response.json({ directory: path.join(getDataDir(), "role-voice-library") }));
  const update = (mutation: (assets: VoiceLibraryAsset[]) => VoiceLibraryAsset[]) => {
    const directory = getDataDir();
    const operation = queue.then(async () => {
      const assets = mutation(await read(directory)); const libraryDirectory = path.join(directory, "role-voice-library"); await mkdir(libraryDirectory, { recursive: true });
      const temporary = path.join(libraryDirectory, `assets-${randomUUID()}.tmp`);
      await writeFile(temporary, JSON.stringify(assets), "utf8"); await rename(temporary, path.join(libraryDirectory, "assets.json")); return assets;
    }); queue = operation.then(() => {}, () => {}); return operation;
  };
  app.post("/api/voice-library", async (request, response, next) => {
    try {
      const input = request.body;
      if (typeof input.name !== "string" || !input.name.trim() || input.name.length > 120) throw Object.assign(new Error("角色名称不能为空，且不能超过 120 字。"), { status: 400 });
      const audio = input.audio;
      if (audio && (typeof audio.dataUrl !== "string" || audio.dataUrl.length > 11 * 1024 * 1024 || !/^data:audio\/[\w.+-]+;base64,[A-Za-z0-9+/=]+$/.test(audio.dataUrl))) throw Object.assign(new Error("参考音频需要是有效音频数据，大小不超过 7.5MB。"), { status: 400 });
      const audioSize = audio ? Buffer.from(audio.dataUrl.split(",")[1], "base64").length : 0;
      if (audioSize > 7.5 * 1024 * 1024) throw Object.assign(new Error("参考音频大小不能超过 7.5MB。"), { status: 400 });
      const text = (key: string) => typeof input[key] === "string" ? input[key].slice(0, 16000) : "";
      const asset: VoiceLibraryAsset = { id: randomUUID(), name: input.name.trim(), description: text("description"), naturalControl: text("naturalControl"), voiceId: text("voiceId"), provider: text("provider"), favorite: input.favorite === true, ...(audio ? { audio: { fileName: String(audio.fileName || "reference.wav").slice(0, 160), mimeType: String(audio.mimeType || "audio/wav").slice(0, 80), size: audioSize, dataUrl: audio.dataUrl } } : {}) };
      response.status(201).json(await update(assets => [...assets, asset]));
    } catch (error) { next(error); }
  });
  app.patch("/api/voice-library/:id", async (request, response, next) => { try {
    if (typeof request.body.favorite !== "boolean") throw Object.assign(new Error("收藏状态无效。"), { status: 400 });
    response.json(await update(assets => { if (!assets.some(asset => asset.id === request.params.id)) throw Object.assign(new Error("角色资产不存在。"), { status: 404 }); return assets.map(asset => asset.id === request.params.id ? { ...asset, favorite: request.body.favorite } : asset); }));
  } catch (error) { next(error); } });
  app.delete("/api/voice-library/:id", async (request, response, next) => { try { response.json(await update(assets => assets.filter(asset => asset.id !== request.params.id))); } catch (error) { next(error); } });
}
