import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, rename, unlink, lstat, readdir } from "node:fs/promises";
import path from "node:path";

// Fingerprints separate accounts and audio contents; credentials are never persisted.
const pending = new Map<string, Promise<string>>();
export async function cachedMiniMaxVoice(apiKey: string, bytes: Buffer, directory: string | undefined, create: () => Promise<string>): Promise<string> {
  const key = createHash("sha256").update(apiKey).update("\0").update(bytes).digest("hex");
  const scope = `${directory || ""}:${key}`;
  const existing = pending.get(scope);
  if (existing) return existing;
  const operation = (async () => {
    const folder = directory ? path.join(directory, "minimax-voices") : undefined;
    const file = folder ? path.join(folder, `${key}.json`) : undefined;
    if (folder && file) {
      await mkdir(folder, { recursive: true });
      if ((await lstat(folder)).isSymbolicLink()) throw new Error("MiniMax 音色缓存目录不能为符号链接。");
      try {
        const info = await lstat(file);
        if (!info.isFile() || info.isSymbolicLink() || info.size > 4096) throw new Error("MiniMax 音色缓存无效。");
        const saved = JSON.parse(await readFile(file, "utf8"));
        if (typeof saved.voiceId === "string" && /^[a-zA-Z][\w-]{6,254}[a-zA-Z0-9]$/.test(saved.voiceId)) return saved.voiceId;
        throw new Error("MiniMax 音色缓存无效。");
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    }
    const voiceId = await create();
    if (file) {
      const temporary = `${file}.${randomUUID()}.tmp`;
      try { await writeFile(temporary, JSON.stringify({ voiceId, account: createHash("sha256").update(apiKey).digest("hex") }), { flag: "wx" }); await rename(temporary, file); }
      catch (error) { await unlink(temporary).catch(() => {}); throw error; }
    }
    return voiceId;
  })();
  pending.set(scope, operation);
  try { return await operation; }
  finally { if (pending.get(scope) === operation) pending.delete(scope); }
}

export async function forgetMiniMaxVoice(directory: string | undefined, voiceId: string, apiKey: string) {
  if (!directory) return;
  const folder = path.join(directory, "minimax-voices");
  try {
    if ((await lstat(folder)).isSymbolicLink()) throw new Error("MiniMax 音色缓存目录不能为符号链接。");
    for (const name of await readdir(folder)) {
      if (!/^[a-f0-9]{64}\.json$/.test(name)) continue;
      const file = path.join(folder, name), info = await lstat(file);
      if (!info.isFile() || info.isSymbolicLink() || info.size > 4096) continue;
      const saved = JSON.parse(await readFile(file, "utf8"));
      if (saved.voiceId === voiceId && saved.account === createHash("sha256").update(apiKey).digest("hex")) await unlink(file);
    }
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
}
