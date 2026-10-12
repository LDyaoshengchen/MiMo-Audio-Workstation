// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { StudioMoreMenu } from "../src/components/studio/StudioMoreMenu";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(() => { vi.useRealTimers(); delete (window as any).electronApi; });

it("shows the actual desktop version, update badge, fixed links, and cleans subscriptions", async () => {
  vi.useFakeTimers();
  let menuEvent: (command: string) => void = () => {};
  const off = vi.fn(), native = vi.fn(), open = vi.fn();
  (window as any).electronApi = {
    getAppInfo: async () => ({ version: "1.2.3" }),
    checkForUpdates: vi.fn(async () => ({ status: "available", latestVersion: "1.2.4" })),
    onMenuEvent: (callback: typeof menuEvent) => { menuEvent = callback; return off; },
    editNative: native, openAppLink: open.mockResolvedValue(undefined), runMenuCommand: vi.fn().mockResolvedValue(undefined), showMoreMenu: vi.fn().mockResolvedValue(undefined),
  };
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  try {
    await act(async () => root.render(<StudioMoreMenu />));
    await act(async () => vi.advanceTimersByTimeAsync(2000));
    expect(host.querySelector(".studio-update-dot")).not.toBeNull();
    await act(async () => menuEvent("about"));
    expect(document.querySelector("[role=dialog]")?.textContent).toContain("v1.2.3");
    expect(document.querySelector("[role=status]")?.textContent).toContain("1.2.4");
    await act(async () => (document.querySelector(".studio-repository-link") as HTMLButtonElement).click());
    expect(open).toHaveBeenCalledWith("repository");
    await act(async () => (document.querySelector('[aria-label="关闭关于"]') as HTMLButtonElement).click());
    const input = document.createElement("input"); host.append(input); input.focus();
    native.mockResolvedValue(undefined); await act(async () => menuEvent("copy"));
    expect(native).toHaveBeenCalledWith("copy");
    input.blur(); const listener = vi.fn(); window.addEventListener("keydown", listener);
    await act(async () => menuEvent("paste")); window.removeEventListener("keydown", listener);
    expect(listener.mock.calls[0][0].key).toBe("v");
    await act(async () => (host.querySelector('.studio-more-button') as HTMLButtonElement).click());
    expect(document.querySelector('[role=menu][aria-label="更多"]')).not.toBeNull();
    const group = document.querySelector('[role=menuitem][aria-haspopup=menu]') as HTMLButtonElement;
    await act(async () => group.click());
    expect(document.querySelector('[role=menu][aria-label="编辑"]')?.textContent).toContain("Ctrl+Z");
    await act(async () => (document.querySelector('[role=menu][aria-label="编辑"] button') as HTMLButtonElement).click());
    expect(document.querySelector('.studio-compact-menu')).toBeNull();
    await act(async () => (host.querySelector('.studio-more-button') as HTMLButtonElement).click());
    await act(async () => Array.from(document.querySelectorAll<HTMLButtonElement>('.studio-compact-root button')).find(button => button.textContent === "关于")!.click());
    expect(document.querySelector('[role=dialog]')).not.toBeNull();
  } finally { await act(async () => root.unmount()); host.remove(); }
  expect(off).toHaveBeenCalled();
  const checks = (window as any).electronApi.checkForUpdates.mock.calls.length;
  await act(async () => vi.advanceTimersByTimeAsync(6 * 60 * 60 * 1000));
  expect((window as any).electronApi.checkForUpdates.mock.calls.length).toBe(checks);
});
