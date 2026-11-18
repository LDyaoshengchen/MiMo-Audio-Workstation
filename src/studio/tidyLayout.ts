import type { StudioNode, StudioEdge } from "../types/studio";
import { computeSmartDagLayout, type LayoutNodeInput, type LayoutEdgeInput } from "../utils/layout";
import { getStudioNodeSize } from "./artifactPlacement";

export interface TidyLayoutResult {
  nextNodes: StudioNode[];
  isSelectionMode: boolean;
}

/**
 * 计算画板节点的规整排版（支持全部排版或针对多选节点排版）
 */
export function computeTidyLayout(
  allNodes: StudioNode[],
  allEdges: StudioEdge[],
  onlySelected?: boolean
): TidyLayoutResult | null {
  if (!allNodes || allNodes.length === 0) return null;

  // 检查用户是否多选了节点
  const selectedNodesList = allNodes.filter((n) => n.selected);
  const isSelectionMode =
    (onlySelected === true || (selectedNodesList.length >= 2 && onlySelected !== false)) &&
    selectedNodesList.length < allNodes.length;

  const targetNodes = isSelectionMode ? selectedNodesList : allNodes;
  const targetNodeIds = new Set(targetNodes.map((n) => n.id));
  const targetEdges = allEdges.filter((e) => targetNodeIds.has(e.source) && targetNodeIds.has(e.target));

  const originBaseX = isSelectionMode ? Math.min(...targetNodes.map((n) => n.position.x)) : 80;
  const originBaseY = isSelectionMode ? Math.min(...targetNodes.map((n) => n.position.y)) : 80;

  const layoutInputNodes: LayoutNodeInput[] = targetNodes.map((n) => {
    let seqIndex = n.data.seqIndex;
    if (n.type === "batchArtifact" && (seqIndex === undefined || seqIndex === null)) {
      const incomingEdge = allEdges.find(
        (e) => e.target === n.id && (e.targetHandle === "artifact" || !e.targetHandle)
      );
      const parentNode = incomingEdge ? allNodes.find((p) => p.id === incomingEdge.source) : undefined;
      if (n.data.batchRowId && parentNode?.data.batchRows) {
        const rIdx = parentNode.data.batchRows.findIndex((r) => r.id === n.data.batchRowId);
        if (rIdx >= 0) {
          seqIndex = rIdx + 1;
        }
      }
      if (seqIndex === undefined && n.data.title) {
        const m = n.data.title.match(/句段\s*(\d+)/i);
        if (m) seqIndex = parseInt(m[1], 10);
      }
      if (seqIndex === undefined && n.data.batchArtifacts && n.data.batchArtifacts.length > 0) {
        for (const item of n.data.batchArtifacts) {
          const m = item.rowTitle?.match(/句段\s*(\d+)/i);
          if (m) {
            seqIndex = parseInt(m[1], 10);
            break;
          }
        }
      }
    }

    return {
      id: n.id,
      type: n.type || "default",
      width: getStudioNodeSize(n).width,
      height: getStudioNodeSize(n).height,
      originalX: n.position.x,
      originalY: n.position.y,
      seqIndex,
      title: n.data.title,
      batchRowId: n.data.batchRowId,
      batchRows: n.data.batchRows,
      batchArtifacts: n.data.batchArtifacts
    };
  });

  const layoutInputEdges: LayoutEdgeInput[] = targetEdges.map((e) => ({
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
    targetHandle: e.targetHandle
  }));

  const nodePositions = computeSmartDagLayout(layoutInputNodes, layoutInputEdges, originBaseX, originBaseY);

  const nextNodes = allNodes.map((node) => {
    if (nodePositions.has(node.id)) {
      return {
        ...node,
        position: nodePositions.get(node.id)!
      };
    }
    return node;
  });

  return { nextNodes, isSelectionMode };
}
