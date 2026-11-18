import type { ArtifactData } from "../types/studioAudio";
import type { StudioNode, StashItem } from "../types/studio";
import type { SingleDownloadSettings } from "../utils/downloadSettings";
import { formatHierarchyName } from "../utils/audioNaming";
import { getSingleArtifactDownloadFileName } from "../utils/downloadSettings";

export function matchesStashedArtifact(item: ArtifactData, artifact: ArtifactData): boolean {
  if (item.sourceNodeId && artifact.sourceNodeId) {
    if (item.sourceNodeId !== artifact.sourceNodeId || item.sourceRowId !== artifact.sourceRowId) return false;
    if (item.createdAt && artifact.createdAt) return item.createdAt === artifact.createdAt;
  }
  return item.fileName === artifact.fileName && item.audioDataUrl === artifact.audioDataUrl;
}

export function resolveStashDownloadName(
  item: StashItem,
  nodes: StudioNode[],
  batchDownloadSettings: SingleDownloadSettings,
  workspaceName?: string
): string {
  let title = item.sourceNodeName || item.fileName;
  const source = nodes.find((node) => node.id === item.sourceNodeId);
  if (batchDownloadSettings.includeBatchNodeName === false && source?.type === "batchArtifact") {
    const entry = source.data.batchArtifacts?.find((entry) => entry.createdAt === item.createdAt && item.createdAt);
    const sequence = entry?.seqIndex ?? Number(title.match(/_(\d+)(?:\.[^.]+)?$/)?.[1]);
    const rowTitle = entry?.rowTitle && !/^句段\s*\d+$/i.test(entry.rowTitle) ? entry.rowTitle : undefined;
    if (sequence > 0) title = formatHierarchyName(source.data.parentTitle, rowTitle, sequence);
  }
  return getSingleArtifactDownloadFileName(title, item.fileName, workspaceName, item.createdAt, batchDownloadSettings);
}
