import { describe, expect, it } from "vitest";
import { pcm16ToWav } from "../server/utils/wav";
import { getArtifactDownloadFileName } from "../src/utils/audioNaming";

describe("Real WAV output and merged workspace names", () => {
  it("writes a consistent PCM WAV header and preserves every sample", () => {
    const pcm = Buffer.from([0, 0, 255, 127, 0, 128, 255, 255]);
    const wav = pcm16ToWav(pcm, 24000);
    expect(wav.toString("ascii", 0, 4)).toBe("RIFF");
    expect(wav.toString("ascii", 8, 12)).toBe("WAVE");
    expect(wav.readUInt32LE(4)).toBe(wav.length - 8);
    expect(wav.readUInt16LE(20)).toBe(1);
    expect(wav.readUInt16LE(22)).toBe(1);
    expect(wav.readUInt32LE(24)).toBe(24000);
    expect(wav.readUInt32LE(28)).toBe(48000);
    expect(wav.readUInt16LE(34)).toBe(16);
    expect(wav.readUInt32LE(40)).toBe(pcm.length);
    expect(wav.subarray(44)).toEqual(pcm);
  });

  it("rejects empty or incomplete PCM rather than saving a corrupt WAV", () => {
    expect(() => pcm16ToWav(Buffer.alloc(0), 24000)).toThrow();
    expect(() => pcm16ToWav(Buffer.from([1]), 24000)).toThrow();
  });

  it.each([
    ["VO_00085", "VO_00085_01", "VO_00085_01.wav"],
    ["VO_00085", "酒馆_VO_00085_01", "酒馆_VO_00085_01.wav"],
    ["酒馆_VO_00085", "VO_00085_01", "酒馆_VO_00085_01.wav"],
    ["河马NPC_酒馆", "酒馆_招募_01", "河马NPC_酒馆_招募_01.wav"],
    ["酒馆对白", "对白_01", "酒馆对白_01.wav"],
    ["VO_00085", "VO_000850_01", "VO_00085_VO_000850_01.wav"],
    ["河马NPC", "招募_01", "河马NPC_招募_01.wav"],
    ["河马NPC", "河马NPC", "河马NPC.wav"]
  ])("merges workspace %s and title %s into %s", (workspace, title, expected) => {
    expect(getArtifactDownloadFileName(title, "generated.wav", workspace)).toBe(expected);
  });
});
