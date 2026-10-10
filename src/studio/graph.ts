import type { AudioAsset } from "../types/studioAudio";
import type { StudioNode, StudioEdge, DebugResponse } from "../types/studio";
import { createId } from "./format";
import { getAudioFileExtension } from "../utils/audioNaming";
import { guessMimeFromName, dataUrlToUint8Array } from "./audio";

export function ensureArtifactSeqIndexes(node: StudioNode, allNodes?: StudioNode[], allEdges?: StudioEdge[]): StudioNode {
  let nodeMutated = false;

  // 兼容旧的自动命名，仅清理单个产物节点的固定后缀，保留来源和序号。
  if (node.type === "artifact" && node.data.title) {
    const title = node.data.title.replace(/_产物_(\d+)$/, "_$1");
    if (title !== node.data.title) {
      node = {
        ...node,
        data: {
          ...node.data,
          title,
          ...(node.data.artifact ? { artifact: { ...node.data.artifact, sourceNodeName: title } } : {})
        }
      };
    }
  }

  if (node.type === "batchArtifact" && allNodes && allEdges) {
    const parentEdge = allEdges.find((e) => e.target === node.id);
    if (parentEdge) {
      const parentNode = allNodes.find((n) => n.id === parentEdge.source);
      if (parentNode && parentNode.data.title && node.data.parentTitle !== parentNode.data.title) {
        nodeMutated = true;
        node = {
          ...node,
          data: {
            ...node.data,
            parentTitle: parentNode.data.title
          }
        };
      }
    }
  }

  if (node.type === "integratedStudio" && node.data.batchRows) {
    const updatedRows = node.data.batchRows.map((row) => {
      if (!row.artifacts || row.artifacts.length === 0) return row;
      let rowMutated = false;
      const updatedArtifacts = row.artifacts.map((art, idx) => {
        if (art.seqIndex === undefined) {
          rowMutated = true;
          nodeMutated = true;
          return { ...art, seqIndex: idx + 1 };
        }
        return art;
      });
      return rowMutated ? { ...row, artifacts: updatedArtifacts } : row;
    });
    if (nodeMutated) {
      return { ...node, data: { ...node.data, batchRows: updatedRows } };
    }
  }

  if (node.type === "batchArtifact" && node.data.batchArtifacts) {
    const updatedList = node.data.batchArtifacts.map((item, idx) => {
      if (item.seqIndex === undefined) {
        nodeMutated = true;
        return { ...item, seqIndex: idx + 1 };
      }
      return item;
    });
    if (nodeMutated) {
      return { ...node, data: { ...node.data, batchArtifacts: updatedList } };
    }
  }

  return node;
}

export function extractAudioAssetFromNode(node?: StudioNode): AudioAsset | undefined {
  if (!node) return undefined;

  if (node.data.audio) {
    return node.data.audio;
  }
  if (node.data.audioAssets && node.data.audioAssets.length > 0) {
    return node.data.audioAssets[0];
  }

  if (node.data.artifact) {
    const artifact = node.data.artifact;
    return {
      fileName: artifact.fileName,
      mimeType: guessMimeFromName(artifact.fileName),
      size: dataUrlToUint8Array(artifact.audioDataUrl).byteLength,
      dataUrl: artifact.audioDataUrl
    };
  }

  if (node.data.batchArtifacts && node.data.batchArtifacts.length > 0) {
    const lastItem = node.data.batchArtifacts[node.data.batchArtifacts.length - 1];
    return {
      fileName: lastItem.fileName,
      mimeType: guessMimeFromName(lastItem.fileName),
      size: dataUrlToUint8Array(lastItem.audioDataUrl).byteLength,
      dataUrl: lastItem.audioDataUrl
    };
  }

  return undefined;
}

