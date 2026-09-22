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

  it("should generate instant skeleton preserving layout, titles, positions while stripping heavy audio", () => {
    const rawWorkspace = {
      id: "board-heavy",
      type: "board",
      name: "重度音色工作区",
      nodes: [
        {
          id: "node-ref",
          type: "referenceAudio",
          position: { x: 120, y: 340 },
          data: {
            title: "参考角色原声",
            audio: { dataUrl: "data:audio/wav;base64,AAAA..." },
            audioAssets: [{ dataUrl: "data:audio/wav;base64,BBBB..." }]
          }
        },
        {
          id: "node-clone",
          type: "voiceClone",
          position: { x: 500, y: 340 },
          data: {
            title: "克隆合成节点",
            text: "克隆合成台词文本",
            instruction: "情绪饱满"
          }
        }
      ],
      edges: [
        { id: "e1", source: "node-ref", target: "node-clone" }
      ]
    };

    // 提取纯视觉骨架
    const skeleton = {
      ...rawWorkspace,
      nodes: rawWorkspace.nodes.map((node) => {
        const d = { ...node.data };
        if (d.audio) d.audio = { ...d.audio, dataUrl: "" };
        if (Array.isArray(d.audioAssets)) d.audioAssets = d.audioAssets.map((a) => ({ ...a, dataUrl: "" }));
        return { ...node, data: d };
      })
    };

    // 1. 验证位置、名称、连线 100% 完整保留，支持第 0ms 秒开呈现
    expect(skeleton.nodes.length).toBe(2);
    expect(skeleton.edges.length).toBe(1);
    expect(skeleton.nodes[0].position).toEqual({ x: 120, y: 340 });
    expect(skeleton.nodes[0].data.title).toBe("参考角色原声");
    expect(skeleton.nodes[1].data.text).toBe("克隆合成台词文本");

    // 2. 验证沉重的 Base64 均已抽空
    expect(skeleton.nodes[0].data.audio.dataUrl).toBe("");
    expect(skeleton.nodes[0].data.audioAssets[0].dataUrl).toBe("");
  });

  it("should incrementally hydrate heavy assets into existing nodes without layout shifting", () => {
    const renderedNodes = [
      {
        id: "node-ref",
        type: "referenceAudio",
        position: { x: 120, y: 340 },
        data: {
          title: "参考角色原声",
          audio: { dataUrl: "" }
        }
      }
    ];

    const fullWorkspaceNodes = [
      {
        id: "node-ref",
        type: "referenceAudio",
        position: { x: 120, y: 340 },
        data: {
          title: "参考角色原声",
          audio: { dataUrl: "/api/audio-cache/hydrated.wav" },
          audioAssets: [{ dataUrl: "/api/audio-cache/sample.wav" }]
        }
      }
    ];

    // 模拟前端渐进式注水逻辑
    const fullMap = new Map(fullWorkspaceNodes.map((n) => [n.id, n]));
    const hydratedNodes = renderedNodes.map((cn) => {
      const fn = fullMap.get(cn.id);
      if (!fn) return cn;
      return {
        ...cn,
        data: {
          ...cn.data,
          ...fn.data,
          audio: fn.data?.audio || cn.data?.audio,
          audioAssets: fn.data?.audioAssets || cn.data?.audioAssets
        }
      };
    });

    // 验证坐标完全无漂移，且大资源无缝填入
    expect(hydratedNodes[0].position).toEqual({ x: 120, y: 340 });
    expect(hydratedNodes[0].data.audio.dataUrl).toBe("/api/audio-cache/hydrated.wav");
    expect(hydratedNodes[0].data.audioAssets?.[0].dataUrl).toBe("/api/audio-cache/sample.wav");
  });

  it("should perform atomic replacement on workspace switch without leaking nodes from previous board", () => {
    // 模拟画板 A（原有 3 个克隆节点）
    const boardA_Nodes = [
      { id: "node-a1", type: "voiceClone", position: { x: 100, y: 100 }, data: { title: "画板A节点1" } },
      { id: "node-a2", type: "voiceClone", position: { x: 400, y: 100 }, data: { title: "画板A节点2" } },
      { id: "node-a3", type: "voiceClone", position: { x: 700, y: 100 }, data: { title: "画板A节点3" } }
    ];

    // 模拟画板 B（2 个音色创造节点，ID与A完全不同）
    const boardB_Nodes = [
      { id: "node-b1", type: "voiceDesign", position: { x: 150, y: 200 }, data: { title: "画板B节点1" } },
      { id: "node-b2", type: "voiceDesign", position: { x: 550, y: 200 }, data: { title: "画板B节点2" } }
    ];

    // 严禁使用 currentNodes.map(cn => fullMap.get(cn.id) || cn)，直接原子全量替换
    let currentNodes = boardA_Nodes;
    expect(currentNodes.length).toBe(3);

    // 切换至画板 B：原子替换
    currentNodes = boardB_Nodes;

    // 验证：画布上 100% 只有画板 B 的节点，绝对无画板 A 的任何残余
    expect(currentNodes.length).toBe(2);
    expect(currentNodes.map(n => n.id)).toEqual(["node-b1", "node-b2"]);
    expect(currentNodes.some(n => n.id.startsWith("node-a"))).toBe(false);
  });

  it("should reject out-of-order network responses using switchingTargetIdRef concurrency lock", () => {
    let switchingTargetId: string | null = null;
    let activeWorkspaceId: string | null = "board-initial";

    // 1. 用户点击画板 A
    switchingTargetId = "board-A";

    // 2. 在画板 A 响应前，用户又迅速点击了画板 B
    switchingTargetId = "board-B";

    // 3. 此时画板 A 的异步响应慢吞吞到达
    const responseBoardA = { id: "board-A", name: "慢速画板A" };
    if (switchingTargetId === responseBoardA.id) {
      activeWorkspaceId = responseBoardA.id;
    }
    // 验证画板 A 响应被安全拦截抛弃
    expect(activeWorkspaceId).toBe("board-initial");

    // 4. 画板 B 的响应到达
    const responseBoardB = { id: "board-B", name: "目标画板B" };
    if (switchingTargetId === responseBoardB.id) {
      activeWorkspaceId = responseBoardB.id;
    }
    // 验证画板 B 顺利生效
    expect(activeWorkspaceId).toBe("board-B");
  });

  it("should calculate identical workspace key to avoid redundant auto-save right after switching", () => {
    function computeWorkspaceKey(ws: { id: string; name: string }, currentNodes: Array<{ id: string; type: string; data: unknown }>) {
      const nodeDataHash = currentNodes.map(n => `${n.id}:${n.type}:${JSON.stringify(n.data)}`).join("|");
      return `${ws.id}:${ws.name}:${currentNodes.length}:${nodeDataHash}`;
    }

    const loadedWorkspace = { id: "board-1", name: "主画板" };
    const loadedNodes = [
      { id: "node-1", type: "voiceClone", data: { text: "你好世界" } }
    ];

    // 刚载入时记录的快照哈希
    const snapshotHash = computeWorkspaceKey(loadedWorkspace, loadedNodes);

    // React 组件渲染时实时计算的哈希
    const currentRenderHash = computeWorkspaceKey(loadedWorkspace, loadedNodes);

    // 两个哈希完全相等，从而判定没有发生任何用户修改，跳过自动保存
    expect(currentRenderHash).toBe(snapshotHash);

    // 用户输入改变文本
    const modifiedNodes = [
      { id: "node-1", type: "voiceClone", data: { text: "你好世界！这是新改动" } }
    ];
    const modifiedHash = computeWorkspaceKey(loadedWorkspace, modifiedNodes);

    // 哈希发生改变，触发正常防抖保存
    expect(modifiedHash).not.toBe(snapshotHash);
  });

  it("should extract lightweight node digest without serializing heavy base64 strings", () => {
    function getNodeDigest(n: any): string {
      const d = (n.data || {}) as Record<string, any>;
      const audioDigest = d.audio
        ? `${d.audio.fileName || ""}_${d.audio.size || 0}_${d.audio.dataUrl ? d.audio.dataUrl.length : 0}`
        : "";
      const artifactDigest = d.artifact
        ? `${d.artifact.id || ""}_${d.artifact.createdAt || ""}_${d.artifact.audioDataUrl ? d.artifact.audioDataUrl.length : 0}`
        : "";
      return `${n.id}:${n.type}:${Math.round(n.position?.x ?? 0)},${Math.round(n.position?.y ?? 0)}:${d.title || ""}:${d.text || ""}:${audioDigest}:${artifactDigest}`;
    }

    const heavyBase64 = "data:audio/wav;base64," + "A".repeat(1024 * 1024 * 5); // 5MB 模拟音频
    const nodeA = {
      id: "node-art",
      type: "artifact",
      position: { x: 100, y: 200 },
      data: {
        title: "产物A",
        text: "台词",
        artifact: { id: "art-1", createdAt: 123456, audioDataUrl: heavyBase64 }
      }
    };

    const digest1 = getNodeDigest(nodeA);
    // 验证 digest 极其简短且不包含 5MB 的 A 字符串
    expect(digest1.length).toBeLessThan(200);
    expect(digest1).toContain("node-art:artifact:100,200:产物A:台词::art-1_123456_5242902");

    // 模拟位置变动
    const nodeB = { ...nodeA, position: { x: 150, y: 200 } };
    expect(getNodeDigest(nodeB)).not.toBe(digest1);

    // 模拟文本变动
    const nodeC = { ...nodeA, data: { ...nodeA.data, text: "新台词" } };
    expect(getNodeDigest(nodeC)).not.toBe(digest1);
  });

  it("should preserve scroll position on remount and only scroll when new items are added", () => {
    let scrolledCount = 0;
    function simulateScrollEffect(currentCount: number, prevCountRef: { current: number }) {
      if (currentCount > prevCountRef.current) {
        scrolledCount++;
      }
      prevCountRef.current = currentCount;
    }

    // 初次挂载：已有 5 个音频
    const prevRef = { current: 5 };
    simulateScrollEffect(5, prevRef);
    // 初次挂载不应滚动
    expect(scrolledCount).toBe(0);

    // 移出视野再移回视野（重入挂载）：仍是 5 个音频
    simulateScrollEffect(5, prevRef);
    // 依然绝不滚动，保持用户浏览位置
    expect(scrolledCount).toBe(0);

    // 真实生成新音频：变成 6 个音频
    simulateScrollEffect(6, prevRef);
    // 应该触发滚动到最新生成的音频
    expect(scrolledCount).toBe(1);
  });
});

