// @vitest-environment jsdom
import { webcrypto } from "node:crypto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import type { NodeProps } from "@xyflow/react";
import type { NodeData, StudioNode } from "../src/types/studio";
import { AudioMergeNode } from "../src/components/nodes/AudioMergeNode";
import { ArtifactReview } from "../src/components/ArtifactReview";
import { RoleVoiceLibrary } from "../src/components/studio/RoleVoiceLibrary";
import { favoriteAudioKey } from "../src/utils/voiceFavoriteStatus";

vi.mock("@xyflow/react", () => ({ Handle: () => null, Position: { Left: "left", Right: "right" } }));
vi.mock("../src/components/StudioAudioPlayer", () => ({ StudioAudioPlayer: ({ src }: { src: string }) => <audio src={src} /> }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });
const audio = { fileName: "merge.wav", mimeType: "audio/wav", size: 3, dataUrl: "data:audio/wav;base64,AQID" };

async function setup(initialFavorite = false, fail = false) {
  vi.stubGlobal("crypto", webcrypto);
  const key = await favoriteAudioKey(audio.dataUrl), cached = "/api/audio-cache/original.wav";
  let assets: any[] = initialFavorite ? [{ id: "existing", name: "以前保存的不同名称", favorite: true, audio }] : [];
  vi.stubGlobal("confirm", () => true);
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes('/favorite-status?')) {
      const sources = JSON.parse(new URL(url, "http://test").searchParams.get("sources")!);
      const favoriteKeys = await Promise.all(assets.filter(asset => asset.favorite).map(asset => favoriteAudioKey(asset.audio.dataUrl)));
      return { ok: true, json: async () => sources.map((source: string) => favoriteKeys.includes(source === cached ? key : source)) };
    }
    if (url.endsWith("storage-migration")) return { ok: true, json: async () => ({ running: false, phase: "idle" }) };
    if (url.endsWith("/location")) return { ok: true, json: async () => ({ directory: "test" }) };
    if (init?.method === "POST") {
      if (fail) return { ok: false, json: async () => ({ error: "未保存成功" }) };
      assets.push({ ...JSON.parse(String(init.body)), id: "new" });
    }
    if (init?.method === "PATCH") assets = assets.map(asset => ({ ...asset, favorite: JSON.parse(String(init.body)).favorite }));
    if (init?.method === "DELETE") assets = [];
    return { ok: true, json: async () => [...assets] };
  }));
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  const render = (src = cached) => act(async () => root.render(<><AudioMergeNode {...({ id: "merge", data: { title: "已改名的整合", audio } as NodeData } as NodeProps<StudioNode>)} /><ArtifactReview title="已改名的产物" src={src} onChange={vi.fn()} /><RoleVoiceLibrary /></>));
  await render();
  return { host, render, close: async () => { await act(async () => root.unmount()); host.remove(); } };
}
async function expectStars(host: HTMLElement, values: boolean[]) {
  await act(async () => { await vi.waitFor(() => {
    expect([...host.querySelectorAll('.favorite-icon-button')].map(button => button.getAttribute('aria-pressed'))).toEqual(values.map(String));
  }); });
  expect([...host.querySelectorAll('.favorite-icon-button svg')].map(icon => icon.getAttribute('fill'))).toEqual(values.map(value => value ? 'currentColor' : 'none'));
}

it("restores existing favorite states for merge and cached product audio, independent of their names", async () => {
  const view = await setup(true);
  try {
    await expectStars(view.host, [true, true]);
    await view.render("data:audio/wav;base64,BAUG");
    await expectStars(view.host, [true, false]);
  } finally { await view.close(); }
});

it("updates both matching stars after save, un-favorite, re-favorite and deletion", async () => {
  const view = await setup();
  try {
    await expectStars(view.host, [false, false]);
    await act(async () => view.host.querySelector<HTMLButtonElement>('.favorite-icon-button')!.click());
    await act(async () => document.querySelector<HTMLButtonElement>('.voice-library-save')!.click());
    await expectStars(view.host, [true, true]);
    expect(document.querySelector('.voice-favorite-dialog')).toBeNull();
    await act(async () => view.host.querySelector<HTMLButtonElement>('.role-library-button')!.click());
    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="取消收藏"]')!.click());
    await expectStars(view.host, [false, false]);
    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="收藏角色"]')!.click());
    await expectStars(view.host, [true, true]);
    await act(async () => document.querySelector<HTMLButtonElement>('[title="删除角色"]')!.click());
    await expectStars(view.host, [false, false]);
  } finally { await view.close(); }
});

it("does not fill stars after a failed save", async () => {
  const view = await setup(false, true);
  try {
    await act(async () => view.host.querySelector<HTMLButtonElement>('.favorite-icon-button')!.click());
    await act(async () => document.querySelector<HTMLButtonElement>('.voice-library-save')!.click());
    expect(document.querySelector('.voice-library-error')?.textContent).toBe('未保存成功');
    await expectStars(view.host, [false, false]);
  } finally { await view.close(); }
});