export function resolveCloneInputs(cloneNode: StudioNode, nodes: StudioNode[], edges: StudioEdge[]) {
  const incoming = edges.filter((edge) => edge.target === cloneNode.id);
  const getSources = (targetHandle?: string) => {
    return incoming
      .filter((item) => !targetHandle || item.targetHandle === targetHandle)
      .map((item) => nodes.find((node) => node.id === item.source))
      .filter((n): n is StudioNode => Boolean(n));
  };

  // 1. 优先从连接到 voice 的上游节点中获取第一个有有效音频数据的节点（自动跳过空参考音频节点）
  const voiceSources = getSources("voice");
  let voiceAudio: AudioAsset | undefined;
  for (const src of voiceSources) {
    const asset = extractAudioAssetFromNode(src);
    if (asset && asset.dataUrl) {
      voiceAudio = asset;
      break;
    }
  }

  // 2. 如果 voice 未找到有效音频，从所有已连接到当前节点的上游节点（产物节点、参考节点等）自动寻找有效音频
  if (!voiceAudio) {
    const allSources = getSources();
    for (const src of allSources) {
      const asset = extractAudioAssetFromNode(src);
      if (asset && asset.dataUrl) {
        voiceAudio = asset;
        break;
      }
    }
  }

  // 3. 提取 instruction (风格)
  const instructionSources = getSources("instruction");
  let instructionText = "";
  for (const src of instructionSources) {
    if (src.data.text?.trim()) {
      instructionText = src.data.text.trim();
      break;
    }
  }

  // 4. 提取 text (台词)
  const textSources = getSources("text");
  let text = "";
  for (const src of textSources) {
    if (src.data.text?.trim()) {
      text = src.data.text.trim();
      break;
    }
  }

  return {
    audio: voiceAudio ?? cloneNode.data.audio,
    instruction: instructionText || (cloneNode.data.instruction ?? ""),
    text: text || (cloneNode.data.text ?? "")
  };
}

export function resolveGameVocalInputs(
  vocalNode: StudioNode,
  nodes: StudioNode[],
  edges: StudioEdge[]
): {
  audio?: AudioAsset;
  sourceTitle?: string;
  sourceNodeType?: string;
  instruction?: string;
} {
  const incoming = edges.filter((edge) => edge.target === vocalNode.id);
  const getSources = (targetHandle?: string) => {
    return incoming
      .filter((item) => !targetHandle || item.targetHandle === targetHandle)
      .map((item) => nodes.find((node) => node.id === item.source))
      .filter((n): n is StudioNode => Boolean(n));
  };

  // 1. 优先从连接到 voice 的上游节点寻找音频
  let voiceAudio: AudioAsset | undefined;
  let sourceTitle: string | undefined;
  let sourceNodeType: string | undefined;

  const voiceSources = getSources("voice");
  for (const src of voiceSources) {
    const asset = extractAudioAssetFromNode(src);
    if (asset && asset.dataUrl) {
      voiceAudio = asset;
      sourceTitle = src.data.title || src.type;
      sourceNodeType = src.type;
      break;
    }
  }

  // 2. 如果未指定 targetHandle="voice"，从所有连接到当前节点的上游节点（自动排除纯文本节点）寻找有效音频
  if (!voiceAudio) {
    const allSources = getSources();
    for (const src of allSources) {
      if (src.type === "voiceStyle" || src.type === "prompt") continue;
      const asset = extractAudioAssetFromNode(src);
      if (asset && asset.dataUrl) {
        voiceAudio = asset;
        sourceTitle = src.data.title || src.type;
        sourceNodeType = src.type;
        break;
      }
    }
  }

  // 3. 提取 instruction (连接至 instruction 或 style)
  const instructionSources = getSources("instruction").concat(getSources("style"));
  let instructionText = "";
  for (const src of instructionSources) {
    if (src.data.text?.trim()) {
      instructionText = src.data.text.trim();
      break;
    }
  }

  return {
    audio: voiceAudio ?? vocalNode.data.audio,
    sourceTitle,
    sourceNodeType,
    instruction: instructionText || vocalNode.data.instruction || ""
  };
}

export function resolveMergeAudioInputs(mergeNode: StudioNode, nodes: StudioNode[], edges: StudioEdge[]): AudioAsset[] {
  return edges
    .filter((edge) => edge.target === mergeNode.id && edge.targetHandle === "audio")
    .flatMap((edge) => {
      const source = nodes.find((node) => node.id === edge.source);
      if (!source) return [];
      if (source.type === "referenceAudio") return source.data.audioAssets ?? (source.data.audio ? [source.data.audio] : []);
      const asset = extractAudioAssetFromNode(source);
      return asset ? [asset] : [];
    });
}

export function resolveCloneTextInputs(cloneNode: StudioNode, nodes: StudioNode[], edges: StudioEdge[]) {
  return edges
    .filter((edge) => edge.target === cloneNode.id && edge.targetHandle === "text")
    .map((edge) => nodes.find((node) => node.id === edge.source && node.type === "prompt"))
    .filter((node): node is StudioNode => Boolean(node))
    .map((node) => ({
      title: node.data.title,
      text: String(node.data.text || "")
    }));
}

