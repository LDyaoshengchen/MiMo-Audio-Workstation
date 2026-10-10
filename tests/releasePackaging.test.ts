import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const execMock = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({ execFileSync: execMock }));
// Release scripts are intentionally plain Node modules, outside the application TS build.
import { createReleasePaths } from "../scripts/release-paths.js";
import { packageWindows } from "../scripts/package-win.js";

const fixtures: string[] = [];
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mimo-release-test-"));
  fixtures.push(root);
  for (const [name, value] of Object.entries({
    "package.json": JSON.stringify({ version: "0.8.38" }),
    "node_modules/electron/dist/electron.exe": "fake runtime",
    "node_modules/electron/dist/locales/zh-CN.pak": "simplified Chinese",
    "node_modules/electron/dist/locales/en-US.pak": "English",
    "node_modules/electron/dist/locales/zh-TW.pak": "traditional Chinese",
    "node_modules/electron/dist/locales/fr.pak": "French",
    "electron/main.cjs": "fake main", "build/server/index.cjs": "fake server",
    "dist/index.html": "fake UI", ".env": "DO_NOT_PUBLISH",
    "desktop-build/MiMo-Audio-Workstation-win32-x64/user-data.txt": "keep old client",
    "desktop-build/old.zip": "keep old archive",
  })) {
    const file = path.join(root, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, value);
  }
  return root;
}
afterEach(() => {
  execMock.mockReset();
  for (const root of fixtures.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("isolated Windows releases", () => {
  it("uses unique output directories and rejects path-traversal versions", () => {
    const root = fixture();
    const first = createReleasePaths(root, "0.8.38");
    const second = createReleasePaths(root, "0.8.38");
    expect(first.releaseDir).not.toBe(second.releaseDir);
    expect(() => createReleasePaths(root, "../../escape")).toThrow();
  });
  it("preserves old clients and archives, excludes credentials, and skips live syncing", () => {
    const root = fixture();
    execMock.mockImplementation((command, _args, options) => {
      if (command === "powershell.exe") fs.writeFileSync(options.env.MIMO_RELEASE_ZIP, "fake ZIP");
    });
    const release = packageWindows(root);
    expect(fs.existsSync(path.join(release.appOutDir, "MiMo-Audio-Workstation.exe"))).toBe(true);
    expect(fs.existsSync(path.join(release.appOutDir, ".env"))).toBe(false);
    expect(fs.existsSync(path.join(release.appOutDir, "resources/.env"))).toBe(false);
    expect(fs.readFileSync(path.join(root, "desktop-build/old.zip"), "utf8")).toBe("keep old archive");
    expect(fs.readFileSync(path.join(root, "desktop-build/MiMo-Audio-Workstation-win32-x64/user-data.txt"), "utf8")).toBe("keep old client");
    expect(execMock.mock.calls[0][2].env.MIMO_SKIP_DESKTOP_SYNC).toBe("1");
    expect(execMock.mock.calls.some(call => String(call[0]).includes("taskkill"))).toBe(false);
    expect(execMock.mock.calls[1][2].env.MIMO_RELEASE_ZIP).toBe(release.zipPath);
  });
  it("reports archive failure instead of claiming success or deleting existing files", () => {
    const root = fixture();
    execMock.mockImplementation(command => { if (command === "powershell.exe") throw new Error("ZIP failed"); });
    expect(() => packageWindows(root)).toThrow("ZIP failed");
    expect(fs.readFileSync(path.join(root, "desktop-build/old.zip"), "utf8")).toBe("keep old archive");
  });
  it("copies only Simplified Chinese and English locales without changing the runtime", () => {
    const root = fixture();
    execMock.mockImplementation((command, _args, options) => {
      if (command === "powershell.exe") fs.writeFileSync(options.env.MIMO_RELEASE_ZIP, "fake ZIP");
    });
    const release = packageWindows(root);
    expect(fs.readdirSync(path.join(release.appOutDir, "locales")).sort()).toEqual(["en-US.pak", "zh-CN.pak"]);
    expect(fs.readdirSync(path.join(root, "node_modules/electron/dist/locales")).sort()).toEqual(["en-US.pak", "fr.pak", "zh-CN.pak", "zh-TW.pak"]);
    const config = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    expect(config.build.electronLanguages).toEqual(["zh-CN", "en-US"]);
  });
  it("fails before building if a required locale is missing", () => {
    const root = fixture();
    fs.unlinkSync(path.join(root, "node_modules/electron/dist/locales/zh-CN.pak"));
    expect(() => packageWindows(root)).toThrow("zh-CN.pak");
    expect(execMock).not.toHaveBeenCalled();
  });
  it("rejects a linked output directory", () => {
    const root = fixture();
    const other = fs.mkdtempSync(path.join(os.tmpdir(), "mimo-release-test-"));
    fixtures.push(other);
    fs.renameSync(path.join(root, "desktop-build"), path.join(root, "preserved-build"));
    fs.symlinkSync(other, path.join(root, "desktop-build"), "junction");
    expect(() => createReleasePaths(root, "0.8.38")).toThrow("链接");
  });
});
