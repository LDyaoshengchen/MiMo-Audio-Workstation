// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import type { NodeData } from "../src/types/studio";
import { RoleVoiceLibrary } from "../src/components/studio/RoleVoiceLibrary";
import { OFFICIAL_MIMO_PRESET_VOICES } from "../src/studio/mimoPresetVoices";
import { resolveCloneInputs } from "../src/studio/graph";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it("lists official MiMo voices in a protected group and applies preset mode to compatible nodes", async () => {
  const response = (value: unknown) => ({ ok: true, json: async () => value }) as Response;
  const fetchMock = vi.fn(async (url: string) => {
    if (url.endsWith("storage-migration")) return response({ running: false, phase: "idle" });
    if (url.endsWith("/location")) return response({ directory: "test/role-voice-library" });
    if (url.endsWith("/groups")) return response([]);
    if (url === "/api/voice-library") return response([]);
    return response({});
  });
  vi.stubGlobal("fetch", fetchMock);
  const onPatch = vi.fn();
  const data = { title: "test", onPatch } as unknown as NodeData;
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  try {
    await act(async () => root.render(<RoleVoiceLibrary nodeId="voice-node" data={data} allowOfficialPresets />));
    await act(async () => { host.querySelector<HTMLButtonElement>(".role-library-button")!.click(); await Promise.resolve(); });
    const dialog = document.querySelector<HTMLElement>('[aria-label="角色音色资产库"]')!;
    await act(async () => { await vi.waitFor(() => expect(dialog.querySelector('[aria-label="展开分组 官方预制音色"]')).not.toBeNull()); });
    expect(dialog.classList.contains("voice-library-node-dialog")).toBe(true);
    expect(dialog.querySelector('.voice-library-editor-toggle[aria-expanded="false"]')).not.toBeNull();
    const officialGroup = dialog.querySelector<HTMLButtonElement>('[aria-label="展开分组 官方预制音色"]')!;
    expect(officialGroup).not.toBeNull();
    await act(async () => officialGroup.click());
    await act(async () => { await vi.waitFor(() => expect(dialog.querySelectorAll(".voice-library-list article.is-official-preset")).toHaveLength(OFFICIAL_MIMO_PRESET_VOICES.length)); });
    const chloe = [...dialog.querySelectorAll<HTMLElement>("article.is-official-preset")].find(card => card.textContent?.includes("Chloe"))!;
    expect(chloe.textContent).toContain("英文 · 女性");
    expect(chloe.querySelector(".voice-library-asset-kind")?.textContent).toBe("Voice ID 预置");
    expect(chloe.querySelector(".studio-player")).toBeNull();
    await act(async () => dialog.querySelector<HTMLButtonElement>('[aria-label="按语言筛选音色"]')!.click());
    await act(async () => [...document.querySelectorAll<HTMLElement>(".styled-select-option")].find(option => option.textContent === "英文")!.click());
    expect(dialog.querySelectorAll("article.is-official-preset")).toHaveLength(4);
    await act(async () => dialog.querySelector<HTMLButtonElement>('[aria-label="按性别筛选音色"]')!.click());
    await act(async () => [...document.querySelectorAll<HTMLElement>(".styled-select-option")].find(option => option.textContent === "女性")!.click());
    expect(dialog.querySelectorAll("article.is-official-preset")).toHaveLength(2);
    await act(async () => chloe.querySelector<HTMLButtonElement>('[aria-label="展开Chloe的音色描述"]')!.click());
    await act(async () => chloe.querySelector<HTMLButtonElement>(".voice-library-asset-details button")!.click());
    expect(onPatch).toHaveBeenCalledWith("voice-node", expect.objectContaining({ voiceId: "Chloe", assetProvider: "mimo", voiceAssetMode: "preset" }));
  } finally {
    await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals();
  }
});

it("fills a reference node with preset metadata and passes it to connected clone nodes", async () => {
  const response = (value: unknown) => ({ ok: true, json: async () => value }) as Response;
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.endsWith("storage-migration")) return response({ running: false, phase: "idle" });
    if (url.endsWith("/location")) return response({ directory: "test/role-voice-library" });
    if (url.endsWith("/groups")) return response([]);
    if (url === "/api/voice-library") return response([]);
    return response({});
  }));
  const onPatch = vi.fn();
  const data = { title: "参考音频", onPatch } as unknown as NodeData;
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  try {
    await act(async () => root.render(<RoleVoiceLibrary nodeId="reference-node" data={data} allowPresetReference />));
    await act(async () => { host.querySelector<HTMLButtonElement>(".role-library-button")!.click(); await Promise.resolve(); });
    const dialog = document.querySelector<HTMLElement>('[aria-label="角色音色资产库"]')!;
    const group = await vi.waitFor(() => dialog.querySelector<HTMLButtonElement>('[aria-label="展开分组 官方预制音色"]')!);
    await act(async () => group.click());
    const defaultVoice = [...dialog.querySelectorAll<HTMLElement>("article.is-official-preset")].find(card => card.textContent?.includes("MiMo-默认"))!;
    await act(async () => defaultVoice.click());
    expect(onPatch).toHaveBeenCalledWith("reference-node", expect.objectContaining({
      title: "MiMo-默认", voiceId: "mimo_default", assetProvider: "mimo", voiceAssetMode: "preset", audio: undefined, audioAssets: []
    }));

    const reference = { id: "reference-node", type: "referenceAudio", data: onPatch.mock.calls[0][1] } as any;
    const clone = { id: "clone-node", type: "voiceClone", data: { title: "clone", text: "hello" } } as any;
    const resolved = resolveCloneInputs(clone, [reference, clone], [{ source: reference.id, sourceHandle: "audio", target: clone.id, targetHandle: "voice" } as any]);
    expect(resolved).toMatchObject({ voiceId: "mimo_default", assetProvider: "mimo", voiceAssetMode: "preset" });
    expect(resolved.audio).toBeUndefined();
  } finally {
    await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals();
  }
});

