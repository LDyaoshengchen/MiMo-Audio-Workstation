// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { ArtifactReview } from "../src/components/ArtifactReview";
import { appendSynthesisInputs, getAssetVoiceId, normalizeProviderOptions } from "../src/utils/providerConfig";

it("asset Voice ID overrides only this request and rejects another provider", async () => {
  const options = normalizeProviderOptions({ synthesisMode: "reference" }); const form = new FormData();
  await appendSynthesisInputs(form, options, undefined, "saved-voice");
  expect(form.get("voiceId")).toBe("saved-voice"); expect(options.synthesisMode).toBe("reference");
  expect(() => getAssetVoiceId({ voiceId: "saved", assetProvider: "fishaudio" }, { "X-API-Provider": "mimo" })).toThrow(/fishaudio/);
});

it("product favorite saves a reusable role asset without selection or A/B controls", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {}); vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  const fetchMock = vi.fn(async (url: string, options?: RequestInit) => ({ ok: true, json: async () => url.endsWith('/location') ? { directory: 'test/role-voice-library' } : options?.method === 'POST' ? [{ id: 'saved', ...JSON.parse(options.body as string) }] : [] }));
  vi.stubGlobal('fetch', fetchMock);
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  try {
    await act(async () => root.render(<ArtifactReview title="深海狂鲨" src="data:audio/wav;base64,AAAA" onChange={vi.fn()} />));
    expect(host.textContent).not.toMatch(/设为 A|设为 B|选中导出|评分/);
    expect(host.textContent).toBe("");
    expect(host.querySelector('button')?.getAttribute('aria-label')).toBe('收藏到角色音色库');
    await act(async () => host.querySelector<HTMLButtonElement>('button')!.click());
    const dialog = document.querySelector<HTMLElement>('[aria-label="角色音色资产库"]')!;
    expect(dialog.querySelector<HTMLInputElement>('.voice-library-form input')!.value).toBe('深海狂鲨');
    await act(async () => Array.from(dialog.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === '收藏并保存到角色库')!.click());
    const body = JSON.parse(fetchMock.mock.calls.find(call => call[1]?.method === 'POST')![1]!.body as string);
    expect(body.favorite).toBe(true); expect(body.audio.dataUrl).toBe('data:audio/wav;base64,AAAA');
    expect(dialog.querySelector('[aria-label="取消收藏"][aria-pressed="true"]')).not.toBeNull();
  } finally { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); }
});
