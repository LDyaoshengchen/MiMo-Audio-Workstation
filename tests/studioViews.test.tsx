// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StorageSettingsDialog } from "../src/components/studio/StorageSettingsDialog";
import { AppleConfirmDialog } from "../src/components/studio/AppleConfirmDialog";
import { ApiSettingsDialog } from "../src/components/studio/ApiSettingsDialog";
import { normalizeProviderOptions } from "../src/utils/providerConfig";
import type { SingleDownloadSettings } from "../src/utils/downloadSettings";

describe("extracted settings and confirmation views", () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

  it("storage download switches keep their appearance and naming behavior", async () => {
    function Harness() {
      const [settings, setSettings] = useState<SingleDownloadSettings>({ includeWorkspaceName: true, includeTime: false });
      return <StorageSettingsDialog showStoragePathModal handleBackdropMouseDown={vi.fn()} handleBackdropClick={vi.fn()}
        setShowStoragePathModal={vi.fn()} singleDownloadSettings={settings} setSingleDownloadSettings={setSettings}
        activeWorkspace={{ id: "board", type: "board", name: "怪物", createdAt: "", updatedAt: "", nodes: [], edges: [], stashItems: [] }}
        customPathInput="D:/mock" setCustomPathInput={vi.fn()} storagePathInfo={null}
        selectFolderAndSave={vi.fn()} saveCustomStoragePath={vi.fn()} resetStoragePath={vi.fn()}
        openLocalWorkspaceFolder={vi.fn()} openLocalAudiosFolder={vi.fn()} />;
    }
    await act(async () => root.render(<Harness />));
    const preview = () => host.querySelector(".download-naming-filename")?.textContent;
    const boardSwitch = host.querySelector('[aria-label="带画板名称"]') as HTMLButtonElement;
    const timeSwitch = host.querySelector('[aria-label="带时间"]') as HTMLButtonElement;
    expect(boardSwitch.classList.contains("capsule-switch")).toBe(true);
    expect(preview()).toBe("怪物_VO_00085_01.wav");
    await act(async () => boardSwitch.click());
    expect(preview()).toBe("VO_00085_01.wav");
    await act(async () => timeSwitch.click());
    expect(preview()).toBe("VO_00085_01_2026-10-08_17-00-02.wav");
    expect(timeSwitch.getAttribute("aria-checked")).toBe("true");
  });

  it("confirmation preserves cancel and accept and renders nothing after closing", async () => {
    const close = vi.fn();
    const state = { isOpen: true, title: "删除画板", message: "确认？", confirmLabel: "删除", cancelLabel: "取消", isDestructive: true, icon: "trash" as const, resolve: vi.fn() };
    const render = (open: boolean) => <AppleConfirmDialog appleConfirmState={open ? state : null}
      handleBackdropMouseDown={vi.fn()} handleBackdropClick={vi.fn()} handleAppleConfirmClose={close} />;
    await act(async () => root.render(render(true)));
    expect(host.querySelector('[role="alertdialog"]')).not.toBeNull();
    await act(async () => (host.querySelector(".apple-confirm-btn.cancel") as HTMLButtonElement).click());
    await act(async () => (host.querySelector(".apple-confirm-btn.confirm") as HTMLButtonElement).click());
    expect(close.mock.calls).toEqual([[false], [true]]);
    await act(async () => root.render(render(false)));
    expect(host.textContent).toBe("");
  });

  it("provider selection resets credentials and chooses the matching endpoint", async () => {
    const provider = vi.fn(), key = vi.fn(), options = vi.fn(), endpoint = vi.fn();
    await act(async () => root.render(<ApiSettingsDialog showApiKeyModal handleBackdropMouseDown={vi.fn()} handleBackdropClick={vi.fn()}
      closeApiKeyModal={vi.fn()} apiProviderInput="mimo" setApiProviderInput={provider} setApiKeyInput={key}
      setProviderOptionsInput={options} setApiEndpointInput={endpoint} providerOptionsInput={normalizeProviderOptions()}
      apiEndpointInput="" serverApiKeyConfigured apiKeyInput="" settingsError="" saveApiKey={vi.fn()} />));
    const openai = [...host.querySelectorAll("button")].find(button => button.textContent?.includes("OpenAI Audio"));
    expect(openai).toBeDefined();
    await act(async () => openai!.click());
    expect(provider).toHaveBeenCalledWith("openai");
    expect(key).toHaveBeenCalledWith("");
    expect(options).toHaveBeenCalledWith(expect.objectContaining({ synthesisMode: "preset" }));
    expect(endpoint).toHaveBeenCalledWith("https://api.openai.com/v1/audio/speech");
  });
});