it("applies a saved audio asset directly when its reference node library card is clicked", async () => {
  const audio = { fileName: "bunny.wav", mimeType: "audio/wav", size: 4, dataUrl: "data:audio/wav;base64,dGVzdA==" };
  const response = (value: unknown) => ({ ok: true, json: async () => value }) as Response;
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.endsWith("storage-migration")) return response({ running: false, phase: "idle" });
    if (url.endsWith("/location")) return response({ directory: "test/role-voice-library" });
    if (url.endsWith("/groups")) return response([]);
    if (url === "/api/voice-library") return response([{ id: "bunny", name: "兔女郎", description: "明亮", naturalControl: "", voiceId: "", provider: "mimo", audio }]);
    return response({});
  }));
  const onPatch = vi.fn();
  const data = { title: "参考音频", onPatch } as unknown as NodeData;
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  try {
    await act(async () => root.render(<RoleVoiceLibrary nodeId="reference-node" data={data} allowPresetReference />));
    await act(async () => { host.querySelector<HTMLButtonElement>(".role-library-button")!.click(); await Promise.resolve(); });
    const dialog = document.querySelector<HTMLElement>('[aria-label="角色音色资产库"]')!;
    await act(async () => dialog.querySelector<HTMLButtonElement>('[aria-label="展开分组 未分组"]')!.click());
    const bunny = [...dialog.querySelectorAll<HTMLElement>(".voice-library-list article")].find(card => card.textContent?.includes("兔女郎"))!;
    expect(bunny.querySelector(".voice-library-asset-kind")?.textContent).toBe("本地参考音频");
    expect(bunny.querySelector(".studio-player")).not.toBeNull();
    await act(async () => bunny.click());
    expect(onPatch).toHaveBeenCalledWith("reference-node", expect.objectContaining({ title: "兔女郎", audio, audioAssets: [audio], refAudioUrl: audio.dataUrl, refAudioName: audio.fileName }));
    expect(document.querySelector('[aria-label="角色音色资产库"]')).toBeNull();
  } finally {
    await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals();
  }
});

it("replaces stale reference audio when applying a Voice ID-only asset", async () => {
  const response = (value: unknown) => ({ ok: true, json: async () => value }) as Response;
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.endsWith("storage-migration")) return response({ running: false, phase: "idle" });
    if (url.endsWith("/location")) return response({ directory: "test/role-voice-library" });
    if (url.endsWith("/groups")) return response([]);
    if (url === "/api/voice-library") return response([{ id: "voice-id-only", name: "Dean", description: "", naturalControl: "", voiceId: "Dean", provider: "mimo" }]);
    return response({});
  }));
  const onPatch = vi.fn();
  const staleAudio = { fileName: "old.wav", mimeType: "audio/wav", size: 3, dataUrl: "data:audio/wav;base64,b2xk" };
  const data = { title: "旧名称", audio: staleAudio, audioAssets: [staleAudio], voiceId: "old-id", onPatch } as unknown as NodeData;
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  try {
    await act(async () => root.render(<RoleVoiceLibrary nodeId="reference-node" data={data} allowPresetReference />));
    await act(async () => { host.querySelector<HTMLButtonElement>(".role-library-button")!.click(); await Promise.resolve(); });
    const dialog = document.querySelector<HTMLElement>('[aria-label="角色音色资产库"]')!;
    await act(async () => dialog.querySelector<HTMLButtonElement>('[aria-label="展开分组 未分组"]')!.click());
    const dean = [...dialog.querySelectorAll<HTMLElement>(".voice-library-list article")].find(card => card.textContent?.includes("Dean"))!;
    await act(async () => dean.click());
    expect(onPatch).toHaveBeenCalledWith("reference-node", expect.objectContaining({
      title: "Dean", voiceId: "Dean", audio: undefined, audioAssets: [], refAudioUrl: undefined, refAudioName: undefined
    }));
  } finally {
    await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals();
  }
});
