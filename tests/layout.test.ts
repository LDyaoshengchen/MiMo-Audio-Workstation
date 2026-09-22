import { describe, it, expect } from "vitest";
import { calculateArtifactGrid, calculateBranchColumns, computeSmartDagLayout } from "../src/utils/layout.js";

describe("Tidy & Pipeline Tree Layout Algorithm (生产算法真实测试)", () => {
  it("should arrange artifact grid in 3-column rows", () => {
    const maxCols = 3;
    const itemW = 340;
    const itemH = 145;
    const colGap = 60;
    const rowGap = 60;
    const startX = 400;
    const startY = 80;

    const positions = calculateArtifactGrid(7, startX, startY, maxCols, itemW, itemH, colGap, rowGap);

    // Row 0 (3 items)
    expect(positions[0]).toMatchObject({ x: 400, y: 80, col: 0, row: 0 });
    expect(positions[1]).toMatchObject({ x: 800, y: 80, col: 1, row: 0 });
    expect(positions[2]).toMatchObject({ x: 1200, y: 80, col: 2, row: 0 });

    // Row 1 (3 items)
    expect(positions[3]).toMatchObject({ x: 400, y: 285, col: 0, row: 1 });
    expect(positions[4]).toMatchObject({ x: 800, y: 285, col: 1, row: 1 });
    expect(positions[5]).toMatchObject({ x: 1200, y: 285, col: 2, row: 1 });

    // Row 2 (1 item)
    expect(positions[6]).toMatchObject({ x: 400, y: 490, col: 0, row: 2 });
  });

  it("should trigger column wrap after 5 workflow branches", () => {
    const branchHeights = Array(12).fill(200); // 12 equal small branches
    const columnAssignments = calculateBranchColumns(branchHeights, 5, 2200);

    // Branches 0~4 in Column 0
    expect(columnAssignments.slice(0, 5)).toEqual([0, 0, 0, 0, 0]);
    // Branches 5~9 in Column 1
    expect(columnAssignments.slice(5, 10)).toEqual([1, 1, 1, 1, 1]);
    // Branches 10~11 in Column 2
    expect(columnAssignments.slice(10, 12)).toEqual([2, 2]);
  });

  it("should trigger column wrap early when column height exceeds threshold", () => {
    const branchHeights = [1200, 1100, 500, 400]; // 1200 + 1100 = 2300 >= 2200 -> wraps at index 1
    const colAllocations = calculateBranchColumns(branchHeights, 5, 2200, 50);

    expect(colAllocations[0]).toBe(0);
    expect(colAllocations[1]).toBe(1);
    expect(colAllocations[2]).toBe(1);
    expect(colAllocations[3]).toBe(1);
  });

  it("should stack parallel inputs closely in same column (解决图四/图五问题)", () => {
    const nodes = [
      { id: "style", type: "voiceStyle", width: 280, height: 180, originalX: 80, originalY: 80 },
      { id: "prompt", type: "prompt", width: 280, height: 180, originalX: 80, originalY: 300 },
      { id: "clone", type: "voiceClone", width: 340, height: 450, originalX: 420, originalY: 80 }
    ];
    const edges = [
      { source: "style", target: "clone", targetHandle: "instruction" },
      { source: "prompt", target: "clone", targetHandle: "text" }
    ];

    const pos = computeSmartDagLayout(nodes, edges, 80, 80);

    const stylePos = pos.get("style")!;
    const promptPos = pos.get("prompt")!;
    const clonePos = pos.get("clone")!;

    // Both style and prompt should be in Column 0 (x=80)
    expect(stylePos.x).toBe(80);
    expect(promptPos.x).toBe(80);
    // Clone should be in Column 1 (x=80 + 280 + 60 = 420)
    expect(clonePos.x).toBe(420);

    // Style is at top
    expect(stylePos.y).toBe(80);
    // Prompt should be placed immediately below style with standard 50px gap: 80 + 180 + 50 = 310
    expect(promptPos.y).toBe(310);
    // Vertical distance between style bottom and prompt top is exactly 50px
    expect(promptPos.y - (stylePos.y + 180)).toBe(50);
  });

  it("should pull unlinked upstream inputs to preceding column of downstream node (解决图二/图三问题)", () => {
    const nodes = [
      { id: "design", type: "voiceDesign", width: 340, height: 380, originalX: 80, originalY: 80 },
      { id: "art1", type: "artifact", width: 340, height: 145, originalX: 480, originalY: 80, seqIndex: 1 },
      { id: "style", type: "voiceStyle", width: 280, height: 180, originalX: 80, originalY: 500 },
      { id: "prompt", type: "prompt", width: 280, height: 180, originalX: 80, originalY: 700 },
      { id: "clone", type: "voiceClone", width: 340, height: 450, originalX: 900, originalY: 80 }
    ];
    const edges = [
      { source: "design", target: "art1" },
      { source: "art1", target: "clone", targetHandle: "voice" },
      { source: "style", target: "clone", targetHandle: "instruction" },
      { source: "prompt", target: "clone", targetHandle: "text" }
    ];

    const pos = computeSmartDagLayout(nodes, edges, 80, 80);

    const designPos = pos.get("design")!;
    const art1Pos = pos.get("art1")!;
    const stylePos = pos.get("style")!;
    const promptPos = pos.get("prompt")!;
    const clonePos = pos.get("clone")!;

    // Design is at Column 0
    expect(designPos.x).toBe(80);
    // Art1 is directly right of design (col 1)
    expect(art1Pos.x).toBe(80 + 340 + 60); // 480

    // Style and Prompt MUST be pulled to Column 1 (x=480), NOT stuck in Column 0!
    expect(stylePos.x).toBe(480);
    expect(promptPos.x).toBe(480);

    // Clone is at Column 2
    expect(clonePos.x).toBeGreaterThan(480);
  });

  it("should reserve spacious gap between multi-batch branches and vertically center shared input (解决下边排版拥挤与连线倾斜问题)", () => {
    // 模拟用户截图中的场景：
    // 1个公共参考音频 + 综合节点，分流到两个批量克隆节点（狂鲨 + 独立角色），各自带有两行批量产物
    const nodes = [
      { id: "refAudio", type: "referenceAudio", width: 340, height: 320, originalX: 80, originalY: 80 },
      { id: "merge", type: "audioMerge", width: 340, height: 220, originalX: 480, originalY: 80 },
      { id: "batch1", type: "batchVoiceClone", width: 640, height: 480, originalX: 880, originalY: 80 },
      { id: "batch2", type: "batchVoiceClone", width: 640, height: 550, originalX: 880, originalY: 600 },
      // batch1 的 4 个产物 (Row 0: 3个, Row 1: 1个)
      { id: "art1_1", type: "batchArtifact", width: 440, height: 440, originalX: 1580, originalY: 80, seqIndex: 1 },
      { id: "art1_2", type: "batchArtifact", width: 440, height: 440, originalX: 2080, originalY: 80, seqIndex: 2 },
      { id: "art1_3", type: "batchArtifact", width: 440, height: 440, originalX: 2580, originalY: 80, seqIndex: 3 },
      { id: "art1_4", type: "batchArtifact", width: 440, height: 440, originalX: 1580, originalY: 600, seqIndex: 4 },
      // batch2 的 6 个产物 (Row 0: 3个, Row 1: 3个)
      { id: "art2_1", type: "batchArtifact", width: 440, height: 440, originalX: 1580, originalY: 1100, seqIndex: 1 },
      { id: "art2_2", type: "batchArtifact", width: 440, height: 440, originalX: 2080, originalY: 1100, seqIndex: 2 },
      { id: "art2_3", type: "batchArtifact", width: 440, height: 440, originalX: 2580, originalY: 1100, seqIndex: 3 },
      { id: "art2_4", type: "batchArtifact", width: 440, height: 440, originalX: 1580, originalY: 1600, seqIndex: 4 },
      { id: "art2_5", type: "batchArtifact", width: 440, height: 440, originalX: 2080, originalY: 1600, seqIndex: 5 },
      { id: "art2_6", type: "batchArtifact", width: 440, height: 440, originalX: 2580, originalY: 1600, seqIndex: 6 }
    ];

    const edges = [
      { source: "refAudio", target: "merge" },
      { source: "merge", target: "batch1" },
      { source: "merge", target: "batch2" },
      { source: "batch1", target: "art1_1" },
      { source: "batch1", target: "art1_2" },
      { source: "batch1", target: "art1_3" },
      { source: "batch1", target: "art1_4" },
      { source: "batch2", target: "art2_1" },
      { source: "batch2", target: "art2_2" },
      { source: "batch2", target: "art2_3" },
      { source: "batch2", target: "art2_4" },
      { source: "batch2", target: "art2_5" },
      { source: "batch2", target: "art2_6" }
    ];

    const pos = computeSmartDagLayout(nodes, edges, 80, 80);

    const art1_4Pos = pos.get("art1_4")!;
    const art2_1Pos = pos.get("art2_1")!;
    const mergePos = pos.get("merge")!;
    const batch1Pos = pos.get("batch1")!;
    const batch2Pos = pos.get("batch2")!;

    // 1. 验证分支间距离：上一分支最底部的产物 art1_4 底部与下一分支最顶部的产物 art2_1 顶部之间，净留白 >= 140px！
    const art1_4Bottom = art1_4Pos.y + 440;
    const gapBetweenBranches = art2_1Pos.y - art1_4Bottom;
    expect(gapBetweenBranches).toBeGreaterThanOrEqual(140);

    // 2. 验证生成器自身纵向隔离
    expect(batch2Pos.y).toBeGreaterThanOrEqual(art1_4Bottom + 140);

    // 3. 验证公共上游节点 (merge) 垂直居中：不应钉死在 80，而应处于 batch1 与 batch2 之间
    expect(mergePos.y).toBeGreaterThan(batch1Pos.y);
    expect(mergePos.y).toBeLessThan(batch2Pos.y + 550);
  });

  it("should arrange Figure 1 topology correctly: compact inputs in Col 0, clone1 in Col 1, and downstream clone2 in Col 2 aligned with merge (解决图一排版错位问题)", () => {
    // 还原图一的真实结构与节点关系：
    // - 参考音频整合 (audioMerge) -> 深海狂鲨 (voiceClone) 的参考
    // - 男主角参考音频 (referenceAudio) -> 男主对白合成 (voiceClone) 的参考
    // - 男主角情绪风格 (voiceStyle) -> 男主对白合成 (voiceClone) 的风格
    // - 男主角台词 (prompt) -> 男主对白合成 (voiceClone) 的文本
    // - 男主对白合成 (voiceClone) -> 深海狂鲨 (voiceClone) 的风格
    const nodes = [
      { id: "merge", type: "audioMerge", width: 340, height: 160, originalX: 80, originalY: 80 },
      { id: "refAudio", type: "referenceAudio", width: 340, height: 180, originalX: 80, originalY: 300 },
      { id: "style", type: "voiceStyle", width: 340, height: 180, originalX: 80, originalY: 520 },
      { id: "prompt", type: "prompt", width: 340, height: 180, originalX: 80, originalY: 740 },
      { id: "clone1", type: "voiceClone", width: 360, height: 380, originalX: 480, originalY: 300 }, // 男主对白合成
      { id: "clone2", type: "voiceClone", width: 360, height: 420, originalX: 900, originalY: 80 }   // 深海狂鲨
    ];

    const edges = [
      { source: "merge", target: "clone2", targetHandle: "voice" },
      { source: "refAudio", target: "clone1", targetHandle: "voice" },
      { source: "style", target: "clone1", targetHandle: "instruction" },
      { source: "prompt", target: "clone1", targetHandle: "text" },
      { source: "clone1", target: "clone2", targetHandle: "instruction" }
    ];

    const pos = computeSmartDagLayout(nodes, edges, 80, 80);

    const mergePos = pos.get("merge")!;
    const refAudioPos = pos.get("refAudio")!;
    const stylePos = pos.get("style")!;
    const promptPos = pos.get("prompt")!;
    const clone1Pos = pos.get("clone1")!;
    const clone2Pos = pos.get("clone2")!;

    // 1. 验证 X 轴拓扑分层：输入在 Col 0 (x=80), clone1 在 Col 1 (x=480), clone2 在 Col 2 (x=900)
    expect(mergePos.x).toBe(80);
    expect(refAudioPos.x).toBe(80);
    expect(stylePos.x).toBe(80);
    expect(promptPos.x).toBe(80);
    expect(clone1Pos.x).toBe(80 + 340 + 60); // 480
    expect(clone2Pos.x).toBe(480 + 360 + 60); // 900

    // 2. 验证 Col 0 输入列紧凑排列，消除大断层空白：每个节点紧凑留白 50px
    expect(mergePos.y).toBe(80);
    expect(refAudioPos.y).toBe(80 + 160 + 50); // 290
    expect(stylePos.y).toBe(290 + 180 + 50);   // 520
    expect(promptPos.y).toBe(520 + 180 + 50);  // 750

    // 3. 验证生成器 Y 轴与其主输入平齐对齐：
    // clone1 对齐其参考音频 refAudio (y=290)
    expect(clone1Pos.y).toBe(refAudioPos.y);
    // clone2 对齐其参考音频 merge (y=80)
    expect(clone2Pos.y).toBe(mergePos.y);
  });

  it("should wrap to second column after 5 workflow blocks with an exact 280px column gap", () => {
    // 构造 8 个独立工作流分支
    const nodes: any[] = [];
    const edges: any[] = [];

    for (let i = 0; i < 8; i++) {
      const refId = `ref_${i}`;
      const cloneId = `clone_${i}`;
      nodes.push({ id: refId, type: "referenceAudio", width: 280, height: 160, originalX: 80, originalY: i * 300 });
      nodes.push({ id: cloneId, type: "voiceClone", width: 340, height: 400, originalX: 420, originalY: i * 300 });
      edges.push({ source: refId, target: cloneId, targetHandle: "voice" });
    }

    const pos = computeSmartDagLayout(nodes, edges, 80, 80);

    // 分支 0~4 位于第一列 (Col 0: ref 在 80, clone 在 420)
    for (let i = 0; i < 5; i++) {
      const refPos = pos.get(`ref_${i}`)!;
      const clonePos = pos.get(`clone_${i}`)!;
      expect(refPos.x).toBe(80);
      expect(clonePos.x).toBe(420);
    }

    // 第一列中所有节点实际物理最右边缘 = 420 + 340 = 760
    const col0MaxRight = 420 + 340; // 760

    // 分支 5~7 应该换到第二列 (Col 1: ref 应该从 760 + 280 = 1040 开始，间距精确为 280px 通透走廊)
    for (let i = 5; i < 8; i++) {
      const refPos = pos.get(`ref_${i}`)!;
      const clonePos = pos.get(`clone_${i}`)!;
      expect(refPos.x).toBe(col0MaxRight + 280); // 1040
      expect(clonePos.x).toBe(col0MaxRight + 280 + 280 + 60); // 1380
    }

    // 验证第二列的分支 Y 坐标回到顶部 (80 开始)，垂直向下排列
    expect(pos.get("ref_5")!.y).toBe(80);
  });

  it("should diagnose real workspace layout positions", () => {
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync("workspaces_backup_safe.json", "utf8"));
    const list = data.workspaces || data;
    const ws = list.find((w: any) => w.name && w.name.includes("金毛队长"));
    expect(ws).toBeDefined();

    const layoutInputNodes = ws.nodes.map((n: any) => ({
      id: n.id,
      type: n.type,
      width: n.measured?.width || 340,
      height: n.measured?.height || 220,
      originalX: n.position.x,
      originalY: n.position.y
    }));

    const layoutInputEdges = ws.edges.map((e: any) => ({
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle
    }));

    const pos = computeSmartDagLayout(layoutInputNodes, layoutInputEdges, 80, 80);
    // 检查有哪些 blocks
    const adjMap = new Map<string, Set<string>>();
    layoutInputNodes.forEach((n: any) => adjMap.set(n.id, new Set()));
    layoutInputEdges.forEach((e: any) => {
      if (adjMap.has(e.source) && adjMap.has(e.target)) {
        adjMap.get(e.source)!.add(e.target);
        adjMap.get(e.target)!.add(e.source);
      }
    });
    const visited = new Set<string>();
    const bList: any[] = [];
    layoutInputNodes.forEach((n: any) => {
      if (visited.has(n.id)) return;
      const comp: any[] = [];
      const q = [n.id];
      visited.add(n.id);
      while (q.length > 0) {
        const curr = q.shift()!;
        comp.push(curr);
        (adjMap.get(curr) || []).forEach(nbr => {
          if (!visited.has(nbr)) { visited.add(nbr); q.push(nbr); }
        });
      }
      bList.push(comp);
    });
    bList.sort((a, b) => {
      const minXA = Math.min(...a.map((id: string) => ws.nodes.find((x: any) => x.id === id)?.position.x || 0));
      const minXB = Math.min(...b.map((id: string) => ws.nodes.find((x: any) => x.id === id)?.position.x || 0));
      const colA = minXA >= 3000 ? 1 : 0;
      const colB = minXB >= 3000 ? 1 : 0;
      if (colA !== colB) return colA - colB;
      const minYA = Math.min(...a.map((id: string) => ws.nodes.find((x: any) => x.id === id)?.position.y || 0));
      const minYB = Math.min(...b.map((id: string) => ws.nodes.find((x: any) => x.id === id)?.position.y || 0));
      return minYA - minYB;
    });
    const xs: number[] = [];
    pos.forEach((p) => xs.push(p.x));
    xs.sort((a, b) => a - b);

    // 验证真实画板排版核心指标：
    // 1. 全局最大 X 必须紧凑受控 (<= 7500px，实测 7000px，彻底消除之前回环暴增至 20880px 的 bug)
    expect(xs[xs.length - 1]).toBeLessThanOrEqual(7500);

    // 2. 第一列 (Block 0~4) 与第二列 (Block 5 以后) 之间的物理净留白为 280px (整体向右移，大列走廊更宽敞)
    const col0Nodes = bList.slice(0, 5).flat();
    const col0MaxRight = Math.max(...col0Nodes.map((id: string) => {
      const p = pos.get(id)!;
      const n = ws.nodes.find((x: any) => x.id === id);
      return p.x + (n.measured?.width || 340);
    }));
    const col1Nodes = bList.slice(5).flat();
    const col1MinLeft = Math.min(...col1Nodes.map((id: string) => pos.get(id)!.x));
    expect(col1MinLeft - col0MaxRight).toBe(280);

    // 3. 验证所有第二列工作流的起始 X 必须与第二列基准严格对齐 (col0MaxRight + 280)
    bList.slice(5).forEach((b) => {
      const bXs = b.map((id: string) => pos.get(id)?.x).filter((x: any) => x !== undefined);
      expect(Math.min(...bXs)).toBe(col0MaxRight + 280);
    });
  });

  it("should support downstream branch with intermediate input (audioMerge) placed after upstream artifact grid (支持图片画板综合排版规则)", () => {
    // 还原用户最新截图中的典型拓扑：
    // 上游：音色创造 (voiceDesign) 生成 9 个产物 (3列x3行)
    // 中游：其中一个产物连接到参考音频整合 (audioMerge)
    // 下游：参考音频整合连接到批量音频克隆 (batchVoiceClone)，产出批量产物
    const nodes: any[] = [
      { id: "design", type: "voiceDesign", width: 370, height: 500, originalX: 80, originalY: 80 },
      ...Array.from({ length: 9 }, (_, i) => ({
        id: `art_${i}`,
        type: "artifact",
        width: 340,
        height: 145,
        originalX: 510 + (i % 3) * 400,
        originalY: 80 + Math.floor(i / 3) * 205,
        seqIndex: i + 1
      })),
      { id: "merge", type: "audioMerge", width: 340, height: 220, originalX: 1710, originalY: 285 },
      { id: "batchClone", type: "batchVoiceClone", width: 640, height: 550, originalX: 2110, originalY: 285 },
      ...Array.from({ length: 3 }, (_, i) => ({
        id: `bart_${i}`,
        type: "batchArtifact",
        width: 440,
        height: 440,
        originalX: 2810 + i * 500,
        originalY: 285,
        seqIndex: i + 1
      }))
    ];

    const edges: any[] = [
      ...Array.from({ length: 9 }, (_, i) => ({
        source: "design",
        target: `art_${i}`,
        targetHandle: "artifact"
      })),
      { source: "art_4", target: "merge", targetHandle: "audio" },
      { source: "merge", target: "batchClone", targetHandle: "voice" },
      ...Array.from({ length: 3 }, (_, i) => ({
        source: "batchClone",
        target: `bart_${i}`,
        targetHandle: "artifact"
      }))
    ];

    const pos = computeSmartDagLayout(nodes, edges, 80, 80);

    const designPos = pos.get("design")!;
    const art0Pos = pos.get("art_0")!;
    const art2Pos = pos.get("art_2")!;
    const mergePos = pos.get("merge")!;
    const batchPos = pos.get("batchClone")!;
    const bart0Pos = pos.get("bart_0")!;

    // 1. 上游生成器从基准列 (x=80) 优雅展开
    expect(designPos.x).toBe(80);
    expect(art0Pos.x).toBe(80 + 370 + 60); // 510
    expect(art2Pos.x).toBe(510 + 2 * (340 + 60)); // 1310

    // 2. 中间输入卡片 (audioMerge) 严格排布在上游 3 列产物网格之后 (在线之后，x >= 1710)
    const artGridRight = 1310 + 340; // 1650
    expect(mergePos.x).toBe(artGridRight + 60); // 1710

    // 3. 下游批量生成器紧随中间输入卡片之后
    expect(batchPos.x).toBe(1710 + 340 + 60); // 2110

    // 4. 下游批量产物紧随批量生成器之后
    expect(bart0Pos.x).toBe(2110 + 640 + 60); // 2810

    // 5. 纵向对齐来源产物所在行 (行1为 y=285)，平齐顺滑无逆流折线
    expect(mergePos.y).toBe(pos.get("art_4")!.y);
    expect(batchPos.y).toBe(mergePos.y);
  });
});


