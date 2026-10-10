import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, rm, lstat } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { prepareStorageMigration } from "../server/utils/storageMigration";

describe("transactional data-directory migration", () => {
  const temporary: string[] = [];
  afterEach(async () => { for (const dir of temporary.splice(0)) await rm(dir, { recursive: true, force: true }); });
  async function fixture() {
    const root = await mkdtemp(path.join(tmpdir(), "mimo-migration-test-")); temporary.push(root);
    const source = path.join(root, "source"), target = path.join(root, "target");
    await mkdir(path.join(source, "audios"), { recursive: true });
    await mkdir(path.join(source, "workspaces"));
    await writeFile(path.join(source, "audios", "voice.wav"), "audio-fixture");
    await writeFile(path.join(source, "workspaces", "board.json"), '{"id":"board"}');
    await writeFile(path.join(source, "templates.json"), '[]');
    await writeFile(path.join(source, "settings.json"), '{"apiKey":"not-for-migration"}');
    return { source, target };
  }
  it("copies audios, workspace files and templates while retaining originals and leaving credentials fixed", async () => {
    const { source, target } = await fixture();
    await prepareStorageMigration(source, target);
    for (const file of ["audios/voice.wav", "workspaces/board.json", "templates.json"]) {
      expect(await readFile(path.join(target, file))).toEqual(await readFile(path.join(source, file)));
    }
    await expect(lstat(path.join(target, "settings.json"))).rejects.toMatchObject({ code: "ENOENT" });
  });
  it("backs up conflicting destination files and restores them if commit fails", async () => {
    const { source, target } = await fixture();
    await mkdir(path.join(target, "audios"), { recursive: true });
    await writeFile(path.join(target, "audios", "voice.wav"), "old-destination");
    const transaction = await prepareStorageMigration(source, target);
    expect(await readFile(path.join(transaction.backupDir, "audios/voice.wav"), "utf8")).toBe("old-destination");
    await transaction.rollback();
    expect(await readFile(path.join(target, "audios/voice.wav"), "utf8")).toBe("old-destination");
    expect(await readFile(path.join(source, "audios/voice.wav"), "utf8")).toBe("audio-fixture");
  });
  it("rejects nested directories before copying", async () => {
    const { source } = await fixture();
    await expect(prepareStorageMigration(source, path.join(source, "nested"))).rejects.toThrow("不能互相包含");
  });
});
