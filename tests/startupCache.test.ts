import { describe, it, expect } from "vitest";
import { stripHeavyDataForCache, sanitizeAudioUrl } from "../src/utils/cache";
import type { WorkspacePayload, StudioNode } from "../src/App";

describe("Startup Cache & Performance Optimization", () => {
  it("sanitizeAudioUrl should strip data: and strings longer than 500 chars, preserving short API routes", () => {
    expect(sanitizeAudioUrl(undefined)).toBeUndefined();
    expect(sanitizeAudioUrl("/api/audio-cache/test.wav")).toBe("/api/audio-cache/test.wav");
    expect(sanitizeAudioUrl("data:audio/wav;base64,UklGRi4AAABXQVZFZmls")).toBe("");
    expect(sanitizeAudioUrl("a".repeat(501))).toBe("");
    expect(sanitizeAudioUrl("a".repeat(499))).toBe("a".repeat(499));
  });

  it("stripHeavyDataForCache should comprehensively strip all audio Base64 while 100% preserving topology and metadata", () => {
    // 模拟一个包含多种节点与内联 Base64 的大画板
    const fakeBase64 = "data:audio/wav;base64," + "A".repeat(50000); // 50KB

    const rawWorkspace: WorkspacePayload = {
      id: "board-test-cache",
      name: "性能验证测试画板",
      type: "board",
      createdAt: "2026-09-17T18:00:00.000Z",
      updatedAt: "2026-09-17T18:00:00.000Z",
      nodes: [
        {
          id: "ref-1",
          type: "referenceAudio",
          position: { x: 100, y: 150 },
          data: {
            title: "参考音频节点",
            audio: {
              fileName: "sample.wav",
              mimeType: "audio/wav",
              size: 50000,
              dataUrl: fakeBase64
            },
            audioAssets: [
              {
                fileName: "sample1.wav",
                mimeType: "audio/wav",
                size: 50000,
                dataUrl: fakeBase64
              },
              {
                fileName: "sample2.wav",
                mimeType: "audio/wav",
                size: 100,
                dataUrl: "/api/audio-cache/preserved.wav"
              }
            ]
          }
        },
        {
          id: "clone-1",
          type: "voiceClone",
          position: { x: 500, y: 150 },
          data: {
            title: "音频克隆节点",
            text: "克隆台词文本",
            instruction: "自然清晰",
            audioDataUrl: fakeBase64
          }
        },
        {
          id: "batch-1",
          type: "batchVoiceClone",
          position: { x: 100, y: 400 },
          data: {
            title: "批量克隆节点",
            batchRows: [
              {
                id: "row_1",
                title: "第一句",
                instruction: "沉静",
                text: "测试对白",
                refAudioUrl: fakeBase64,
                artifacts: [
                  {
                    id: "art_1",
                    fileName: "row1_output.wav",
                    audioDataUrl: fakeBase64,
                    elapsedMs: 120,
                    createdAt: "2026-09-17T18:00:00.000Z"
                  }
                ]
              }
            ]
          }
        },
        {
          id: "art-node-1",
          type: "artifact",
          position: { x: 900, y: 150 },
          data: {
            title: "产物_01",
            artifact: {
              fileName: "art_01.wav",
              audioDataUrl: fakeBase64,
              elapsedMs: 450,
              createdAt: "2026-09-17T18:00:00.000Z",
              sourceNodeName: "音频克隆"
            }
          }
        },
        {
          id: "batch-art-1",
          type: "batchArtifact",
          position: { x: 600, y: 400 },
          data: {
            title: "批量产物",
            batchArtifacts: [
              {
                id: "ba_1",
                rowTitle: "第一句",
                fileName: "ba_1.wav",
                audioDataUrl: fakeBase64,
                elapsedMs: 300,
                createdAt: "2026-09-17T18:00:00.000Z"
              }
            ]
          }
        }
      ] as StudioNode[],
      edges: [
        { id: "e1-2", source: "ref-1", target: "clone-1" },
        { id: "e2-3", source: "clone-1", target: "art-node-1" }
      ],
      stashItems: [
        {
          id: "stash-1",
          fileName: "stash.wav",
          audioDataUrl: fakeBase64,
          elapsedMs: 500,
          createdAt: "2026-09-17T18:00:00.000Z",
          sourceNodeName: "音频克隆"
        }
      ]
    };

    const rawJson = JSON.stringify(rawWorkspace);
    // 原始带有多个 Base64 的 JSON 大小
    expect(rawJson.length).toBeGreaterThan(350000);

    const stripped = stripHeavyDataForCache(rawWorkspace);
    expect(stripped).not.toBeNull();

    const strippedJson = JSON.stringify(stripped);
    // 精简后应极小（通常 < 5KB，远低于 5MB 限制）
    expect(strippedJson.length).toBeLessThan(5000);

    // 验证拓扑结构 100% 完整保留
    expect(stripped!.nodes?.length).toBe(5);
    expect(stripped!.edges?.length).toBe(2);
    expect(stripped!.stashItems?.length).toBe(1);

    // 验证所有坐标完全保留
    expect(stripped!.nodes![0].position).toEqual({ x: 100, y: 150 });
    expect(stripped!.nodes![1].position).toEqual({ x: 500, y: 150 });

    // 验证 Base64 均被置空，而轻量路径被保留
    const refNodeData = stripped!.nodes![0].data as any;
    expect(refNodeData.audio.dataUrl).toBe("");
    expect(refNodeData.audioAssets[0].dataUrl).toBe("");
    expect(refNodeData.audioAssets[1].dataUrl).toBe("/api/audio-cache/preserved.wav");

    const cloneData = stripped!.nodes![1].data as any;
    expect(cloneData.audioDataUrl).toBe("");
    expect(cloneData.text).toBe("克隆台词文本");

    const batchData = stripped!.nodes![2].data as any;
    expect(batchData.batchRows[0].refAudioUrl).toBe("");
    expect(batchData.batchRows[0].artifacts[0].audioDataUrl).toBe("");

    const artData = stripped!.nodes![3].data as any;
    expect(artData.artifact.audioDataUrl).toBe("");
    expect(artData.artifact.fileName).toBe("art_01.wav");

    const batchArtData = stripped!.nodes![4].data as any;
    expect(batchArtData.batchArtifacts[0].audioDataUrl).toBe("");

    const stash = stripped!.stashItems![0];
    expect(stash.audioDataUrl).toBe("");
    expect(stash.fileName).toBe("stash.wav");
  });

  it("should determine proper window background color based on color mode (light vs dark vs system)", () => {
    function resolveThemeColor(saved: any, isSystemDark: boolean) {
      let isLight = false;
      let bgColor = "#080807";

      if (saved && typeof saved === "object") {
        if (saved.mode === "light") {
          isLight = true;
          bgColor = saved.bgColor || saved.lightBgColor || "#ffffff";
        } else if (saved.mode === "dark") {
          isLight = false;
          bgColor = saved.bgColor || saved.darkBgColor || "#080807";
        } else {
          isLight = !isSystemDark;
          bgColor = isLight ? (saved.lightBgColor || saved.bgColor || "#ffffff") : (saved.darkBgColor || saved.bgColor || "#080807");
        }
      } else {
        isLight = !isSystemDark;
        bgColor = isLight ? "#ffffff" : "#080807";
      }

      return { isLight, bgColor };
    }

    // 1. 明确设置亮色模式时，必须输出白色/浅色背景，彻底消除黑屏闪烁
    const lightResult = resolveThemeColor({ mode: "light", lightBgColor: "#f8fafc" }, false);
    expect(lightResult.isLight).toBe(true);
    expect(lightResult.bgColor).toBe("#f8fafc");

    // 2. 明确设置暗色模式时，输出深黑背景
    const darkResult = resolveThemeColor({ mode: "dark", darkBgColor: "#080807" }, false);
    expect(darkResult.isLight).toBe(false);
    expect(darkResult.bgColor).toBe("#080807");

    // 3. 设置系统模式跟随，系统为亮色时，输出白色
    const systemLightResult = resolveThemeColor({ mode: "system", lightBgColor: "#ffffff", darkBgColor: "#080807" }, false);
    expect(systemLightResult.isLight).toBe(true);
    expect(systemLightResult.bgColor).toBe("#ffffff");

    // 4. 设置系统模式跟随，系统为暗色时，输出黑色
    const systemDarkResult = resolveThemeColor({ mode: "system", lightBgColor: "#ffffff", darkBgColor: "#080807" }, true);
    expect(systemDarkResult.isLight).toBe(false);
    expect(systemDarkResult.bgColor).toBe("#080807");

    // 5. 无任何历史存储，系统为亮色，默认输出白色
    const defaultLight = resolveThemeColor(null, false);
    expect(defaultLight.isLight).toBe(true);
    expect(defaultLight.bgColor).toBe("#ffffff");

    // 6. 无任何历史存储，系统为暗色，默认输出黑色
    const defaultDark = resolveThemeColor(null, true);
    expect(defaultDark.isLight).toBe(false);
    expect(defaultDark.bgColor).toBe("#080807");
  });
});
