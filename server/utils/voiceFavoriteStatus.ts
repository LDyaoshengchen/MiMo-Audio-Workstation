import type { Express } from "express";
import { createHash } from "node:crypto";
import { lstat, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { VoiceLibraryAsset } from "./voiceLibrary";

const digest = (data: Buffer) => createHash("sha256").update(data).digest("hex");
const maxAudioBytes = 7.5 * 1024 * 1024;

/** Lightweight content-based status: no audio payloads are sent back to every star. */
export function registerVoiceFavoriteStatus(app: Express, getDataDir: () => string, read: (directory: string) => Promise<VoiceLibraryAsset[]>, settled: () => Promise<void>) {
  let index: { signature: string; hashes: Promise<Set<string>> } | undefined;
  const files = new Map<string, { signature: string; hash: string }>();
  async function favoriteHashes(directory: string) {
    let file = path.join(directory, "role-voice-library", "assets.json");
    let metadata;
    try { metadata = await stat(file); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      file = path.join(directory, "voice-library.json");
      try { metadata = await stat(file); }
      catch (legacyError) { if ((legacyError as NodeJS.ErrnoException).code === "ENOENT") return new Set<string>(); throw legacyError; }
    }
    const signature = `${file}:${metadata.ino}:${metadata.mtimeMs}:${metadata.ctimeMs}:${metadata.size}`;
    if (index?.signature === signature) return index.hashes;
    const hashes = read(directory).then(assets => new Set(assets.filter(asset => asset.favorite && asset.audio?.dataUrl.startsWith("data:audio/")).map(asset => digest(Buffer.from(asset.audio!.dataUrl.split(",")[1] || "", "base64")))));
    index = { signature, hashes };
    try { return await hashes; } catch (error) { if (index?.hashes === hashes) index = undefined; throw error; }
  }
  async function sourceHash(directory: string, source: string) {
    if (/^sha256:[a-f0-9]{64}$/.test(source)) return source.slice(7);
    if (!source.startsWith("/api/audio-cache/")) return;
    let name;
    try { name = decodeURIComponent(source.slice("/api/audio-cache/".length)); } catch { return; }
    if (!name || /[\\/:\x00-\x1f]/.test(name) || !/\.(wav|mp3|m4a|ogg|flac|aac)$/i.test(name)) return;
    const file = path.join(directory, "audios", name);
    try {
      const metadata = await lstat(file);
      if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > maxAudioBytes) return;
      const signature = `${metadata.ino}:${metadata.mtimeMs}:${metadata.ctimeMs}:${metadata.size}`;
      if (files.get(file)?.signature === signature) return files.get(file)!.hash;
      const hash = digest(await readFile(file));
      if (files.size >= 512) files.delete(files.keys().next().value!);
      files.set(file, { signature, hash }); return hash;
    } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return; throw error; }
  }
  app.get("/api/voice-library/favorite-status", async (request, response, next) => {
    try {
      let sources;
      try { sources = JSON.parse(typeof request.query.sources === "string" ? request.query.sources : "null"); } catch { /* Validated below. */ }
      if (!Array.isArray(sources) || sources.length > 64 || sources.some(source => typeof source !== "string" || source.length > 4096)) throw Object.assign(new Error("收藏状态查询参数无效。"), { status: 400 });
      await settled();
      const directory = getDataDir(), hashes = await favoriteHashes(directory);
      const result: boolean[] = [];
      for (const source of sources as string[]) result.push(hashes.size ? hashes.has(await sourceHash(directory, source) || "") : false);
      response.setHeader("Cache-Control", "no-store"); response.json(result);
    } catch (error) { next(error); }
  });
}
