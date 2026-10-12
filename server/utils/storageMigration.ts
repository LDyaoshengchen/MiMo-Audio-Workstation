import { constants } from "node:fs";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rename, rm, lstat, realpath } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

const error = (message: string) => Object.assign(new Error(message), { status: 409 });
const hash = (data: Buffer) => createHash("sha256").update(data).digest("hex");

/** 复制后校验；冲突文件留备份，失败只撤回本次修改，绝不删除来源数据。 */
export async function prepareStorageMigration(sourceDir: string, targetDir: string) {
  await mkdir(targetDir, { recursive: true });
  const source = await realpath(sourceDir);
  const target = await realpath(targetDir);
  const relative = path.relative(source, target);
  const reverse = path.relative(target, source);
  if (!relative) return { backupDir: "", rollback: async () => {} };
  if ((!relative.startsWith("..") && !path.isAbsolute(relative)) || (!reverse.startsWith("..") && !path.isAbsolute(reverse))) {
    throw error("新旧存储目录不能互相包含，请选择独立目录。");
  }
  const files: string[] = [];
  async function collect(name: string) {
    const location = path.join(source, name);
    let info;
    try { info = await lstat(location); }
    catch (e: any) { if (e.code === "ENOENT") return; throw e; }
    if (info.isSymbolicLink()) throw error("存储目录含符号链接，迁移已停止以保护数据。");
    if (info.isDirectory()) for (const child of await readdir(location)) await collect(path.join(name, child));
    else if (info.isFile()) files.push(name);
  }
  for (const entry of ["audios", "workspaces", "workspaces.json", "templates.json", "voice-library.json", "role-voice-library"]) await collect(entry);
  const backupDir = await mkdtemp(path.join(target, ".migration-backup-"));
  const changes: Array<{ destination: string; backup?: string; copied: boolean }> = [];
  async function rollback() {
    for (const entry of [...changes].reverse()) {
      if (entry.copied) await rm(entry.destination, { force: true });
      if (entry.backup) await rename(entry.backup, entry.destination);
    }
    // 备份目录不递归删除，保留恢复线索。
  }
  try {
    for (const name of files) {
      const from = path.join(source, name);
      const destination = path.join(target, name);
      // 拒绝目标链路中的链接，避免写出选定目录。
      let cursor = destination;
      while (cursor !== target) {
        try { if ((await lstat(cursor)).isSymbolicLink()) throw error("目标路径含符号链接，迁移已停止。"); }
        catch (e: any) { if (e.code !== "ENOENT") throw e; }
        cursor = path.dirname(cursor);
      }
      const contents = await readFile(from);
      let existing: Buffer | undefined;
      try { existing = await readFile(destination); }
      catch (e: any) { if (e.code !== "ENOENT") throw e; }
      if (existing && hash(existing) === hash(contents)) continue;
      await mkdir(path.dirname(destination), { recursive: true });
      const entry: { destination: string; backup?: string; copied: boolean } = { destination, copied: false };
      changes.push(entry);
      if (existing) {
        entry.backup = path.join(backupDir, name);
        await mkdir(path.dirname(entry.backup), { recursive: true });
        await rename(destination, entry.backup);
      }
      await copyFile(from, destination, constants.COPYFILE_EXCL);
      entry.copied = true;
      if (hash(await readFile(destination)) !== hash(contents)) throw error(`文件校验失败：${name}`);
    }
    return { backupDir, rollback };
  } catch (e) {
    await rollback();
    throw e;
  }
}
