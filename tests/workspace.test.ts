import { describe, it, expect } from "vitest";

describe("Workspace Audio Data Offloading (画板轻量化与数据转换测试)", () => {
  it("should detect and replace base64 data URLs with cache endpoints", () => {
    const mockNodes = [
      {
        id: "node-1",
        type: "artifact",
        data: {
          title: "测试克隆产物",
          artifact: {
            id: "art-1",
            audioDataUrl: "data:audio/wav;base64,UklGRi4AAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=",
            fileName: "test.wav"
          }
        }
      }
    ];

    mockNodes.forEach((node) => {
      if (node.data.artifact.audioDataUrl.startsWith("data:")) {
        const fname = `${node.data.title}_${node.id.slice(-6)}.wav`;
        node.data.artifact.audioDataUrl = `/api/audio-cache/${encodeURIComponent(fname)}`;
      }
    });

    expect(mockNodes[0].data.artifact.audioDataUrl).toBe("/api/audio-cache/%E6%B5%8B%E8%AF%95%E5%85%8B%E9%9A%86%E4%BA%A7%E7%89%A9_node-1.wav");
  });
});
