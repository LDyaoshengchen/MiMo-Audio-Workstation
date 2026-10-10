import { afterEach, describe, expect, it, vi } from "vitest";
import { formatOptimizationError } from "../src/studio/optimizationErrors";
import { createSynthesisActions, type SynthesisActionsContext } from "../src/studio/synthesisActions";

afterEach(() => vi.unstubAllGlobals());

describe("AI optimization balance errors", () => {
  it("explains the exact balance failure without treating every 402 as insufficient balance", () => {
    expect(formatOptimizationError("MiMo 文本润色失败 (HTTP 402): Insufficient account balance")).toContain("MiMo API 账户余额不足");
    expect(formatOptimizationError("HTTP 402: payment verification required")).toBe("HTTP 402: payment verification required");
    expect(formatOptimizationError("HTTP 401: invalid API key")).toBe("HTTP 401: invalid API key");
  });

  it.each(["voiceDesign", "voiceStyle"])("preserves %s input and clears running state without retries", async (type) => {
    const patchNode = vi.fn();
    const fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "MiMo 文本润色失败 (HTTP 402): Insufficient account balance" }) });
    vi.stubGlobal("fetch", fetch);
    const actions = createSynthesisActions(() => ({
      nodesRef: { current: [{ id: "test", type, data: { instruction: "原始描述", text: "原始风格" } }] },
      edgesRef: { current: [] }, isAnyApiKeyReady: () => true, patchNode, getApiHeaders: () => ({})
    } as unknown as SynthesisActionsContext));
    if (type === "voiceDesign") await actions.optimizeVoiceDesign("test");
    else await actions.optimizeVoiceStyle("test");
    expect(fetch).toHaveBeenCalledTimes(1);
    const finalPatch = patchNode.mock.calls.at(-1)?.[1];
    expect(finalPatch).toEqual({ isRunning: false, error: expect.stringContaining("原始描述已保留") });
    expect(finalPatch).not.toHaveProperty("instruction");
    expect(finalPatch).not.toHaveProperty("text");
  });
});
