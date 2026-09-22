import { describe, it, expect } from "vitest";
import { computeSmartDagLayout } from "../src/utils/layout.js";

describe("AudioMerge Layout Tests", () => {
  it("Scenario 1: audioMerge connects to batchVoiceClone as voice input", () => {
    const nodes = [
      { id: "merge", type: "audioMerge", width: 340, height: 220, originalX: 80, originalY: 80 },
      { id: "batch", type: "batchVoiceClone", width: 660, height: 460, originalX: 80, originalY: 80 },
      { id: "art1", type: "batchArtifact", width: 440, height: 440, originalX: 800, originalY: 80 }
    ];

    const edges = [
      { source: "merge", target: "batch", targetHandle: "voice" },
      { source: "batch", target: "art1", targetHandle: "artifact" }
    ];

    const res = computeSmartDagLayout(nodes, edges, 80, 80);
    console.log("=== Scenario 1: audioMerge -> batchVoiceClone -> batchArtifact ===");
    for (const [id, pos] of res.entries()) {
      console.log(`${id}: x=${pos.x}, y=${pos.y}`);
    }

    const mergePos = res.get("merge");
    const batchPos = res.get("batch");
    expect(mergePos).toBeDefined();
    expect(batchPos).toBeDefined();
    // audioMerge should be strictly to the left of batchVoiceClone! Never overlap!
    expect(mergePos!.x + 340).toBeLessThanOrEqual(batchPos!.x);
  });

  it("Scenario 2: upstream artifact connects to audioMerge", () => {
    const nodes = [
      { id: "batch", type: "batchVoiceClone", width: 660, height: 460, originalX: 80, originalY: 80 },
      { id: "art1", type: "batchArtifact", width: 440, height: 440, originalX: 800, originalY: 80 },
      { id: "merge", type: "audioMerge", width: 340, height: 220, originalX: 500, originalY: 600 }
    ];
    const edges = [
      { source: "batch", target: "art1", targetHandle: "artifact" },
      { source: "art1", target: "merge" }
    ];

    const res = computeSmartDagLayout(nodes, edges, 80, 80);
    console.log("\n=== Scenario 2: batchArtifact -> audioMerge ===");
    for (const [id, pos] of res.entries()) {
      console.log(`${id}: x=${pos.x}, y=${pos.y}`);
    }

    const mergePos = res.get("merge");
    const artPos = res.get("art1");
    expect(mergePos).toBeDefined();
    expect(artPos).toBeDefined();
    // audioMerge should be placed strictly to the right of the artifact grid!
    expect(mergePos!.x).toBeGreaterThanOrEqual(artPos!.x + 440);
  });

  it("Scenario 3: multiple reference audios -> audioMerge -> generator -> artifacts", () => {
    const nodes = [
      { id: "ref1", type: "referenceAudio", width: 340, height: 220, originalX: 80, originalY: 80 },
      { id: "ref2", type: "referenceAudio", width: 340, height: 220, originalX: 80, originalY: 340 },
      { id: "merge", type: "audioMerge", width: 340, height: 220, originalX: 480, originalY: 80 },
      { id: "batch", type: "batchVoiceClone", width: 660, height: 460, originalX: 880, originalY: 80 },
      { id: "art1", type: "batchArtifact", width: 440, height: 440, originalX: 1600, originalY: 80 }
    ];
    const edges = [
      { source: "ref1", target: "merge" },
      { source: "ref2", target: "merge" },
      { source: "merge", target: "batch", targetHandle: "voice" },
      { source: "batch", target: "art1", targetHandle: "artifact" }
    ];

    const res = computeSmartDagLayout(nodes, edges, 80, 80);
    const ref1Pos = res.get("ref1")!;
    const ref2Pos = res.get("ref2")!;
    const mergePos = res.get("merge")!;
    const batchPos = res.get("batch")!;
    const art1Pos = res.get("art1")!;

    expect(ref1Pos).toBeDefined();
    expect(ref2Pos).toBeDefined();
    expect(mergePos).toBeDefined();
    expect(batchPos).toBeDefined();
    expect(art1Pos).toBeDefined();

    // ref1 and ref2 are in root column
    expect(ref1Pos.x).toBe(80);
    expect(ref2Pos.x).toBe(80);
    expect(ref2Pos.y).toBeGreaterThanOrEqual(ref1Pos.y + 220);

    // merge is in intermediate column
    expect(mergePos.x).toBeGreaterThanOrEqual(ref1Pos.x + 340);

    // batch is in generator column
    expect(batchPos.x).toBeGreaterThanOrEqual(mergePos.x + 340);

    // art1 is to the right of batch
    expect(art1Pos.x).toBeGreaterThanOrEqual(batchPos.x + 660);
  });

  it("Scenario 4: unlinked / standalone audioMerge in board must have valid non-overlapping coordinates", () => {
    const nodes = [
      { id: "merge", type: "audioMerge", width: 340, height: 220, originalX: 80, originalY: 80 },
      { id: "batch", type: "batchVoiceClone", width: 660, height: 460, originalX: 80, originalY: 80 }
    ];
    const edges: Array<{ source: string; target: string }> = [];

    const res = computeSmartDagLayout(nodes, edges, 80, 80);
    const mergePos = res.get("merge")!;
    const batchPos = res.get("batch")!;

    expect(mergePos).toBeDefined();
    expect(batchPos).toBeDefined();
    // They must never overlap!
    const isSeparatedY = mergePos.y + 220 <= batchPos.y || batchPos.y + 460 <= mergePos.y;
    const isSeparatedX = mergePos.x + 340 <= batchPos.x || batchPos.x + 660 <= mergePos.x;
    expect(isSeparatedX || isSeparatedY).toBe(true);
  });

  it("Scenario 5: full pipeline with batchVoiceClone producing artifacts, and one artifact connects to audioMerge which connects back to batch (cycle / reuse)", () => {
    const nodes = [
      { id: "batch", type: "batchVoiceClone", width: 660, height: 460, originalX: 80, originalY: 80 },
      { id: "art1", type: "batchArtifact", width: 440, height: 440, originalX: 800, originalY: 80 },
      { id: "art2", type: "batchArtifact", width: 440, height: 440, originalX: 1300, originalY: 80 },
      { id: "merge", type: "audioMerge", width: 340, height: 220, originalX: 80, originalY: 80 }
    ];
    const edges = [
      { source: "batch", target: "art1", targetHandle: "artifact" },
      { source: "batch", target: "art2", targetHandle: "artifact" },
      { source: "art1", target: "merge" },
      { source: "merge", target: "batch", targetHandle: "voice" }
    ];

    const res = computeSmartDagLayout(nodes, edges, 80, 80);
    const mergePos = res.get("merge")!;
    const batchPos = res.get("batch")!;
    console.log("\n=== Scenario 5: batch -> art -> merge -> batch ===");
    console.log("mergePos:", mergePos);
    console.log("batchPos:", batchPos);
    expect(mergePos).toBeDefined();
    expect(batchPos).toBeDefined();
    // audioMerge feeds into batch, so it MUST be strictly to the left of batchVoiceClone (Figure 2)!
    expect(mergePos.x + 340).toBeLessThanOrEqual(batchPos.x);
  });

  it("Scenario 6: Real board test with VO_JQ0045 and audioMerge", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const safeData = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../workspaces_backup_safe.json"), "utf-8"));
    const ws = safeData.workspaces.find((w: any) => w.nodes.some((n: any) => n.data && n.data.title === "VO_JQ0045_DaYu"));

    const layoutInputNodes = ws.nodes.map((n: any) => ({
      id: n.id,
      type: n.type,
      width: n.measured?.width || 340,
      height: n.measured?.height || 220,
      originalX: n.position.x,
      originalY: n.position.y,
      seqIndex: n.data?.seqIndex
    }));

    const layoutInputEdges = ws.edges.map((e: any) => ({
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle
    }));

    const res = computeSmartDagLayout(layoutInputNodes, layoutInputEdges, 80, 80);
    const mergeNode = ws.nodes.find((n: any) => n.type === "audioMerge" && n.id.includes("xg4znr"));
    const batchNode = ws.nodes.find((n: any) => n.type === "batchVoiceClone" && n.id.includes("37yevo"));

    const origMergePos = res.get(mergeNode.id)!;
    const origBatchPos = res.get(batchNode.id)!;
    expect(origMergePos).toBeDefined();
    expect(origBatchPos).toBeDefined();
    // audioMerge feeds into batchVoiceClone, so it must be to the left of batchVoiceClone
    expect(origMergePos.x + 340).toBeLessThanOrEqual(origBatchPos.x);

    // Now test user's current situation: inEdges to audioMerge are deleted or unlinked (Figure 2)
    const userEdges = layoutInputEdges.filter((e: any) => e.target !== mergeNode.id);
    const resUser = computeSmartDagLayout(layoutInputNodes, userEdges, 80, 80);

    const userMergePos = resUser.get(mergeNode.id)!;
    const userBatchPos = resUser.get(batchNode.id)!;
    expect(userMergePos).toBeDefined();
    expect(userBatchPos).toBeDefined();
    // audioMerge is strictly the 1st root input column (Figure 2)!
    expect(userMergePos.x + 340).toBeLessThanOrEqual(userBatchPos.x);
  });
});
