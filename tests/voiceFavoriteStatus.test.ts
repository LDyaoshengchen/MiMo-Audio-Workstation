import { afterEach, expect, it, vi } from "vitest";
import { favoriteAudioKey, VoiceFavoriteStatusStore } from "../src/utils/voiceFavoriteStatus";

const subscriptions: (() => void)[] = [];
afterEach(() => { subscriptions.splice(0).forEach(stop => stop()); vi.unstubAllGlobals(); });
const queried = (url: string) => JSON.parse(new URL(url, "http://localhost").searchParams.get("sources")!) as string[];

it("hashes identical audio independently of MIME spelling, and ignores unsupported sources", async () => {
  expect(await favoriteAudioKey("data:audio/wav;base64,AQID")).toBe(await favoriteAudioKey("data:audio/x-wav;base64,AQID"));
  expect(await favoriteAudioKey("data:audio/wav;base64,AQID")).not.toBe(await favoriteAudioKey("data:audio/wav;base64,BAUG"));
  expect(await favoriteAudioKey("https://example.com/private.wav")).toBeUndefined();
  expect(await favoriteAudioKey("not-an-audio-source")).toBeUndefined();
});

it("batches many stars and deduplicates subscribers instead of downloading audio/library payloads", async () => {
  const calls: string[][] = [], store = new VoiceFavoriteStatusStore();
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    const keys = queried(url); calls.push(keys); return { ok: true, json: async () => keys.map(key => key.endsWith("/0.wav")) };
  }));
  for (let index = 0; index < 100; index++) subscriptions.push(store.subscribe(`/api/audio-cache/${index}.wav`, vi.fn()));
  subscriptions.push(store.subscribe("/api/audio-cache/0.wav", vi.fn()));
  await vi.waitFor(() => expect(calls.flat()).toHaveLength(100));
  expect(calls).toHaveLength(4); expect(store.get("/api/audio-cache/0.wav")).toBe(true);
  expect(store.get("/api/audio-cache/1.wav")).toBe(false);
  expect(calls.flat().some(source => source.startsWith("data:"))).toBe(false);
});

it("ignores an older in-flight result after the library changes", async () => {
  const store = new VoiceFavoriteStatusStore(), source = "/api/audio-cache/a.wav";
  const responses: ((value: unknown) => void)[] = [];
  vi.stubGlobal("fetch", vi.fn(() => new Promise(resolve => responses.push(resolve))));
  subscriptions.push(store.subscribe(source, vi.fn()));
  await vi.waitFor(() => expect(responses).toHaveLength(1)); store.refresh();
  await vi.waitFor(() => expect(responses).toHaveLength(2));
  responses[1]({ ok: true, json: async () => [true] });
  await vi.waitFor(() => expect(store.get(source)).toBe(true));
  responses[0]({ ok: true, json: async () => [false] });
  await new Promise(resolve => setTimeout(resolve, 30)); expect(store.get(source)).toBe(true);
});

it("keeps the last known state on errors and retries on refresh", async () => {
  const store = new VoiceFavoriteStatusStore(), source = "/api/audio-cache/a.wav";
  let mode = "favorite";
  const fetch = vi.fn(async () => { if (mode === "error") throw new Error("offline"); return { ok: true, json: async () => [mode === "favorite"] }; });
  vi.stubGlobal("fetch", fetch); subscriptions.push(store.subscribe(source, vi.fn()));
  await vi.waitFor(() => expect(store.get(source)).toBe(true));
  mode = "error"; store.refresh(); await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  expect(store.get(source)).toBe(true);
  mode = "empty"; store.refresh(); await vi.waitFor(() => expect(store.get(source)).toBe(false));
});
