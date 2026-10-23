import { lstat, mkdir, open, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import type { VoiceLibraryAsset } from "./voiceLibrary";

const maxAudioBytes = 7.5 * 1024 * 1024;
const extensions: Record<string, string> = {
  wav: ".wav", "x-wav": ".wav", wave: ".wav", "vnd.wave": ".wav",
  mpeg: ".mp3", mp3: ".mp3", "x-mp3": ".mp3", "x-mpeg": ".mp3",
  mp4: ".m4a", m4a: ".m4a", "x-m4a": ".m4a", aac: ".aac", "x-aac": ".aac",
  ogg: ".ogg", opus: ".opus", flac: ".flac", "x-flac": ".flac", webm: ".webm",
  aiff: ".aiff", "x-aiff": ".aiff", basic: ".au",
};

export function roleAudioFileStem(name: string) {
  let stem = Array.from(name.normalize("NFC").replace(/[<>:"/\\|?*\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/g, "_").trim().replace(/^\.+|[.\s]+$/g, "")).slice(0, 100).join("").replace(/[.\s]+$/g, "") || "角色音频";
  while (Buffer.byteLength(stem, "utf8") > 180) stem = Array.from(stem).slice(0, -1).join("");
  if (/^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(stem)) stem = `_${stem}`;
  return stem;
}

/** Materialize portable copies, never overwrite user files; keep embedded audio for canvas reuse. */
export async function prepareRoleAudioFiles(directory: string, assets: VoiceLibraryAsset[]) {
  const root = path.join(directory, "role-voice-library");
  const created: string[] = [];
  const rollback = async () => { for (const file of created) await unlink(file).catch(() => {}); };
  let ready = false;
  async function ensureRoot() {
    if (ready) return;
    await mkdir(root, { recursive: true });
    const info = await lstat(root);
    if (info.isSymbolicLink() || !info.isDirectory()) throw new Error("角色库目录不能是符号链接或普通文件。");
    ready = true;
  }
  async function useFile(fileName: string, bytes: Buffer) {
    const file = path.join(root, fileName);
    let handle;
    try { handle = await open(file, "wx"); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const info = await lstat(file);
      // A link or unrelated file is a name collision, not permission to replace it.
      return info.isFile() && !info.isSymbolicLink() && info.size === bytes.length && bytes.equals(await readFile(file));
    }
    created.push(file);
    try { await handle.writeFile(bytes); }
    finally { await handle.close(); }
    return true;
  }
  try {
    const next: VoiceLibraryAsset[] = [];
    for (const asset of assets) {
      const encoded = asset.audio?.dataUrl;
      const match = typeof encoded === "string" && encoded.length <= 11 * 1024 * 1024 ? encoded.match(/^data:audio\/([\w.+-]+);base64,([A-Za-z0-9+/=]+)$/) : null;
      // Old text-only or invalid legacy records must remain readable and untouched.
      if (!match) { next.push(asset); continue; }
      const bytes = Buffer.from(match[2], "base64");
      if (!bytes.length || bytes.length > maxAudioBytes) { next.push(asset); continue; }
      await ensureRoot();
      const originalExtension = path.extname(asset.audio?.fileName || "").toLowerCase();
      const extension = extensions[match[1].toLowerCase()] || (Object.values(extensions).includes(originalExtension) ? originalExtension : ".audio");
      let stem = roleAudioFileStem(asset.name || "角色音频");
      if (stem.length > extension.length && stem.toLowerCase().endsWith(extension)) stem = stem.slice(0, -extension.length).replace(/[.\s]+$/g, "") || "角色音频";
      let fileName = "";
      const preferred = asset.localAudioFileName;
      if (preferred && path.basename(preferred) === preferred && preferred.startsWith(stem) && preferred.endsWith(extension)) {
        const suffix = preferred.slice(stem.length, -extension.length);
        const number = suffix.match(/^ \(([1-9][0-9]*)\)$/);
        if ((suffix === "" || (number && Number.isSafeInteger(Number(number[1])) && Number(number[1]) >= 2)) && await useFile(preferred, bytes)) fileName = preferred;
      }
      for (let attempt = 1; !fileName && attempt <= 10000; attempt++) {
        const candidate = `${stem}${attempt === 1 ? "" : ` (${attempt})`}${extension}`;
        if (await useFile(candidate, bytes)) fileName = candidate;
      }
      if (!fileName) throw new Error("同名音频文件过多，请换一个角色名称后重试。");
      next.push(asset.localAudioFileName === fileName ? asset : { ...asset, localAudioFileName: fileName });
    }
    return { assets: next, rollback };
  } catch (error) {
    await rollback();
    throw new Error(`角色音频文件保存失败，请检查目录权限和磁盘空间。${error instanceof Error ? error.message : ""}`);
  }
}
