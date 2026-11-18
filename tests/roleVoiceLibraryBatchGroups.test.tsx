// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { RoleVoiceLibrary } from "../src/components/studio/RoleVoiceLibrary";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it("keeps favorite and delete on the title row, playback below, and moves selected assets together", async () => {
  let assets: any[] = [
    { id: "bunny", name: "兔女郎", description: "明亮", naturalControl: "", voiceId: "", provider: "mimo", favorite: false },
    { id: "ox", name: "牛头", description: "低沉", naturalControl: "", voiceId: "", provider: "mimo", favorite: true },
    { id: "wolf", name: "狼人", description: "沙哑", naturalControl: "", voiceId: "", provider: "mimo", favorite: false }
  ];
  let failBulkMove = true;
  const groups = [{ id: "bunny-group", name: "角色" }];
  const response = (value: unknown, ok = true) => ({ ok, json: async () => value }) as Response;
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith("storage-migration")) return response({ running: false, phase: "idle" });
    if (url.endsWith("/location")) return response({ directory: "test/role-voice-library" });
    if (url.endsWith("/groups")) return response(groups);
    if (url.endsWith("/bulk-group")) {
      if (failBulkMove) { failBulkMove = false; return response({ error: "临时移动失败" }, false); }
      const body = JSON.parse(String(init?.body));
      assets = assets.map(asset => body.assetIds.includes(asset.id) ? { ...asset, groupId: body.groupId || undefined } : asset);
      return response(assets);
    }
    if (url === "/api/voice-library") return response(assets);
    return response({});
  });
  vi.stubGlobal("fetch", fetchMock);
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  try {
    await act(async () => root.render(<RoleVoiceLibrary />));
    await act(async () => { host.querySelector<HTMLButtonElement>(".role-library-button")!.click(); await Promise.resolve(); });
    const dialog = document.querySelector<HTMLElement>('[aria-label="角色音色资产库"]')!;
    await act(async () => { await vi.waitFor(() => expect(dialog.querySelector('[aria-label="展开分组 未分组"]')).not.toBeNull()); });
    expect(dialog.querySelector('[aria-label="展开分组 未分组"]')?.getAttribute("aria-expanded")).toBe("false");
    expect(dialog.querySelector('[aria-label="展开分组 官方预制音色"]')?.getAttribute("aria-expanded")).toBe("false");
    await act(async () => dialog.querySelector<HTMLButtonElement>('[aria-label="展开分组 未分组"]')!.click());
    await act(async () => dialog.querySelector<HTMLButtonElement>('[aria-label="展开分组 官方预制音色"]')!.click());
    await act(async () => { await vi.waitFor(() => expect(dialog.querySelectorAll(".voice-library-list article")).toHaveLength(12)); });

    const ungroupedToggle = dialog.querySelector<HTMLButtonElement>('[aria-label="折叠分组 未分组"]')!;
    expect(ungroupedToggle.getAttribute("aria-expanded")).toBe("true");
    const cardsId = ungroupedToggle.getAttribute("aria-controls")!;
    await act(async () => ungroupedToggle.click());
    expect(dialog.querySelector(`[id="${cardsId}"]`)).toBeNull();
    expect(dialog.querySelector('[aria-label="展开分组 未分组"]')?.getAttribute("aria-expanded")).toBe("false");
    await act(async () => dialog.querySelector<HTMLButtonElement>('[aria-label="展开分组 未分组"]')!.click());
    expect(dialog.querySelectorAll(".voice-library-list article")).toHaveLength(12);

    const bunny = [...dialog.querySelectorAll<HTMLElement>(".voice-library-list article")].find(card => card.textContent?.includes("兔女郎"))!;
    const heading = bunny.querySelector<HTMLElement>(".voice-library-asset-heading")!;
    expect(heading.querySelector('[aria-label="收藏角色"]')).not.toBeNull();
    expect(heading.querySelector('[aria-label^="删除角色资产"]')).not.toBeNull();
    expect(heading.nextElementSibling?.classList.contains("voice-library-asset-preview")).toBe(true);

    const cards = [...dialog.querySelectorAll<HTMLElement>(".voice-library-list article")];
    const checkboxes = dialog.querySelectorAll<HTMLInputElement>(".voice-library-asset-select");
    await act(async () => checkboxes[0].click());
    expect(cards[0].classList.contains("is-selected")).toBe(true);
    await act(async () => checkboxes[0].click());
    expect(cards[0].classList.contains("is-selected")).toBe(false);
    await act(async () => cards[0].click());
    expect(cards[0].classList.contains("is-selected")).toBe(true);
    await act(async () => { cards[2].dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true })); });
    expect(dialog.querySelectorAll(".voice-library-list article.is-selected")).toHaveLength(3);
    expect([...checkboxes].slice(0, 3).every(checkbox => checkbox.checked)).toBe(true);
    expect([...checkboxes].slice(3).every(checkbox => checkbox.disabled && !checkbox.checked)).toBe(true);
    await act(async () => { cards[1].dispatchEvent(new MouseEvent("click", { bubbles: true, ctrlKey: true })); });
    expect(dialog.querySelectorAll(".voice-library-list article.is-selected")).toHaveLength(2);
    expect(checkboxes[1].checked).toBe(false);
    expect(dialog.querySelector(".voice-library-selection-tools")).toBeNull();
    const target = dialog.querySelector<HTMLButtonElement>('[aria-label="设置兔女郎的分组"]')!;
    await act(async () => target.click());
    const groupOption = [...document.querySelectorAll<HTMLElement>('.styled-select-menu [role="option"]')].find(option => option.textContent?.includes("角色"))!;
    await act(async () => { groupOption.click(); await new Promise(resolve => setTimeout(resolve, 0)); });
    expect(dialog.querySelectorAll(".voice-library-list article.is-selected")).toHaveLength(2);
    expect(dialog.querySelector('[role="alert"]')?.textContent).toContain("临时移动失败");
    await act(async () => dialog.querySelector<HTMLButtonElement>('[aria-label="设置兔女郎的分组"]')!.click());
    const retryOption = [...document.querySelectorAll<HTMLElement>('.styled-select-menu [role="option"]')].find(option => option.textContent?.includes("角色"))!;
    await act(async () => { retryOption.click(); await vi.waitFor(() => expect(assets[0].groupId).toBe("bunny-group")); });

    const moveCall = fetchMock.mock.calls.find(([url]) => url.endsWith("/bulk-group"));
    expect(JSON.parse(String(moveCall?.[1]?.body))).toEqual({ assetIds: ["bunny", "wolf"], groupId: "bunny-group" });
    expect([assets[0], assets[2]].every(asset => asset.groupId === "bunny-group")).toBe(true);
    expect(dialog.querySelector('[role="status"]')?.textContent).toContain("已将 2 个音色移至");
    expect(dialog.querySelector(".voice-library-selection-tools")).toBeNull();
  } finally {
    await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals();
  }
});