export function resolveVoiceDesignInputs(designNode: StudioNode, nodes: StudioNode[], edges: StudioEdge[]) {
  return edges
    .filter((edge) => edge.target === designNode.id && edge.targetHandle === "text")
    .map((edge) => nodes.find((node) => node.id === edge.source && node.type === "prompt"))
    .filter((node): node is StudioNode => Boolean(node))
    .map((node) => ({
      title: node.data.title,
      text: String(node.data.text || "")
    }));
}

export function resolveVoiceDesignInstructionInputs(designNode: StudioNode, nodes: StudioNode[], edges: StudioEdge[]) {
  return edges
    .filter((edge) => edge.target === designNode.id && (edge.targetHandle === "instruction" || edge.targetHandle === "style"))
    .map((edge) => nodes.find((node) => node.id === edge.source && (node.type === "voiceStyle" || node.type === "prompt")))
    .filter((node): node is StudioNode => Boolean(node))
    .map((node) => String(node.data.instruction || node.data.text || "").trim())
    .filter(Boolean);
}

export function createArtifactNode(
  sourceNode: StudioNode,
  result: DebugResponse,
  _title?: string,
  index: number = 0,
  currentNodes?: StudioNode[],
  currentEdges?: StudioEdge[]
): StudioNode {
  const rawTitle = sourceNode.data.title?.trim();
  const defaultTitle = sourceNode.type === "voiceDesign" ? "音色设计" : sourceNode.type === "gameVocal" ? "游戏语气词" : "音频克隆";
  const sourceTitle = (rawTitle && rawTitle !== "节点名称") ? rawTitle : defaultTitle;

  let initialMaxSeq = 0;
  if (currentNodes && currentEdges) {
    const downstreamArtifactNodes = currentNodes.filter(
      (n) => n.type === "artifact" && currentEdges.some((e) => e.source === sourceNode.id && e.target === n.id)
    );
    downstreamArtifactNodes.forEach((n) => {
      if (n.data.seqIndex) {
        initialMaxSeq = Math.max(initialMaxSeq, n.data.seqIndex);
      } else if (n.data.title) {
        const match = n.data.title.match(/_(\d+)$/);
        if (match) {
          initialMaxSeq = Math.max(initialMaxSeq, parseInt(match[1], 10));
        }
      }
    });
  }

  const seqNum = initialMaxSeq + index + 1;

  const itemIndexStr = String(seqNum).padStart(2, "0");
  const detailTitle = _title?.trim();
  const baseTitle = detailTitle && detailTitle !== sourceTitle && detailTitle !== "产物" ? `${sourceTitle}_${detailTitle}` : sourceTitle;
  const artifactTitle = `${baseTitle}_${itemIndexStr}`.replace(/_产物_(\d+)$/, "_$1");
  const artifactFileName = `${artifactTitle}${getAudioFileExtension(result.audioDataUrl, result.fileName)}`;

  const nodeWidth = (sourceNode.type === "gameVocal" || sourceNode.type === "batchVoiceClone" || sourceNode.type === "integratedStudio") ? 660 : 360;
  const col = (seqNum - 1) % 3;
  const rowPos = Math.floor((seqNum - 1) / 3);
  const stepX = 400;
  const stepY = 205;
  const startX = sourceNode.position.x + nodeWidth + 60;

  return {
    id: createId("artifact"),
    type: "artifact",
    position: {
      x: startX + col * stepX,
      y: sourceNode.position.y + rowPos * stepY
    },
    data: {
      title: artifactTitle,
      seqIndex: seqNum,
      artifact: {
        fileName: artifactFileName,
        audioDataUrl: result.audioDataUrl,
        elapsedMs: result.elapsedMs,
        createdAt: new Date().toISOString(),
        sourceNodeName: artifactTitle,
        sourceNodeId: sourceNode.id
      }
    }
  };
}

export function stripNodeCallbacks(node: StudioNode): StudioNode {
  const { workspaceName, singleDownloadSettings, stashedArtifactKeys, onPatch, onDelete, onRunClone, onRunVoiceDesign, onRunAudioMerge, onOptimizeStyle, onOptimizeVoiceDesign, onStashArtifact, onToggleStashArtifact, isArtifactStashed, ...data } = node.data;
  return { ...node, data };
}
