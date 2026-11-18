import type { AudioAsset } from "../types/studioAudio";
import type { StudioEdge, StudioNode } from "../types/studio";
import { resolveMergeAudioInputs } from "./graph";

/** Finds reference-audio merges whose current upstream asset objects changed. */
export function getReferenceAudioAutoMergeNodeIds(
  nodes: StudioNode[],
  edges: StudioEdge[],
  previousInputsByNode: Map<string, AudioAsset[]>
): string[] {
  const nodesById = new Map(nodes.map(node => [node.id, node]));
  const mergeIds = new Set<string>();
  const changedIds: string[] = [];

  for (const mergeNode of nodes) {
    if (mergeNode.type !== "audioMerge") continue;
    mergeIds.add(mergeNode.id);
    const hasReferenceInput = edges.some(edge => edge.target === mergeNode.id && edge.targetHandle === "audio" && nodesById.get(edge.source)?.type === "referenceAudio");
    if (!hasReferenceInput) {
      previousInputsByNode.delete(mergeNode.id);
      continue;
    }

    const inputs = resolveMergeAudioInputs(mergeNode, nodes, edges);
    const previousInputs = previousInputsByNode.get(mergeNode.id);
    const inputsChanged = previousInputs !== undefined && (previousInputs.length !== inputs.length || inputs.some((asset, index) => asset !== previousInputs[index]));
    const needsInitialMerge = previousInputs === undefined && inputs.length > 0 && !mergeNode.data.audio;
    previousInputsByNode.set(mergeNode.id, inputs);
    if (inputs.length > 0 && (inputsChanged || needsInitialMerge)) changedIds.push(mergeNode.id);
  }

  for (const mergeId of previousInputsByNode.keys()) {
    if (!mergeIds.has(mergeId)) previousInputsByNode.delete(mergeId);
  }
  return changedIds;
}
