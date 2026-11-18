// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { MiniMaxTools } from "../src/components/MiniMaxTools";
import { normalizeProviderOptions } from "../src/utils/providerConfig";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(() => vi.unstubAllGlobals());
it("uploads a clone, applies its Voice ID and saves a reusable favorite without registering it twice", async () => {
  const fetcher = vi.fn(async (url: string, _init?: RequestInit) => ({ ok: true, json: async () => url.includes("voice-clone") ? { voiceId: "CreatedVoice123", voiceType: "voice_cloning" } : [] }));
  vi.stubGlobal("fetch", fetcher);
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  const Harness = () => {
    const [options, setOptions] = useState(normalizeProviderOptions());
    return <><MiniMaxTools options={options} onChange={setOptions} headers={{ "X-API-Provider": "minimax", "X-API-Key": "fixture-ui-key" }} /><output>{options.synthesisMode}:{options.voiceId}</output></>;
  };
  try {
    await act(async () => root.render(<Harness />));
    const button = (label: string) => [...host.querySelectorAll<HTMLButtonElement>("button")].find(item => item.textContent === label)!;
    expect(button("使用此音色")).toBeUndefined();
    const input = host.querySelector<HTMLInputElement>('[aria-label="MiniMax 克隆参考音频"]')!;
    Object.defineProperty(input, "files", { configurable: true, value: [new File(["audio-fixture"], "voice.wav", { type: "audio/wav" })] });
    await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
    const name = host.querySelector<HTMLInputElement>('input[maxlength="120"]')!;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(name, "角色音色"); name.dispatchEvent(new Event("input", { bubbles: true })); });
    await act(async () => button("创建克隆音色").click());
    const cloneCall = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(cloneCall[0]).toBe("/api/minimax/tools/voice-clone");
    expect((cloneCall[1].body as FormData).get("audio")).toBeInstanceOf(File);
    // Fetch spy records the real multipart body and keeps secrets out of the saved role asset.
    expect(fetcher).toHaveBeenCalledTimes(1);
    await act(async () => button("使用此音色").click());
    expect(host.querySelector("output")?.textContent).toBe("voiceId:CreatedVoice123");
    await act(async () => button("收藏到角色音色库").click());
    expect(fetcher.mock.calls[1][0]).toBe("/api/voice-library");
    expect(JSON.parse(fetcher.mock.calls[1][1]!.body as string)).toMatchObject({ name: "角色音色", provider: "minimax", voiceId: "CreatedVoice123", favorite: true });
    expect(fetcher.mock.calls[1][1]!.body).not.toContain("fixture-ui-key");
    expect(host.textContent).toContain("已保存到角色音色库");
    expect(fetcher.mock.calls.filter(call => call[0].includes("voice-clone"))).toHaveLength(1);
  } finally { await act(async () => root.unmount()); host.remove(); }
});
