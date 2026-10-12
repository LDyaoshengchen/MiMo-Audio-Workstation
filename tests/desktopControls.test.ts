import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";

function fixture(response: any = { tag_name: "v0.8.39" }) {
  const handlers: Record<string, any> = {};
  const contents: any = { getURL: () => "http://127.0.0.1:38210/", mainFrame: {}, send: vi.fn(), on: vi.fn(), copy: vi.fn(), reload: vi.fn() };
  const window = { webContents: contents, minimize: vi.fn() };
  const popup = vi.fn();
  const build = vi.fn(() => ({ popup }));
  const external = vi.fn();
  const openPath = vi.fn(async () => "");
  const fetch = vi.fn(async () => ({ ok: true, json: async () => response }));
  const module = { exports: {} as any };
  vm.runInNewContext(fs.readFileSync("electron/desktop-controls.cjs", "utf8"), {
    require: (name: string) => name === "node:path" ? path : name === "node:fs/promises" ? fs.promises : ({ BrowserWindow: { fromWebContents: () => window }, ipcMain: { handle: (key: string, handler: any) => { handlers[key] = handler; } }, Menu: { buildFromTemplate: build }, shell: { openExternal: external, openPath } }),
    module, URL, fetch, AbortSignal,
  });
  module.exports.setupDesktopControls("0.8.38");
  const event = { sender: contents, senderFrame: contents.mainFrame };
  return { handlers, contents, window, build, external, openPath, fetch, event, exports: module.exports };
}
describe("desktop controls", () => {
  it("opens storage folders through the native shell after resolving the active directory", async () => {
    const f = fixture({ path: path.resolve("package.json") });
    await f.handlers["desktop-open-storage"](f.event, "workspace", "board-1");
    expect(f.openPath).toHaveBeenCalledWith(path.resolve("."));
    expect(String(f.fetch.mock.calls[0][0])).toBe("http://127.0.0.1:38210/api/workspaces/open-folder");
    expect(JSON.parse((f.fetch.mock.calls as any)[0][1].body)).toEqual({ resolveOnly:true, workspaceId:"board-1" });
    const audio = fixture({ path:path.resolve(".") });
    await audio.handlers["desktop-open-storage"](audio.event, "audios");
    expect(audio.openPath).toHaveBeenCalledWith(path.resolve("."));
  });
  it("rejects unsafe storage requests and reports native shell failures", async () => {
    const f = fixture({ path:path.resolve(".") });
    for (const [kind,id] of [["other",undefined],["workspace","../escape"]]) await expect(f.handlers["desktop-open-storage"](f.event, kind, id)).rejects.toThrow();
    await expect(f.handlers["desktop-open-storage"]({ ...f.event, senderFrame:{} }, "audios")).rejects.toThrow();
    expect(f.openPath).not.toHaveBeenCalled();
    f.openPath.mockResolvedValueOnce("Access denied");
    await expect(f.handlers["desktop-open-storage"](f.event, "audios")).rejects.toThrow("Access denied");
    const relative = fixture({ path:"relative-folder" });
    await expect(relative.handlers["desktop-open-storage"](relative.event, "audios")).rejects.toThrow();
    expect(relative.openPath).not.toHaveBeenCalled();
  });
  it("compares stable versions numerically, not lexically", () => {
    const { exports: { newerVersion } } = fixture();
    expect(newerVersion("v0.8.100", "0.8.38")).toBe(true);
    for (const value of ["v0.8.38", "v0.8.9", "v0.8.39-beta", "garbage"]) expect(newerVersion(value, "0.8.38")).toBe(false);
  });
  it("checks updates without credentials and recognizes newer stable releases", async () => {
    const f = fixture();
    expect(await f.handlers["desktop-check-update"](f.event)).toMatchObject({ status: "available", latestVersion: "0.8.39" });
    expect(f.fetch.mock.calls[0][0]).toContain("/releases/latest");
    expect(JSON.stringify(f.fetch.mock.calls)).not.toContain("Authorization");
    const equal = fixture({ tag_name: "v0.8.38" });
    expect(await equal.handlers["desktop-check-update"](equal.event)).toMatchObject({ status: "latest" });
  });
  it("reports failures rather than claiming the installed version is latest", async () => {
    const f = fixture();
    f.fetch.mockRejectedValueOnce(new Error("offline"));
    expect(await f.handlers["desktop-check-update"](f.event)).toMatchObject({ status: "error" });
    const draft = fixture({ tag_name: "v0.8.39", draft: true });
    expect(await draft.handlers["desktop-check-update"](draft.event)).toMatchObject({ status: "error" });
  });
  it("rejects untrusted IPC sources and arbitrary external destinations", () => {
    const f = fixture();
    expect(() => f.handlers["desktop-info"]({ ...f.event, senderFrame: {} })).toThrow();
    f.contents.getURL = () => "https://untrusted.example";
    expect(() => f.handlers["desktop-info"](f.event)).toThrow();
    f.contents.getURL = () => "http://127.0.0.1:38210/";
    expect(() => f.handlers["desktop-open-link"](f.event, "file:///secret")).toThrow();
    f.handlers["desktop-open-link"](f.event, "repository");
    expect(f.external).toHaveBeenCalledWith("https://github.com/LDyaoshengchen/MiMo-Audio-Workstation");
  });
  it("groups menu actions and routes editing to the focused renderer", () => {
    const f = fixture(); f.handlers["desktop-more"](f.event);
    const menu = f.build.mock.calls[0][0];
    expect(menu.filter((item: any) => item.label).map((item: any) => item.label)).toEqual(["编辑", "视图", "窗口", "关于"]);
    menu[0].submenu[0].click();
    expect(f.contents.send).toHaveBeenCalledWith("desktop-menu-event", "undo");
    f.exports.attachWindowShortcuts(f.window);
    const keyHandler = f.contents.on.mock.calls[0][1];
    const preventDefault = vi.fn(); keyHandler({ preventDefault }, { type: "keyDown", key: "r", control: true });
    expect(f.contents.reload).toHaveBeenCalled(); expect(preventDefault).toHaveBeenCalled();
    preventDefault.mockClear(); keyHandler({ preventDefault }, { type: "keyDown", key: "c", control: true });
    expect(preventDefault).not.toHaveBeenCalled();
  });
  it("allows only known compact-menu window commands", () => {
    const f = fixture();
    f.handlers["desktop-menu-command"](f.event, "reload");
    expect(f.contents.reload).toHaveBeenCalledOnce();
    expect(() => f.handlers["desktop-menu-command"](f.event, "executeJavaScript")).toThrow();
    expect(() => f.handlers["desktop-menu-command"]({ ...f.event, senderFrame: {} }, "reload")).toThrow();
  });
});
