import { afterEach, describe, expect, it, vi } from "vitest";
import { createZipInstance, getUniqueFileName } from "../src/utils/zipUtils";
import { fetchAudioBytes } from "../src/utils/audioExport";
import { pcm16ToWav } from "../server/utils/wav";
import { assertAudioFormat } from "../shared/audioValidation";
import { buildAudioZip } from "../src/utils/buildAudioZip";

describe("audio export safety", () => {
  afterEach(() => vi.unstubAllGlobals());
  const wav = pcm16ToWav(Buffer.from([0, 0, 1, 0]), 24000);
  it("keeps all same-name ZIP entries, even natural suffix collisions and case-only duplicates", async () => {
    const zip = await createZipInstance();
    const folder = zip.folder("voices")!;
    folder.file("npc.wav", wav); folder.file("npc-2.wav", wav); folder.file("NPC.wav", wav);
    const files = Object.values(zip.files).filter(file => !file.dir);
    expect(files.map(file => file.name)).toEqual(["voices/npc.wav", "voices/npc-2.wav", "voices/NPC-3.wav"]);
    const generated = await zip.generateAsync({ type: "uint8array" });
    expect(generated.length).toBeGreaterThan(wav.length * 3);
  });
  it("reserves generated filenames too", () => {
    const names = new Map<string, number>();
    expect(["a.wav", "a.wav", "a-2.wav", "A.wav"].map(name => getUniqueFileName(name, names)))
      .toEqual(["a.wav", "a-2.wav", "a-2-2.wav", "A-3.wav"]);
  });
  it("rejects HTTP errors, error pages, empty output and mismatched audio", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("not found", { status: 404 }))
      .mockResolvedValueOnce(new Response("<html>error</html>", { headers: { "content-type": "text/html" } }))
      .mockResolvedValueOnce(new Response(new Uint8Array())));
    await expect(fetchAudioBytes("/missing.wav")).rejects.toThrow("404");
    await expect(fetchAudioBytes("/error.wav")).rejects.toThrow("错误页面");
    await expect(fetchAudioBytes("/empty.wav")).rejects.toThrow("不是有效");
    expect(() => assertAudioFormat(wav, "mp3")).toThrow("不匹配");
  });
  it("accepts real WAV and rejects fake/truncated headers", async () => {
    expect(assertAudioFormat(wav, "wav")).toBe("wav");
    expect(() => assertAudioFormat(Buffer.from("RIFF....WAVE"), "wav")).toThrow();
    expect(() => assertAudioFormat(wav.subarray(0, 44), "wav")).toThrow();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(wav, { headers: { "content-type": "audio/wav" } })));
    expect(await fetchAudioBytes("/valid.wav")).toEqual(new Uint8Array(wav));
  });
  it("tracks progress and enforces cancel and memory limits before emitting an archive", async () => {
    const progress: number[] = [];
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response(wav)));
    const items = [{ name: "a.wav", source: "/a.wav" }, { name: "a.wav", source: "/b.wav" }];
    expect((await buildAudioZip(items, { onProgress: percent => progress.push(percent) })).size).toBeGreaterThan(wav.length * 2);
    expect(progress.at(-1)).toBe(100);
    await expect(buildAudioZip(items, { maxBytes: 1 })).rejects.toThrow("安全上限");
    const controller = new AbortController(); controller.abort();
    await expect(buildAudioZip(items, { signal: controller.signal })).rejects.toThrow();
    await expect(buildAudioZip([{ name: "missing.wav", source: "" }])).rejects.toThrow("missing.wav");
  });
});
