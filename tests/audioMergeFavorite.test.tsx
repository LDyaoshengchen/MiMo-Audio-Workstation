// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import type { NodeProps } from "@xyflow/react";
import type { NodeData, StudioNode } from "../src/types/studio";
import { AudioMergeNode } from "../src/components/nodes/AudioMergeNode";

vi.mock("@xyflow/react", () => ({ Handle: () => null, Position: { Left: "left", Right: "right" } }));
vi.mock("../src/components/StudioAudioPlayer", () => ({ StudioAudioPlayer: ({ src }: { src: string }) => <audio src={src} /> }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

const audio = { fileName: "merged-reference-original.wav", mimeType: "audio/wav", size: 3, dataUrl: "data:audio/wav;base64,AQID" };
async function renderNode(data: NodeData, check: (host: HTMLDivElement, render: (next: NodeData) => Promise<void>) => Promise<void>) {
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  const render = (next: NodeData) => act(async () => root.render(<AudioMergeNode {...({ id: "merge", data: next } as NodeProps<StudioNode>)} />));
  try { await render(data); await check(host, render); }
  finally { await act(async () => root.unmount()); host.remove(); }
}
function libraryApi(fail = false) {
  const posts: any[] = [], assets: any[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith("storage-migration")) return { ok: true, json: async () => ({ running: false, phase: "idle" }) };
    if (url.endsWith("/location")) return { ok: true, json: async () => ({ directory: "test-library" }) };
    if (url.startsWith("/api/audio-cache/")) return { ok: true, blob: async () => new Blob([new Uint8Array([1, 2, 3])], { type: "audio/wav" }) };
    if (init?.method === "POST") {
      posts.push(JSON.parse(String(init.body)));
      if (fail) return { ok: false, json: async () => ({ error: "保存失败测试" }) };
      assets.push({ ...posts.at(-1), id: `asset-${assets.length + 1}` });
    }
    return { ok: true, json: async () => [...assets] };
  }));
  return { posts };
}

it("does not offer saving before an integrated result exists, and keeps the merge action intact", async () => {
  const onRunAudioMerge = vi.fn();
  await renderNode({ title: "整合", onRunAudioMerge }, async host => {
    expect(host.querySelector('[title="收藏到角色音色库"]')).toBeNull();
    await act(async () => host.querySelector<HTMLButtonElement>(".run-button")!.click());
    expect(onRunAudioMerge).toHaveBeenCalledWith("merge");
  });
});

it("opens a small naming dialog with the real merge result and closes only after saving a reusable favorite", async () => {
  const api = libraryApi(), onPatch = vi.fn();
  await renderNode({ title: " 整合音色 ", audio, onPatch, voiceId: "unrelated-id" }, async host => {
    await act(async () => host.querySelector<HTMLButtonElement>('[title="收藏到角色音色库"]')!.click());
    expect(document.querySelector('.voice-favorite-dialog')).not.toBeNull();
    expect(document.querySelector('.voice-library-editor-toggle')).toBeNull();
    expect(document.querySelector('.voice-library-list')).toBeNull();
    expect(document.querySelector('textarea')).toBeNull();
    expect(document.querySelector<HTMLInputElement>('[placeholder="输入角色名称"]')?.value).toBe("整合音色");
    expect(document.activeElement).toBe(document.querySelector('.voice-favorite-name'));
    expect(document.querySelector('.voice-favorite-preview')?.textContent).toContain(audio.fileName);
    expect(document.querySelector('.voice-favorite-preview audio')?.getAttribute('src')).toBe(audio.dataUrl);
    expect(vi.mocked(fetch).mock.calls.some(([url]) => url === '/api/voice-library' || String(url).endsWith('/location'))).toBe(false);
    await act(async () => document.querySelector<HTMLButtonElement>(".voice-library-save")!.click());
    expect(api.posts).toEqual([{ name: "整合音色", description: "", naturalControl: "", voiceId: "", provider: "mimo", audio, favorite: true }]);
    expect(document.querySelector('.voice-favorite-dialog')).toBeNull();
    expect(onPatch).not.toHaveBeenCalled();
  });
});

