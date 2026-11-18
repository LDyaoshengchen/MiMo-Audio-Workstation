import { expect, it } from "vitest";
import type { StudioEdge, StudioNode } from "../src/types/studio";
import type { AudioAsset } from "../src/types/studioAudio";
import { getReferenceAudioAutoMergeNodeIds } from "../src/studio/autoMerge";

const audio = (name: string): AudioAsset => ({ fileName: name, mimeType: "audio/wav", size: 3, dataUrl: `data:audio/wav;base64,${name}` });
const reference = (assets: AudioAsset[]): StudioNode => ({
  id: "reference", type: "referenceAudio", position: { x: 0, y: 0 }, data: { audioAssets: assets, audio: assets[0] }
} as StudioNode);
const merge = (output?: AudioAsset): StudioNode => ({
  id: "merge", type: "audioMerge", position: { x: 100, y: 0 }, data: { audio: output }
} as StudioNode);
const link: StudioEdge = { id: "edge", source: "reference", sourceHandle: "output", target: "merge", targetHandle: "audio" };

it("auto-merges a connected reference on first use when there is no output, then only after input changes", () => {
  const first = audio("first.wav"), snapshots = new Map<string, AudioAsset[]>();
  const nodes = [reference([first]), merge()];
  expect(getReferenceAudioAutoMergeNodeIds(nodes, [link], snapshots)).toEqual(["merge"]);
  expect(getReferenceAudioAutoMergeNodeIds(nodes, [link], snapshots)).toEqual([]);

  const updated = audio("updated.wav"), changedNodes = [reference([updated]), merge()];
  expect(getReferenceAudioAutoMergeNodeIds(changedNodes, [link], snapshots)).toEqual(["merge"]);
  expect(getReferenceAudioAutoMergeNodeIds(changedNodes, [link], snapshots)).toEqual([]);
});

it("does not regenerate an existing merge on load and drops snapshots when the reference link is removed", () => {
  const input = audio("input.wav"), output = audio("merged.wav"), snapshots = new Map<string, AudioAsset[]>();
  const nodes = [reference([input]), merge(output)];
  expect(getReferenceAudioAutoMergeNodeIds(nodes, [link], snapshots)).toEqual([]);
  expect(snapshots.has("merge")).toBe(true);
  expect(getReferenceAudioAutoMergeNodeIds(nodes, [], snapshots)).toEqual([]);
  expect(snapshots.has("merge")).toBe(false);
});
