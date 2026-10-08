import { describe, it, expect } from "vitest";
import {
  parseWavDurationFromBytes,
  getAudioDurationFast,
  getCachedAudioDuration,
  setCachedAudioDuration
} from "../src/utils/audioDuration";

describe("audioDuration Utilities", () => {
  function createMockWavBuffer(sampleRate: number, channels: number, bitsPerSample: number, durationSeconds: number): Uint8Array {
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = channels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = Math.round(durationSeconds * byteRate);
    const totalSize = 44 + dataSize;
    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);

    // "RIFF"
    view.setUint8(0, 0x52); view.setUint8(1, 0x49); view.setUint8(2, 0x46); view.setUint8(3, 0x46);
    view.setUint32(4, 36 + dataSize, true);
    // "WAVE"
    view.setUint8(8, 0x57); view.setUint8(9, 0x41); view.setUint8(10, 0x56); view.setUint8(11, 0x45);
    // "fmt "
    view.setUint8(12, 0x66); view.setUint8(13, 0x6d); view.setUint8(14, 0x74); view.setUint8(15, 0x20);
    view.setUint32(16, 16, true); // Subchunk1Size
    view.setUint16(20, 1, true);  // AudioFormat (PCM)
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    // "data"
    view.setUint8(36, 0x64); view.setUint8(37, 0x61); view.setUint8(38, 0x74); view.setUint8(39, 0x61);
    view.setUint32(40, dataSize, true);

    return new Uint8Array(buffer);
  }

  it("should accurately parse duration from standard 44-byte WAV bytes", () => {
    // 24000Hz 16-bit mono for 4.5 seconds
    const wavBytes = createMockWavBuffer(24000, 1, 16, 4.5);
    const duration = parseWavDurationFromBytes(wavBytes);
    expect(duration).toBeCloseTo(4.5, 2);
  });

  it("should accurately parse duration for 15.2 seconds stereo WAV", () => {
    // 44100Hz 16-bit stereo for 15.2 seconds
    const wavBytes = createMockWavBuffer(44100, 2, 16, 15.2);
    const duration = parseWavDurationFromBytes(wavBytes);
    expect(duration).toBeCloseTo(15.2, 2);
  });

  it("should parse duration from Base64 Data URL synchronously via getAudioDurationFast", () => {
    const wavBytes = createMockWavBuffer(24000, 1, 16, 8.0);
    const base64 = Buffer.from(wavBytes).toString("base64");
    const dataUrl = `data:audio/wav;base64,${base64}`;

    const duration = getAudioDurationFast(dataUrl);
    expect(duration).toBeCloseTo(8.0, 2);
  });

  it("should parse WAV with extra chunks before data (e.g. JUNK chunk)", () => {
    const sampleRate = 16000;
    const channels = 1;
    const byteRate = sampleRate * 2;
    const dataSize = byteRate * 3; // 3 seconds
    const junkSize = 28;
    const totalSize = 44 + junkSize + 8 + dataSize;
    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);

    // RIFF header
    view.setUint8(0, 0x52); view.setUint8(1, 0x49); view.setUint8(2, 0x46); view.setUint8(3, 0x46);
    view.setUint32(4, totalSize - 8, true);
    view.setUint8(8, 0x57); view.setUint8(9, 0x41); view.setUint8(10, 0x56); view.setUint8(11, 0x45);

    // fmt chunk
    view.setUint8(12, 0x66); view.setUint8(13, 0x6d); view.setUint8(14, 0x74); view.setUint8(15, 0x20);
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);

    // JUNK chunk
    let offset = 36;
    view.setUint8(offset, 0x4a); view.setUint8(offset + 1, 0x55); view.setUint8(offset + 2, 0x4e); view.setUint8(offset + 3, 0x4b);
    view.setUint32(offset + 4, junkSize, true);
    offset += 8 + junkSize;

    // data chunk
    view.setUint8(offset, 0x64); view.setUint8(offset + 1, 0x61); view.setUint8(offset + 2, 0x74); view.setUint8(offset + 3, 0x61);
    view.setUint32(offset + 4, dataSize, true);

    const wavBytes = new Uint8Array(buffer);
    const duration = parseWavDurationFromBytes(wavBytes);
    expect(duration).toBeCloseTo(3.0, 2);
  });

  it("should handle cache get/set correctly", () => {
    const testUrl = "http://example.com/test-audio.mp3";
    expect(getCachedAudioDuration(testUrl)).toBeUndefined();
    setCachedAudioDuration(testUrl, 12.34);
    expect(getCachedAudioDuration(testUrl)).toBeCloseTo(12.34, 2);
  });

  it("should return null for invalid or corrupted audio headers gracefully", () => {
    expect(parseWavDurationFromBytes(new Uint8Array(10))).toBeNull();
    expect(parseWavDurationFromBytes(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25]))).toBeNull();
    expect(getAudioDurationFast("not-a-data-url")).toBeNull();
    expect(getAudioDurationFast("data:text/plain;base64,SGVsbG8=")).toBeNull();
  });
});