it("uses the file stem for an unnamed node and picks up a newly merged result when reopened", async () => {
  libraryApi();
  await renderNode({ title: "", audio }, async (host, render) => {
    await act(async () => host.querySelector<HTMLButtonElement>('.favorite-icon-button')!.click());
    expect(document.querySelector<HTMLInputElement>('[placeholder="输入角色名称"]')?.value).toBe("merged-reference-original");
    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="关闭角色音色库"]')!.click());
    const next = { ...audio, fileName: "new.wav", dataUrl: "data:audio/wav;base64,BAUG" };
    await render({ title: "新整合", audio: next });
    await act(async () => host.querySelector<HTMLButtonElement>('.favorite-icon-button')!.click());
    expect(document.querySelector<HTMLInputElement>('[placeholder="输入角色名称"]')?.value).toBe("新整合");
    expect(document.querySelector('.voice-favorite-preview audio')?.getAttribute('src')).toBe(next.dataUrl);
  });
});

it("embeds cached merge audio before saving so the favorite remains reusable", async () => {
  const api = libraryApi();
  await renderNode({ title: "缓存整合", audio: { ...audio, dataUrl: "/api/audio-cache/merged.wav" } }, async host => {
    await act(async () => host.querySelector<HTMLButtonElement>('.favorite-icon-button')!.click());
    await act(async () => document.querySelector<HTMLButtonElement>(".voice-library-save")!.click());
    await vi.waitFor(() => expect(api.posts).toHaveLength(1));
    expect(api.posts[0].audio).toEqual(audio);
    expect(api.posts[0].favorite).toBe(true);
  });
});

it("shows save errors without claiming the audio was added to the library", async () => {
  libraryApi(true);
  await renderNode({ title: "整合", audio }, async host => {
    await act(async () => host.querySelector<HTMLButtonElement>('.favorite-icon-button')!.click());
    await act(async () => document.querySelector<HTMLButtonElement>(".voice-library-save")!.click());
    expect(document.querySelector('.voice-library-error')?.textContent).toContain("保存失败测试");
    expect(document.querySelector('.voice-favorite-dialog')).not.toBeNull();
    expect(document.querySelector('.voice-library-list article')).toBeNull();
  });
});

it("validates and trims names, submits the naming form, and blocks duplicate saves while cached audio loads", async () => {
  const api = libraryApi(), fetchOriginal = fetch;
  let release!: (value: any) => void;
  const loading = new Promise(resolve => { release = resolve; });
  vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => url.startsWith('/api/audio-cache/') ? loading : fetchOriginal(url, init)));
  await renderNode({ title: '缓存整合', audio: { ...audio, dataUrl: '/api/audio-cache/merged.wav' } }, async host => {
    await act(async () => host.querySelector<HTMLButtonElement>('.favorite-icon-button')!.click());
    const input = document.querySelector<HTMLInputElement>('.voice-favorite-name')!;
    const setName = async (value: string) => act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const submit = () => document.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await setName('  '); await act(async () => { submit(); });
    expect(document.querySelector('[role="alert"]')?.textContent).toBe('请填写角色名称。');
    expect(api.posts).toHaveLength(0);
    await setName('  新角色名称  ');
    await act(async () => { submit(); submit(); });
    expect(document.querySelector<HTMLButtonElement>('.voice-library-save')!.disabled).toBe(true);
    expect(api.posts).toHaveLength(0);
    await act(async () => release({ ok: true, blob: async () => new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/wav' }) }));
    await vi.waitFor(() => expect(api.posts).toHaveLength(1));
    expect(api.posts[0].name).toBe('新角色名称');
    expect(document.querySelector('.voice-favorite-dialog')).toBeNull();
  });
});
