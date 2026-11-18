import { expect, it } from "vitest";
import type { StudioNode, StudioEdge } from "../src/types/studio";
import { findArtifactPosition, getStudioNodeSize } from "../src/studio/artifactPlacement";
import { createArtifactNode } from "../src/studio/graph";

const source = (type: StudioNode["type"] = "voiceClone"): StudioNode => ({ id: "source", type, position: { x: 80, y: 80 }, data: { title: "角色" } });
const artifact = (id: string, seqIndex: number, x: number, y: number): StudioNode => ({ id, type: "artifact", position: { x, y }, data: { title: `角色_${seqIndex}`, seqIndex } });
const edges = (...ids: string[]): StudioEdge[] => ids.map(id => ({ id: `edge-${id}`, source: "source", target: id, targetHandle: "artifact" }));

it("fills the first physically empty slot without deriving layout from filename sequence", () => {
  const nodes = [source(), artifact("one", 9, 500, 80), artifact("three", 22, 1300, 80)];
  expect(findArtifactPosition(nodes[0], nodes, edges("one", "three"))).toEqual({ x: 900, y: 80 });
  const created = createArtifactNode(nodes[0], { fileName: "x.wav", audioDataUrl: "data:audio/wav;base64,AAAA", elapsedMs: 1 }, undefined, 0, nodes, edges("one", "three"));
  expect(created.data.title).toBe("角色_23"); expect(created.position).toEqual({ x: 900, y: 80 });
  expect(findArtifactPosition(nodes[0], nodes.filter(node => node.id !== "one"), edges("three"))).toEqual({ x: 500, y: 80 });
});

it("uses the live source and its measured width instead of the job-start object", () => {
  const old = source(), live = { ...old, position: { x: 1800, y: 700 }, measured: { width: 720, height: 400 } };
  expect(findArtifactPosition(old, [live], [])).toEqual({ x: 2580, y: 700 });
  expect(getStudioNodeSize({ ...old, width: 600 })).toMatchObject({ width: 600 });
});

it("avoids unrelated nodes and manually moved result cards without rearranging them", () => {
  const obstacle: StudioNode = { id: "other", type: "comment", position: { x: 500, y: 80 }, measured: { width: 340, height: 200 }, data: {} };
  const moved = artifact("moved", 1, 920, 80), nodes = [source(), obstacle, moved];
  const before = JSON.stringify(nodes);
  expect(findArtifactPosition(nodes[0], nodes, edges("moved"))).toEqual({ x: 1300, y: 80 });
  expect(JSON.stringify(nodes)).toBe(before);
});

it("keeps game-vocal and batch outputs on the same grid used by tidy", () => {
  const game = source("gameVocal"), nodes = [game, artifact("one", 1, 800, 80), artifact("two", 2, 1300, 80), artifact("three", 3, 1800, 80)];
  expect(findArtifactPosition(game, nodes, edges("one", "two", "three"))).toEqual({ x: 800, y: 580 });
  const batch = source("batchVoiceDesign");
  expect(findArtifactPosition(batch, [batch], [], "batchArtifact")).toEqual({ x: 1020, y: 80 });
});

it("reserves actual tall/wide result cards and falls below extremely large obstacles", () => {
  const batch = source("batchVoiceDesign");
  const existing: StudioNode = { id: "one", type: "batchArtifact", position: { x: 1020, y: 80 }, measured: { width: 600, height: 900 }, data: {} };
  expect(findArtifactPosition(batch, [batch, existing], edges("one"), "batchArtifact")).toEqual({ x: 2020, y: 80 });
  const obstacle: StudioNode = { id: "large", type: "comment", position: { x: 500, y: 0 }, measured: { width: 2000, height: 50000 }, data: {} };
  expect(findArtifactPosition(source(), [source(), obstacle], [])).toEqual({ x: 500, y: 50060 });
});

it("keeps a running job's minimum sequence when earlier or latest outputs have been deleted", () => {
  const nodes = [source(), artifact("one", 5, 500, 80)];
  const created = createArtifactNode(nodes[0], { fileName: "x.wav", audioDataUrl: "data:audio/wav;base64,AAAA", elapsedMs: 1 }, undefined, 0, nodes, edges("one"), 12);
  expect(created.data.seqIndex).toBe(12); expect(created.position).toEqual({ x: 900, y: 80 });
});
