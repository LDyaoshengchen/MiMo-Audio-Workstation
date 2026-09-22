import { describe, it, expect } from "vitest";
import {
  getVocalPhoneticHint,
  buildOptimizedGameVocalPrompt,
  smartTrimGameVocalAudioBuffer,
  VOCAL_PHONETIC_ANCHOR_MAP
} from "../src/utils/gameVocalOptimizer";

describe("Game Vocal Optimizer (拟声发音与防拖音引擎)", () => {
  it("should have rich phonetic anchor mappings for core game vocalizations", () => {
    expect(VOCAL_PHONETIC_ANCHOR_MAP["ack!"]).toBeDefined();
    expect(VOCAL_PHONETIC_ANCHOR_MAP["ugh!"]).toBeDefined();
    expect(VOCAL_PHONETIC_ANCHOR_MAP["ow!"]).toBeDefined();
    expect(VOCAL_PHONETIC_ANCHOR_MAP["ngh!"]).toBeDefined();
    expect(VOCAL_PHONETIC_ANCHOR_MAP["hah!"]).toBeDefined();
    expect(VOCAL_PHONETIC_ANCHOR_MAP["yoop!"]).toBeDefined();

    // Check case insensitivity in getVocalPhoneticHint
    expect(getVocalPhoneticHint("ACK!")).toContain("咳");
    expect(getVocalPhoneticHint("Ugh!")).toContain("呃");
    expect(getVocalPhoneticHint("NGH!")).toContain("嗯");
    expect(getVocalPhoneticHint("UnknownWord!")).toContain("极短促瞬态爆发音");
  });

  it("should inject anti-drone and duration constraints in buildOptimizedGameVocalPrompt", () => {
    // Ultra short mode
    const promptShort = buildOptimizedGameVocalPrompt({
      baseInstruction: "受到沉重打击时的本能痛苦闷哼",
      vocalText: "Ugh!",
      durationMode: "ultra_short",
      antiDrone: true,
      phoneticAnchor: true
    });

    expect(promptShort).toContain("受到沉重打击时的本能痛苦闷哼");
    expect(promptShort).toContain("拟声词「Ugh!」发音为");
    expect(promptShort).toContain("声学时长极速刹车约束");
    expect(promptShort).toContain("绝对严禁拖长音");

    // Standard mode
    const promptStd = buildOptimizedGameVocalPrompt({
      baseInstruction: "短促有力攻击发声",
      vocalText: "Hah!",
      durationMode: "standard",
      antiDrone: true,
      phoneticAnchor: true
    });

    expect(promptStd).toContain("发音干脆短促");
    expect(promptStd).toContain("发声结束后立即紧闭声带完全静音");
    expect(promptStd).toContain("严禁持续长鸣或无意义拖长音");

    // Switches off
    const promptBare = buildOptimizedGameVocalPrompt({
      baseInstruction: "自定义发声",
      vocalText: "Hey!",
      durationMode: "standard",
      antiDrone: false,
      phoneticAnchor: false
    });

    expect(promptBare).toBe("自定义发声");
  });

  it("should correctly trim audio buffer that exceeds duration limit with smooth fade-out", () => {
    // Mock a minimal BaseAudioContext & AudioBuffer for Node/Vitest
    const sampleRate = 24000;
    const durationSeconds = 3.0;
    const totalFrames = Math.floor(sampleRate * durationSeconds);

    const mockChannel = new Float32Array(totalFrames);
    mockChannel.fill(0.5);

    const mockBuffer: any = {
      sampleRate,
      numberOfChannels: 1,
      length: totalFrames,
      duration: durationSeconds,
      getChannelData: () => mockChannel
    };

    const mockContext: any = {
      createBuffer: (channels: number, length: number, rate: number) => {
        const data = new Float32Array(length);
        return {
          sampleRate: rate,
          numberOfChannels: channels,
          length,
          duration: length / rate,
          getChannelData: () => data
        };
      }
    };

    // Trim in ultra_short mode (max 0.75s)
    const trimmed = smartTrimGameVocalAudioBuffer(mockBuffer, mockContext, "ultra_short");
    expect(trimmed.length).toBeLessThan(mockBuffer.length);
    expect(trimmed.duration).toBeCloseTo(0.75, 2);

    // If buffer is already short (e.g. 0.4s), it should not be trimmed
    const shortFrames = Math.floor(sampleRate * 0.4);
    const shortBuffer: any = {
      sampleRate,
      numberOfChannels: 1,
      length: shortFrames,
      duration: 0.4,
      getChannelData: () => new Float32Array(shortFrames)
    };
    const untouched = smartTrimGameVocalAudioBuffer(shortBuffer, mockContext, "ultra_short");
    expect(untouched).toBe(shortBuffer);
  });
});
