import type { RefObject, Dispatch, SetStateAction } from "react";
import type { IntegratedRowArtifact, BatchArtifactItem } from "../types/studioAudio";
import type { ProviderOptions } from "../utils/providerConfig";
import type { WorkspacePayload, StudioNode, StudioEdge, NodeData, DebugResponse, StyleOptimizeResponse } from "../types/studio";
import { NODE_COLOR_MAP, maxAudioBytes } from "./config";
import { buildOptimizedGameVocalPrompt } from "../utils/gameVocalOptimizer";
import { buildVoiceDescriptionFromTags } from "../utils/gameVocalCharacterTags";
import { createId, formatBytes } from "./format";
import { formatOptimizationError } from "./optimizationErrors";
import { getAudioFileExtension } from "../utils/audioNaming";
import { mergeAudioAssets, trimVocalAudioDataUrl } from "./audio";
import { appendSynthesisInputs } from "../utils/providerConfig";
import { resolveMergeAudioInputs, resolveCloneInputs, resolveCloneTextInputs, createArtifactNode, resolveVoiceDesignInstructionInputs, resolveVoiceDesignInputs, resolveGameVocalInputs } from "./graph";

export interface SynthesisActionsContext {
  nodesRef: RefObject<StudioNode[]>;
  edgesRef: RefObject<StudioEdge[]>;
  patchNode: (nodeId: string, patch: Partial<NodeData>) => void;
  setNodes: Dispatch<SetStateAction<StudioNode[]>>;
  saveWorkspace: (overrideNodes?: StudioNode[], overrideEdges?: StudioEdge[], overrideWorkspace?: WorkspacePayload) => Promise<void>;
  isAnyApiKeyReady: () => boolean;
  providerOptionsRef: RefObject<ProviderOptions>;
  getApiHeaders: (isJson?: boolean, extraHeaders?: Record<string, string>) => Record<string, string>;
  setEdges: Dispatch<SetStateAction<StudioEdge[]>>;
  activeWorkspace: WorkspacePayload | null;
  vocalAbortMapRef: RefObject<Record<string, boolean>>;
}

// Read controller dependencies on invocation, never during render initialization.
export function createSynthesisActions(getContext: () => SynthesisActionsContext) {
  async function runAudioMerge(nodeId: string) {
    const { nodesRef, edgesRef, patchNode, setNodes, saveWorkspace } = getContext();
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;
    const mergeNode = currentNodes.find((node) => node.id === nodeId);
    if (!mergeNode || mergeNode.type !== "audioMerge") return;
    const audioAssets = resolveMergeAudioInputs(mergeNode, currentNodes, currentEdges);
    if (audioAssets.length === 0) {
      patchNode(nodeId, { error: "请连接至少一个参考音频、音频产物或整合节点。" });
      return;
    }
    patchNode(nodeId, { isRunning: true, error: undefined });
    try {
      const audio = await mergeAudioAssets(audioAssets);
      if (audio.size > maxAudioBytes) {
        throw new Error(`整合后的音频超过 ${formatBytes(maxAudioBytes)}，请减少输入音频或缩短时长。`);
      }
      const nextNodes = nodesRef.current.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, audio, isRunning: false, error: undefined } } : n));
      nodesRef.current = nextNodes;
      setNodes(nextNodes);
      void saveWorkspace(nextNodes);
    } catch (error) {
      patchNode(nodeId, { isRunning: false, error: error instanceof Error ? error.message : "参考音频整合失败。" });
    }
  }

  async function runVoiceClone(nodeId: string, count: number = 1) {
    const { nodesRef, edgesRef, isAnyApiKeyReady, patchNode, providerOptionsRef, getApiHeaders, setNodes, setEdges, saveWorkspace } = getContext();
    const initialNodes = [...nodesRef.current];
    const initialEdges = [...edgesRef.current];
    const cloneNode = initialNodes.find((node) => node.id === nodeId);
    if (!cloneNode || cloneNode.type !== "voiceClone") {
      return;
    }

    if (!isAnyApiKeyReady()) {
      patchNode(nodeId, { error: "API Key 未配置，请点击顶部 API Key 区域配置。" });
      return;
    }

    const resolved = resolveCloneInputs(cloneNode, initialNodes, initialEdges);
    if (providerOptionsRef.current.synthesisMode === "reference" && !resolved.audio?.dataUrl) {
      patchNode(nodeId, { error: "缺少参考音频，请连接参考音频节点或在节点中上传。" });
      return;
    }

    const textItems = resolveCloneTextInputs(cloneNode, initialNodes, initialEdges);
    const cloneTexts = textItems.length > 0 ? textItems : [{ title: cloneNode.data.title, text: resolved.text }];

    const validTextItems = cloneTexts.filter((entry) => entry.text.trim());
    if (validTextItems.length === 0) {
      patchNode(nodeId, { error: "缺少音频文本，请连接提示词节点到「文本」输入或在节点中填写。" });
      return;
    }

    patchNode(nodeId, { isRunning: true, error: undefined });

    try {
      const totalRuns = count > 1 ? count : validTextItems.length;
      const newArtifactNodes: StudioNode[] = [];
      const newArtifactEdges: StudioEdge[] = [];

      for (let runIdx = 0; runIdx < totalRuns; runIdx++) {
        const item = validTextItems[runIdx % validTextItems.length];
        const formData = new FormData();
        await appendSynthesisInputs(formData, providerOptionsRef.current, resolved.audio);
        formData.append("text", item.text.trim());
        formData.append("instruction", resolved.instruction.trim());
        formData.append("format", "wav");
        formData.append("title", cloneNode.data.title?.trim() || "音频克隆");

        const response = await fetch("/api/tts/voiceclone", {
          method: "POST",
          headers: getApiHeaders(false),
          body: formData
        });
        const payload = (await response.json()) as DebugResponse & { error?: string; details?: unknown };

        if (!response.ok) {
          patchNode(nodeId, { isRunning: false, error: payload.error || `第 ${runIdx + 1} 条音频克隆失败。` });
          return;
        }

        const artifactNode = createArtifactNode(cloneNode, payload, item.title, runIdx, initialNodes, initialEdges);
        const artifactEdge: StudioEdge = {
          id: createId("edge"),
          source: cloneNode.id,
          sourceHandle: "output",
          target: artifactNode.id,
          targetHandle: "artifact",
          type: "deletable",
          animated: true,
          style: { stroke: "#facc15", strokeWidth: 2 }
        };

        newArtifactNodes.push(artifactNode);
        newArtifactEdges.push(artifactEdge);
      }

      const nextNodes = nodesRef.current.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, isRunning: false, error: undefined } } : n)).concat(newArtifactNodes);
      const nextEdges = edgesRef.current.concat(newArtifactEdges);
      nodesRef.current = nextNodes;
      edgesRef.current = nextEdges;
      setNodes(nextNodes);
      setEdges(nextEdges);
      void saveWorkspace(nextNodes, nextEdges);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "请求失败。";
      patchNode(nodeId, {
        isRunning: false,
        error: msg.includes("Failed to fetch") ? "网络连接异常 (Failed to fetch)。请检查后端服务运行状态。" : msg
      });
    }
  }

  function deleteBatchArtifactItem(nodeId: string, itemId: string) {
    const { nodesRef, setNodes, saveWorkspace } = getContext();
    const nextNodes = nodesRef.current.map((node) => {
      if (node.id === nodeId && node.data.batchArtifacts) {
        return {
          ...node,
          data: {
            ...node.data,
            batchArtifacts: node.data.batchArtifacts.filter((item) => item.id !== itemId)
          }
        };
      }
      return node;
    });
    nodesRef.current = nextNodes;
    setNodes(nextNodes);
    void saveWorkspace(nextNodes);
  }

  function deleteIntegratedArtifactItem(nodeId: string, rowId: string, itemId: string) {
    const { nodesRef, setNodes, saveWorkspace } = getContext();
    const nextNodes = nodesRef.current.map((node) => {
      if (node.id === nodeId && node.data.batchRows) {
        const updatedRows = node.data.batchRows.map((r) => {
          if (r.id !== rowId) return r;
          return {
            ...r,
            artifacts: (r.artifacts || []).filter((item) => item.id !== itemId)
          };
        });
        return {
          ...node,
          data: {
            ...node.data,
            batchRows: updatedRows
          }
        };
      }
      return node;
    });
    nodesRef.current = nextNodes;
    setNodes(nextNodes);
    void saveWorkspace(nextNodes);
  }

  async function runIntegratedBatch(nodeId: string) {
    const { nodesRef, isAnyApiKeyReady, patchNode, edgesRef, providerOptionsRef, getApiHeaders, setNodes, saveWorkspace } = getContext();
    const currentNodes = nodesRef.current;
    const node = currentNodes.find((n) => n.id === nodeId);
    if (!node || node.type !== "integratedStudio") return;

    if (!isAnyApiKeyReady()) {
      patchNode(nodeId, { error: "API Key 未配置，请点击顶部 API Key 区域配置。" });
      return;
    }

    const rows = node.data.batchRows || [];
    const validRows = rows.filter((r) => r.text.trim());
    if (validRows.length === 0) {
      patchNode(nodeId, { error: "请至少填写一行的音频文本。" });
      return;
    }

    patchNode(nodeId, { isRunning: true, error: undefined });

    try {
      let updatedRows = [...rows];

      for (const [index, row] of validRows.entries()) {
        patchNode(nodeId, { singleRunningRowId: row.id });

        let refAudioDataUrl = row.refAudioUrl || node.data.refAudioUrl;
        let refAudioFileName = row.refAudioName || node.data.refAudioName || "ref.wav";
        let refAudioMimeType = "audio/wav";

        if (!refAudioDataUrl) {
          const resolved = resolveCloneInputs(node, currentNodes, edgesRef.current);
          if (resolved.audio) {
            refAudioDataUrl = resolved.audio.dataUrl;
            refAudioFileName = resolved.audio.fileName;
            refAudioMimeType = resolved.audio.mimeType;
          }
        }

        if (providerOptionsRef.current.synthesisMode === "reference" && !refAudioDataUrl) {
          patchNode(nodeId, { isRunning: false, singleRunningRowId: undefined, error: `行「${row.title || `句段 ${index + 1}`}」缺少参考音频！请在第1列上传/录制参考音频。` });
          return;
        }

        const formData = new FormData();
        await appendSynthesisInputs(formData, providerOptionsRef.current, refAudioDataUrl ? { dataUrl: refAudioDataUrl, fileName: refAudioFileName, mimeType: refAudioMimeType } : undefined);
        formData.append("text", row.text.trim());
        formData.append("instruction", (row.instruction || row.voiceStyle || "").trim());
        formData.append("format", "wav");

        const response = await fetch("/api/tts/voiceclone", {
          method: "POST",
          headers: getApiHeaders(false),
          body: formData
        });

        const payload = (await response.json()) as DebugResponse & { error?: string };

        if (!response.ok) {
          patchNode(nodeId, { isRunning: false, singleRunningRowId: undefined, error: payload.error || `行「${row.title || `句段 ${index + 1}`}」生成失败。` });
          return;
        }

        const currentRows = (nodesRef.current.find((n) => n.id === nodeId)?.data.batchRows) || updatedRows;
        const targetRowIdx = currentRows.findIndex((r) => r.id === row.id);
        if (targetRowIdx >= 0) {
          const rowItem = currentRows[targetRowIdx];
          const existingArtifacts = rowItem.artifacts || [];
          const maxSeq = existingArtifacts.reduce((max, a) => Math.max(max, a.seqIndex ?? 0), 0);
          const newArtifactItem: IntegratedRowArtifact = {
            id: createId("art"),
            seqIndex: maxSeq + 1,
            fileName: payload.fileName,
            audioDataUrl: payload.audioDataUrl,
            elapsedMs: payload.elapsedMs,
            createdAt: new Date().toISOString()
          };
          const nextArtifacts = [...existingArtifacts, newArtifactItem];
          const newBatchRows = [...currentRows];
          newBatchRows[targetRowIdx] = {
            ...rowItem,
            artifacts: nextArtifacts
          };
          updatedRows = newBatchRows;
          const intermediateNodes = nodesRef.current.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, batchRows: newBatchRows } } : n));
          nodesRef.current = intermediateNodes;
          setNodes(intermediateNodes);
        }
      }

      const nextNodes = nodesRef.current.map((n) => (n.id === nodeId ? {
        ...n,
        data: {
          ...n.data,
          batchRows: updatedRows,
          isRunning: false,
          singleRunningRowId: undefined,
          error: undefined
        }
      } : n));
      nodesRef.current = nextNodes;
      setNodes(nextNodes);
      void saveWorkspace(nextNodes);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "请求失败。";
      patchNode(nodeId, { isRunning: false, singleRunningRowId: undefined, error: msg });
    }
  }

  async function runIntegratedSingleRow(nodeId: string, rowId: string) {
    const { nodesRef, edgesRef, isAnyApiKeyReady, patchNode, providerOptionsRef, getApiHeaders, setNodes, saveWorkspace } = getContext();
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;
    const node = currentNodes.find((n) => n.id === nodeId);
    if (!node || node.type !== "integratedStudio") return;

    if (!isAnyApiKeyReady()) {
      patchNode(nodeId, { error: "API Key 未配置，请点击顶部 API Key 区域配置。" });
      return;
    }

    const rows = node.data.batchRows || [];
    const rowIndex = rows.findIndex((r) => r.id === rowId);
    const row = rows[rowIndex];
    if (!row || !row.text.trim()) {
      patchNode(nodeId, { error: "当前行的音频文本不能为空。" });
      return;
    }

    let refAudioDataUrl = row.refAudioUrl || node.data.refAudioUrl;
    let refAudioFileName = row.refAudioName || node.data.refAudioName || "ref.wav";
    let refAudioMimeType = "audio/wav";

    if (!refAudioDataUrl) {
      const resolved = resolveCloneInputs(node, currentNodes, currentEdges);
      if (resolved.audio) {
        refAudioDataUrl = resolved.audio.dataUrl;
        refAudioFileName = resolved.audio.fileName;
        refAudioMimeType = resolved.audio.mimeType;
      }
    }

    if (providerOptionsRef.current.synthesisMode === "reference" && !refAudioDataUrl) {
      patchNode(nodeId, { error: `行「${row.title || `句段 ${rowIndex + 1}`}」缺少参考音频！请在第1列上传/录制参考音频。` });
      return;
    }

    patchNode(nodeId, { singleRunningRowId: rowId, error: undefined });

    try {
      const formData = new FormData();
      await appendSynthesisInputs(formData, providerOptionsRef.current, refAudioDataUrl ? { dataUrl: refAudioDataUrl, fileName: refAudioFileName, mimeType: refAudioMimeType } : undefined);
      formData.append("text", row.text.trim());
      formData.append("instruction", (row.instruction || row.voiceStyle || "").trim());
      formData.append("format", "wav");

      const response = await fetch("/api/tts/voiceclone", {
        method: "POST",
        headers: getApiHeaders(false),
        body: formData
      });

      const payload = (await response.json()) as DebugResponse & { error?: string };

      if (!response.ok) {
        patchNode(nodeId, { singleRunningRowId: undefined, error: payload.error || `行「${row.title || `句段 ${rowIndex + 1}`}」生成失败。` });
        return;
      }

      const currentRows = (nodesRef.current.find((n) => n.id === nodeId)?.data.batchRows) || rows;
      const targetRowIdx = currentRows.findIndex((r) => r.id === rowId);
      if (targetRowIdx >= 0) {
        const rowItem = currentRows[targetRowIdx];
        const existingArtifacts = rowItem.artifacts || [];
        const maxSeq = existingArtifacts.reduce((max, a) => Math.max(max, a.seqIndex ?? 0), 0);
        const newArtifactItem: IntegratedRowArtifact = {
          id: createId("art"),
          seqIndex: maxSeq + 1,
          fileName: payload.fileName,
          audioDataUrl: payload.audioDataUrl,
          elapsedMs: payload.elapsedMs,
          createdAt: new Date().toISOString()
        };
        const nextArtifacts = [...existingArtifacts, newArtifactItem];
        const newBatchRows = [...currentRows];
        newBatchRows[targetRowIdx] = {
          ...rowItem,
          artifacts: nextArtifacts
        };
        const nextNodes = nodesRef.current.map((n) => (n.id === nodeId ? {
          ...n,
          data: {
            ...n.data,
            singleRunningRowId: undefined,
            batchRows: newBatchRows,
            error: undefined
          }
        } : n));
        nodesRef.current = nextNodes;
        setNodes(nextNodes);
        void saveWorkspace(nextNodes);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "单条生成失败。";
      patchNode(nodeId, { singleRunningRowId: undefined, error: msg });
    }
  }

  async function runBatchVoiceClone(nodeId: string) {
    const { nodesRef, edgesRef, isAnyApiKeyReady, patchNode, providerOptionsRef, activeWorkspace, setNodes, setEdges, getApiHeaders, saveWorkspace } = getContext();
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;
    const batchNode = currentNodes.find((node) => node.id === nodeId);
    if (!batchNode || batchNode.type !== "batchVoiceClone") {
      return;
    }

    if (!isAnyApiKeyReady()) {
      patchNode(nodeId, { error: "API Key 未配置，请点击顶部 API Key 区域配置。" });
      return;
    }

    const resolved = resolveCloneInputs(batchNode, currentNodes, currentEdges);
    if (providerOptionsRef.current.synthesisMode === "reference" && !resolved.audio) {
      patchNode(nodeId, { error: "批量音频克隆节点需要连接一个参考音频或音频整合节点。" });
      return;
    }

    const rows = batchNode.data.batchRows || [];
    const validRows = rows.filter((r) => r.text.trim());
    if (validRows.length === 0) {
      patchNode(nodeId, { error: "请至少填写一行的音频文本。" });
      return;
    }

    patchNode(nodeId, { isRunning: true, error: undefined });

    try {
      for (const [index, row] of validRows.entries()) {
        const rowArtifactTitle = row.title.trim() || `句段 ${index + 1}`;

        let rowArtifactNode = nodesRef.current.find(
          (n) => n.type === "batchArtifact" && n.data.batchRowId === row.id && edgesRef.current.some((e) => e.source === nodeId && e.target === n.id)
        );

        if (!rowArtifactNode) {
          const col = index % 3;
          const rowPos = Math.floor(index / 3);
          const stepX = 500;
          const stepY = 500;
          const startX = batchNode.position.x + 680;

          const newArtifactNode: StudioNode = {
            id: createId("batch_artifact"),
            type: "batchArtifact",
            position: {
              x: startX + col * stepX,
              y: batchNode.position.y + rowPos * stepY
            },
            data: {
              title: rowArtifactTitle,
              parentTitle: batchNode.data.title?.trim() || "批量节点",
              batchRowId: row.id,
              batchArtifacts: [],
              workspaceName: activeWorkspace?.name
            }
          };
          const newEdge: StudioEdge = {
            id: createId("edge"),
            source: nodeId,
            sourceHandle: "output",
            target: newArtifactNode.id,
            targetHandle: "artifact",
            type: "deletable",
            animated: true,
            style: { stroke: NODE_COLOR_MAP.artifact || "#e5c07b", strokeWidth: 2 }
          };

          nodesRef.current = nodesRef.current.concat(newArtifactNode);
          edgesRef.current = edgesRef.current.concat(newEdge);
          setNodes(nodesRef.current);
          setEdges(edgesRef.current);
          rowArtifactNode = newArtifactNode;
        }

        const targetArtifactNodeId = rowArtifactNode.id;

        const formData = new FormData();
        await appendSynthesisInputs(formData, providerOptionsRef.current, resolved.audio);
        formData.append("text", row.text.trim());
        formData.append("instruction", (row.instruction || resolved.instruction || "").trim());
        formData.append("format", "wav");
        formData.append("title", rowArtifactTitle);

        const response = await fetch("/api/tts/voiceclone", {
          method: "POST",
          headers: getApiHeaders(false),
          body: formData
        });

        const payload = (await response.json()) as DebugResponse & { error?: string };

        if (!response.ok) {
          patchNode(nodeId, { isRunning: false, error: payload.error || `行「${row.title || `句段 ${index + 1}`}」克隆失败。` });
          return;
        }

        const intermediateNodes = nodesRef.current.map((n) => {
          if (n.id === targetArtifactNodeId) {
            const existing = n.data.batchArtifacts || [];
            const maxSeq = existing.reduce((max, a) => Math.max(max, a.seqIndex ?? 0), 0);
            const itemSeq = maxSeq + 1;
            const itemTitle = `${rowArtifactTitle}_${String(itemSeq).padStart(2, "0")}`;
            const newItem: BatchArtifactItem = {
              id: createId("bitem"),
              seqIndex: itemSeq,
              rowTitle: rowArtifactTitle,
              fileName: `${itemTitle}${getAudioFileExtension(payload.audioDataUrl, payload.fileName)}`,
              audioDataUrl: payload.audioDataUrl,
              elapsedMs: payload.elapsedMs,
              createdAt: new Date().toISOString()
            };
            return {
              ...n,
              data: {
                ...n.data,
                title: rowArtifactTitle,
                batchRowId: row.id,
                batchArtifacts: [...existing, newItem]
              }
            };
          }
          return n;
        });
        nodesRef.current = intermediateNodes;
        setNodes(intermediateNodes);
      }

      const finalNodes = nodesRef.current.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, isRunning: false, error: undefined } } : n));
      nodesRef.current = finalNodes;
      setNodes(finalNodes);
      void saveWorkspace(finalNodes, edgesRef.current);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "批量生成请求失败。";
      patchNode(nodeId, {
        isRunning: false,
        error: msg.includes("Failed to fetch") ? "网络连接异常 (Failed to fetch)。请检查后端服务运行状态。" : msg
      });
    }
  }

  async function runSingleRowBatchVoiceClone(nodeId: string, rowId: string) {
    const { nodesRef, edgesRef, isAnyApiKeyReady, patchNode, providerOptionsRef, activeWorkspace, setNodes, setEdges, getApiHeaders, saveWorkspace } = getContext();
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;
    const batchNode = currentNodes.find((node) => node.id === nodeId);
    if (!batchNode || batchNode.type !== "batchVoiceClone") {
      return;
    }

    if (!isAnyApiKeyReady()) {
      patchNode(nodeId, { error: "API Key 未配置，请点击顶部 API Key 区域配置。" });
      return;
    }

    const resolved = resolveCloneInputs(batchNode, currentNodes, currentEdges);
    if (providerOptionsRef.current.synthesisMode === "reference" && !resolved.audio) {
      patchNode(nodeId, { error: "批量音频克隆节点需要连接一个参考音频或音频整合节点。" });
      return;
    }

    const rows = batchNode.data.batchRows || [];
    const rowIndex = rows.findIndex((r) => r.id === rowId);
    const row = rows[rowIndex];
    if (!row || !row.text.trim()) {
      patchNode(nodeId, { error: "当前行的音频文本不能为空。" });
      return;
    }

    patchNode(nodeId, { singleRunningRowId: rowId, error: undefined });

    try {
      const rowArtifactTitle = row.title.trim() || `句段 ${rowIndex >= 0 ? rowIndex + 1 : 1}`;

      let rowArtifactNode = currentNodes.find(
        (n) => n.type === "batchArtifact" && n.data.batchRowId === row.id && currentEdges.some((e) => e.source === nodeId && e.target === n.id)
      );

      if (!rowArtifactNode) {
        const itemIdx = rowIndex >= 0 ? rowIndex : 0;
        const col = itemIdx % 3;
        const rowPos = Math.floor(itemIdx / 3);
        const stepX = 500;
        const stepY = 500;
        const startX = batchNode.position.x + 680;

        const newArtifactNode: StudioNode = {
          id: createId("batch_artifact"),
          type: "batchArtifact",
          position: {
            x: startX + col * stepX,
            y: batchNode.position.y + rowPos * stepY
          },
          data: {
            title: rowArtifactTitle,
            parentTitle: batchNode.data.title?.trim() || "批量节点",
            batchRowId: row.id,
            batchArtifacts: [],
            workspaceName: activeWorkspace?.name
          }
        };
        const newEdge: StudioEdge = {
          id: createId("edge"),
          source: nodeId,
          sourceHandle: "output",
          target: newArtifactNode.id,
          targetHandle: "artifact",
          type: "deletable",
          animated: true,
          style: { stroke: "#facc15", strokeWidth: 2 }
        };

        nodesRef.current = nodesRef.current.concat(newArtifactNode);
        edgesRef.current = edgesRef.current.concat(newEdge);
        setNodes(nodesRef.current);
        setEdges(edgesRef.current);
        rowArtifactNode = newArtifactNode;
      }

      const targetArtifactNodeId = rowArtifactNode.id;

      const formData = new FormData();
      await appendSynthesisInputs(formData, providerOptionsRef.current, resolved.audio);
      formData.append("text", row.text.trim());
      formData.append("instruction", (row.instruction || resolved.instruction || "").trim());
      formData.append("format", "wav");
      formData.append("title", rowArtifactTitle);

      const response = await fetch("/api/tts/voiceclone", {
        method: "POST",
        headers: getApiHeaders(false),
        body: formData
      });

      const payload = (await response.json()) as DebugResponse & { error?: string };

      if (!response.ok) {
        patchNode(nodeId, { singleRunningRowId: undefined, error: payload.error || `行「${row.title || `句段 ${rowIndex + 1}`}」克隆失败。` });
        return;
      }

      const finalNodes = nodesRef.current.map((n) => {
        if (n.id === targetArtifactNodeId) {
          const existing = n.data.batchArtifacts || [];
          const maxSeq = existing.reduce((max, a) => Math.max(max, a.seqIndex ?? 0), 0);
          const itemSeq = maxSeq + 1;
          const itemTitle = `${rowArtifactTitle}_${String(itemSeq).padStart(2, "0")}`;
          const newItem: BatchArtifactItem = {
            id: createId("bitem"),
            seqIndex: itemSeq,
            rowTitle: rowArtifactTitle,
            fileName: `${itemTitle}${getAudioFileExtension(payload.audioDataUrl, payload.fileName)}`,
            audioDataUrl: payload.audioDataUrl,
            elapsedMs: payload.elapsedMs,
            createdAt: new Date().toISOString()
          };
          return {
            ...n,
            data: {
              ...n.data,
              title: rowArtifactTitle,
              batchRowId: row.id,
              batchArtifacts: [...existing, newItem]
            }
          };
        }
        if (n.id === nodeId) {
          return {
            ...n,
            data: {
              ...n.data,
              singleRunningRowId: undefined,
              error: undefined
            }
          };
        }
        return n;
      });
      nodesRef.current = finalNodes;
      setNodes(finalNodes);
      void saveWorkspace(finalNodes, edgesRef.current);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "单条生成请求失败。";
      patchNode(nodeId, {
        singleRunningRowId: undefined,
        error: msg.includes("Failed to fetch") ? "网络连接异常 (Failed to fetch)。请检查后端服务运行状态。" : msg
      });
    }
  }

  async function runBatchVoiceDesign(nodeId: string) {
    const { nodesRef, isAnyApiKeyReady, patchNode, edgesRef, activeWorkspace, setNodes, setEdges, getApiHeaders, saveWorkspace } = getContext();
    const currentNodes = nodesRef.current;
    const batchNode = currentNodes.find((node) => node.id === nodeId);
    if (!batchNode || batchNode.type !== "batchVoiceDesign") {
      return;
    }

    if (!isAnyApiKeyReady()) {
      patchNode(nodeId, { error: "API Key 未配置，请点击顶部 API Key 区域配置。" });
      return;
    }

    const rows = batchNode.data.batchRows || [];
    const validRows = rows.filter((r) => r.text.trim());
    if (validRows.length === 0) {
      patchNode(nodeId, { error: "请至少填写一行的音频文本。" });
      return;
    }

    patchNode(nodeId, { isRunning: true, error: undefined });

    try {
      for (const [index, row] of validRows.entries()) {
        const rowArtifactTitle = row.title.trim() || `句段 ${index + 1}`;

        let rowArtifactNode = nodesRef.current.find(
          (n) => n.type === "batchArtifact" && n.data.batchRowId === row.id && edgesRef.current.some((e) => e.source === nodeId && e.target === n.id)
        );

        if (!rowArtifactNode) {
          const col = index % 3;
          const rowPos = Math.floor(index / 3);
          const stepX = 500;
          const stepY = 500;
          const startX = batchNode.position.x + 940;

          const newArtifactNode: StudioNode = {
            id: createId("batch_artifact"),
            type: "batchArtifact",
            position: {
              x: startX + col * stepX,
              y: batchNode.position.y + rowPos * stepY
            },
            data: {
              title: rowArtifactTitle,
              parentTitle: batchNode.data.title?.trim() || "批量节点",
              batchRowId: row.id,
              batchArtifacts: [],
              workspaceName: activeWorkspace?.name
            }
          };
          const newEdge: StudioEdge = {
            id: createId("edge"),
            source: nodeId,
            sourceHandle: "output",
            target: newArtifactNode.id,
            targetHandle: "artifact",
            type: "deletable",
            animated: true,
            style: { stroke: "#38bdf8", strokeWidth: 2 }
          };

          nodesRef.current = nodesRef.current.concat(newArtifactNode);
          edgesRef.current = edgesRef.current.concat(newEdge);
          setNodes(nodesRef.current);
          setEdges(edgesRef.current);
          rowArtifactNode = newArtifactNode;
        }

        const targetArtifactNodeId = rowArtifactNode.id;

        const rawDesc = (row.instruction || "").trim();
        const rawStyle = (row.voiceStyle || "").trim();
        const voiceDescription = [rawDesc, rawStyle ? `【语音风格】：${rawStyle}` : ""].filter(Boolean).join("\n\n");

        const response = await fetch("/api/tts/voicedesign", {
          method: "POST",
          headers: getApiHeaders(true),
          body: JSON.stringify({
            title: rowArtifactTitle,
            voiceDescription,
            naturalControl: (row.naturalControl || "").trim(),
            text: row.text.trim()
          })
        });

        const payload = (await response.json()) as DebugResponse & { error?: string };

        if (!response.ok) {
          patchNode(nodeId, { isRunning: false, error: payload.error || `行「${row.title || `句段 ${index + 1}`}」音色创造生成失败。` });
          return;
        }

        const intermediateNodes = nodesRef.current.map((n) => {
          if (n.id === targetArtifactNodeId) {
            const existing = n.data.batchArtifacts || [];
            const maxSeq = existing.reduce((max, a) => Math.max(max, a.seqIndex ?? 0), 0);
            const itemSeq = maxSeq + 1;
            const itemTitle = `${rowArtifactTitle}_${String(itemSeq).padStart(2, "0")}`;
            const newItem: BatchArtifactItem = {
              id: createId("bitem"),
              seqIndex: itemSeq,
              rowTitle: rowArtifactTitle,
              fileName: `${itemTitle}${getAudioFileExtension(payload.audioDataUrl, payload.fileName)}`,
              audioDataUrl: payload.audioDataUrl,
              elapsedMs: payload.elapsedMs,
              createdAt: new Date().toISOString()
            };
            return {
              ...n,
              data: {
                ...n.data,
                title: rowArtifactTitle,
                batchRowId: row.id,
                batchArtifacts: [...existing, newItem]
              }
            };
          }
          return n;
        });
        nodesRef.current = intermediateNodes;
        setNodes(intermediateNodes);
      }

      const finalNodes = nodesRef.current.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, isRunning: false, error: undefined } } : n));
      nodesRef.current = finalNodes;
      setNodes(finalNodes);
      void saveWorkspace(finalNodes, edgesRef.current);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "批量音色创造请求失败。";
      patchNode(nodeId, {
        isRunning: false,
        error: msg.includes("Failed to fetch") ? "网络连接异常 (Failed to fetch)。请检查后端服务运行状态。" : msg
      });
    }
  }

  async function runSingleRowBatchVoiceDesign(nodeId: string, rowId: string) {
    const { nodesRef, isAnyApiKeyReady, patchNode, edgesRef, activeWorkspace, setNodes, setEdges, getApiHeaders, saveWorkspace } = getContext();
    const currentNodes = nodesRef.current;
    const batchNode = currentNodes.find((node) => node.id === nodeId);
    if (!batchNode || batchNode.type !== "batchVoiceDesign") {
      return;
    }

    if (!isAnyApiKeyReady()) {
      patchNode(nodeId, { error: "API Key 未配置，请点击顶部 API Key 区域配置。" });
      return;
    }

    const rows = batchNode.data.batchRows || [];
    const rowIndex = rows.findIndex((r) => r.id === rowId);
    const row = rows[rowIndex];
    if (!row || !row.text.trim()) {
      patchNode(nodeId, { error: "当前行的音频文本不能为空。" });
      return;
    }

    patchNode(nodeId, { singleRunningRowId: rowId, error: undefined });

    try {
      const rowArtifactTitle = row.title.trim() || `句段 ${rowIndex >= 0 ? rowIndex + 1 : 1}`;

      let rowArtifactNode = currentNodes.find(
        (n) => n.type === "batchArtifact" && n.data.batchRowId === row.id && edgesRef.current.some((e) => e.source === nodeId && e.target === n.id)
      );

      if (!rowArtifactNode) {
        const itemIdx = rowIndex >= 0 ? rowIndex : 0;
        const col = itemIdx % 3;
        const rowPos = Math.floor(itemIdx / 3);
        const stepX = 500;
        const stepY = 500;
        const startX = batchNode.position.x + 940;

        const newArtifactNode: StudioNode = {
          id: createId("batch_artifact"),
          type: "batchArtifact",
          position: {
            x: startX + col * stepX,
            y: batchNode.position.y + rowPos * stepY
          },
          data: {
            title: rowArtifactTitle,
            parentTitle: batchNode.data.title?.trim() || "批量节点",
            batchRowId: row.id,
            batchArtifacts: [],
            workspaceName: activeWorkspace?.name
          }
        };
        const newEdge: StudioEdge = {
          id: createId("edge"),
          source: nodeId,
          sourceHandle: "output",
          target: newArtifactNode.id,
          targetHandle: "artifact",
          type: "deletable",
          animated: true,
          style: { stroke: "#38bdf8", strokeWidth: 2 }
        };

        nodesRef.current = nodesRef.current.concat(newArtifactNode);
        edgesRef.current = edgesRef.current.concat(newEdge);
        setNodes(nodesRef.current);
        setEdges(edgesRef.current);
        rowArtifactNode = newArtifactNode;
      }

      const targetArtifactNodeId = rowArtifactNode.id;

      const rawDesc = (row.instruction || "").trim();
      const rawStyle = (row.voiceStyle || "").trim();
      const voiceDescription = [rawDesc, rawStyle ? `【语音风格】：${rawStyle}` : ""].filter(Boolean).join("\n\n");

      const response = await fetch("/api/tts/voicedesign", {
        method: "POST",
        headers: getApiHeaders(true),
        body: JSON.stringify({
          title: rowArtifactTitle,
          voiceDescription,
          naturalControl: (row.naturalControl || "").trim(),
          text: row.text.trim()
        })
      });

      const payload = (await response.json()) as DebugResponse & { error?: string };

      if (!response.ok) {
        patchNode(nodeId, { singleRunningRowId: undefined, error: payload.error || `行「${row.title || `句段 ${rowIndex + 1}`}」生成失败。` });
        return;
      }

      const finalNodes = nodesRef.current.map((n) => {
        if (n.id === targetArtifactNodeId) {
          const existing = n.data.batchArtifacts || [];
          const maxSeq = existing.reduce((max, a) => Math.max(max, a.seqIndex ?? 0), 0);
          const itemSeq = maxSeq + 1;
          const itemTitle = `${rowArtifactTitle}_${String(itemSeq).padStart(2, "0")}`;
          const newItem: BatchArtifactItem = {
            id: createId("bitem"),
            seqIndex: itemSeq,
            rowTitle: rowArtifactTitle,
            fileName: `${itemTitle}${getAudioFileExtension(payload.audioDataUrl, payload.fileName)}`,
            audioDataUrl: payload.audioDataUrl,
            elapsedMs: payload.elapsedMs,
            createdAt: new Date().toISOString()
          };
          return {
            ...n,
            data: {
              ...n.data,
              title: rowArtifactTitle,
              batchRowId: row.id,
              batchArtifacts: [...existing, newItem]
            }
          };
        }
        if (n.id === nodeId) {
          return {
            ...n,
            data: {
              ...n.data,
              singleRunningRowId: undefined,
              error: undefined
            }
          };
        }
        return n;
      });
      nodesRef.current = finalNodes;
      setNodes(finalNodes);
      void saveWorkspace(finalNodes, edgesRef.current);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "单条音色创造请求失败。";
      patchNode(nodeId, {
        singleRunningRowId: undefined,
        error: msg.includes("Failed to fetch") ? "网络连接异常 (Failed to fetch)。请检查后端服务运行状态。" : msg
      });
    }
  }

  async function runVoiceDesign(nodeId: string, count: number = 1) {
    const { nodesRef, edgesRef, isAnyApiKeyReady, patchNode, getApiHeaders, setNodes, setEdges, saveWorkspace } = getContext();
    const initialNodes = [...nodesRef.current];
    const initialEdges = [...edgesRef.current];
    const designNode = initialNodes.find((node) => node.id === nodeId);
    if (!designNode || designNode.type !== "voiceDesign") {
      return;
    }

    if (!isAnyApiKeyReady()) {
      patchNode(nodeId, { error: "API Key 未配置，请点击顶部 API Key 区域配置。" });
      return;
    }

    const connectedInstructions = resolveVoiceDesignInstructionInputs(designNode, initialNodes, initialEdges);
    const rawInstruction = String(designNode.data.instruction || "").trim();
    const voiceDescription = (connectedInstructions.length > 0
      ? [rawInstruction, ...connectedInstructions].filter(Boolean).join("\n\n")
      : rawInstruction).trim();
    const naturalControl = String(designNode.data.naturalControl || "").trim();
    const promptInputs = resolveVoiceDesignInputs(designNode, initialNodes, initialEdges);
    const textItems = promptInputs.length > 0 ? promptInputs : [{ title: designNode.data.title, text: String(designNode.data.text || "").trim() }];

    if (!voiceDescription && !naturalControl) {
      patchNode(nodeId, { error: "请先填写音色描述或自然语言控制（或连接语音风格/提示词节点）。" });
      return;
    }

    if (textItems.every((item) => !item.text.trim())) {
      patchNode(nodeId, { error: "请连接提示词节点，或在节点内填写音频文本。" });
      return;
    }

    patchNode(nodeId, { isRunning: true, error: undefined });

    try {
      const validTextItems = textItems.filter((entry) => entry.text.trim());
      const totalRuns = count > 1 ? count : validTextItems.length;
      const newArtifactNodes: StudioNode[] = [];
      const newArtifactEdges: StudioEdge[] = [];

      for (let runIdx = 0; runIdx < totalRuns; runIdx++) {
        const item = validTextItems[runIdx % validTextItems.length];
        const response = await fetch("/api/tts/voicedesign", {
          method: "POST",
          headers: getApiHeaders(true),
          body: JSON.stringify({
            voiceDescription,
            naturalControl,
            text: item.text.trim(),
            format: "wav"
          })
        });
        const payload = (await response.json()) as DebugResponse & { error?: string; details?: unknown };

        if (!response.ok) {
          const detailMsg = (payload.details as { error?: { message?: string } })?.error?.message;
          patchNode(nodeId, { isRunning: false, error: detailMsg || payload.error || `第 ${runIdx + 1} 条音色创造失败。` });
          return;
        }

        const artifactNode = createArtifactNode(designNode, payload, item.title, runIdx, initialNodes, initialEdges);
        const artifactEdge: StudioEdge = {
          id: createId("edge"),
          source: designNode.id,
          sourceHandle: "output",
          target: artifactNode.id,
          targetHandle: "artifact",
          type: "deletable",
          animated: true,
          style: { stroke: NODE_COLOR_MAP.artifact || "#e5c07b", strokeWidth: 2 }
        };

        newArtifactNodes.push(artifactNode);
        newArtifactEdges.push(artifactEdge);
      }

      const nextNodes = nodesRef.current.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, isRunning: false, error: undefined } } : n)).concat(newArtifactNodes);
      const nextEdges = edgesRef.current.concat(newArtifactEdges);
      nodesRef.current = nextNodes;
      edgesRef.current = nextEdges;
      setNodes(nextNodes);
      setEdges(nextEdges);
      void saveWorkspace(nextNodes, nextEdges);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "请求失败。";
      patchNode(nodeId, {
        isRunning: false,
        error: msg.includes("Failed to fetch") ? "网络连接异常 (Failed to fetch)。请检查后端服务运行状态。" : msg
      });
    }
  }

  async function runGameVocalClone(nodeId: string) {
    const { nodesRef, edgesRef, isAnyApiKeyReady, patchNode, providerOptionsRef, vocalAbortMapRef, getApiHeaders, setNodes, setEdges, saveWorkspace } = getContext();
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;
    const vocalNode = currentNodes.find((n) => n.id === nodeId);
    if (!vocalNode || vocalNode.type !== "gameVocal") return;

    if (!isAnyApiKeyReady()) {
      patchNode(nodeId, { error: "API Key 未配置，请点击顶部 API Key 区域配置。" });
      return;
    }

    const isDesignMode = vocalNode.data.vocalRefMode === "design";
    const resolved = resolveGameVocalInputs(vocalNode, currentNodes, currentEdges);
    if (!isDesignMode && providerOptionsRef.current.synthesisMode === "reference" && !resolved.audio) {
      patchNode(nodeId, { error: "当前为【参考音频克隆】模式，需要从左侧连接一个参考音频、音频整合或产物卡片。如无需参考音频，可切换为【免参考·角色特征生成】模式。" });
      return;
    }

    const vocals = vocalNode.data.selectedVocals || [];
    if (vocals.length === 0) {
      patchNode(nodeId, { error: "请至少选择或添加一个语气词条目。" });
      return;
    }

    vocalAbortMapRef.current[nodeId] = false;
    patchNode(nodeId, { isRunning: true, error: undefined, vocalProgressText: `准备生成 (0/${vocals.length})...` });

    const initialNodes = nodesRef.current;
    const initialEdges = edgesRef.current;
    const newArtifactNodes: StudioNode[] = [];
    const newArtifactEdges: StudioEdge[] = [];

    try {
      for (const [index, vocal] of vocals.entries()) {
        if (vocalAbortMapRef.current[nodeId]) {
          break;
        }

        patchNode(nodeId, { vocalProgressText: `正在生成 (${index + 1}/${vocals.length}): ${vocal.text}...` });

        const cleanSub = (vocal.subcategoryLabel || vocal.categoryTitle || "语气词")
          .replace(/[\(\)\/\s]+/g, "_")
          .replace(/_{2,}/g, "_")
          .replace(/^_|_$/g, "");
        const cleanText = vocal.text.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5!]/g, "");
        const itemTitle = `${cleanSub}_${cleanText}`;

        const effectiveInstruction = vocal.instruction || vocalNode.data.instruction || resolved.instruction || "";
        const optimizedInstruction = buildOptimizedGameVocalPrompt({
          baseInstruction: effectiveInstruction,
          vocalText: vocal.text.trim(),
          categoryTitle: vocal.categoryTitle,
          subcategoryLabel: vocal.subcategoryLabel,
          durationMode: vocalNode.data.vocalDurationMode || "standard",
          antiDrone: vocalNode.data.antiDrone !== false,
          phoneticAnchor: vocalNode.data.phoneticAnchor !== false
        });

        let response: Response;
        let payload: DebugResponse & { error?: string };

        if (isDesignMode) {
          const charType = vocalNode.data.vocalCharacterType || "human";
          const tags = vocalNode.data.vocalSelectedTags || [];
          const generatedDesc = buildVoiceDescriptionFromTags(charType, tags);
          const customDesc = (vocalNode.data.vocalVoiceDescription || "").trim();
          const finalVoiceDesc = [
            customDesc || generatedDesc,
            resolved.instruction ? `【补充发声风格】：${resolved.instruction}` : ""
          ].filter(Boolean).join("\n\n");

          response = await fetch("/api/tts/voicedesign", {
            method: "POST",
            headers: getApiHeaders(true),
            body: JSON.stringify({
              title: itemTitle,
              voiceDescription: finalVoiceDesc,
              naturalControl: effectiveInstruction,
              text: vocal.text.trim(),
              instruction: optimizedInstruction.trim()
            })
          });
          payload = (await response.json()) as DebugResponse & { error?: string };
        } else {
          const formData = new FormData();
          await appendSynthesisInputs(formData, providerOptionsRef.current, resolved.audio);
          formData.append("text", vocal.text.trim());
          formData.append("instruction", optimizedInstruction.trim());
          formData.append("format", "wav");
          formData.append("title", itemTitle);

          response = await fetch("/api/tts/voiceclone", {
            method: "POST",
            headers: getApiHeaders(false),
            body: formData
          });
          payload = (await response.json()) as DebugResponse & { error?: string };
        }

        if (!response.ok) {
          patchNode(nodeId, { isRunning: false, vocalProgressText: undefined, error: payload.error || `语气词「${vocal.text}」生成失败。` });
          return;
        }

        // Apply audio tail trimming if enabled and audio is dragged
        if (vocalNode.data.autoTrimTail !== false && payload.audioDataUrl) {
          try {
            const trimRes = await trimVocalAudioDataUrl(
              payload.audioDataUrl,
              vocalNode.data.vocalDurationMode || "standard"
            );
            payload.audioDataUrl = trimRes.dataUrl;
          } catch (trimErr) {
            console.warn("Vocal audio trim failed, fallback to raw output:", trimErr);
          }
        }

        const artifactNode = createArtifactNode(vocalNode, payload, itemTitle, index, initialNodes, initialEdges);
        const artifactEdge: StudioEdge = {
          id: createId("edge"),
          source: vocalNode.id,
          sourceHandle: "output",
          target: artifactNode.id,
          targetHandle: "artifact",
          type: "deletable",
          animated: true,
          style: { stroke: "#8b5cf6", strokeWidth: 2 }
        };

        newArtifactNodes.push(artifactNode);
        newArtifactEdges.push(artifactEdge);
      }

      const nextNodes = nodesRef.current.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, isRunning: false, vocalProgressText: undefined, error: undefined } } : n)).concat(newArtifactNodes);
      const nextEdges = edgesRef.current.concat(newArtifactEdges);
      nodesRef.current = nextNodes;
      edgesRef.current = nextEdges;
      setNodes(nextNodes);
      setEdges(nextEdges);
      void saveWorkspace(nextNodes, nextEdges);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "语气词批量生成请求失败。";
      patchNode(nodeId, {
        isRunning: false,
        vocalProgressText: undefined,
        error: msg.includes("Failed to fetch") ? "网络连接异常 (Failed to fetch)。请检查后端服务运行状态。" : msg
      });
    }
  }

  async function optimizeVoiceStyle(nodeId: string) {
    const { nodesRef, isAnyApiKeyReady, patchNode, getApiHeaders } = getContext();
    const currentNodes = nodesRef.current;
    const styleNode = currentNodes.find((node) => node.id === nodeId);
    if (!styleNode || styleNode.type !== "voiceStyle") {
      return;
    }

    if (!isAnyApiKeyReady()) {
      patchNode(nodeId, { error: "API Key 未配置，请点击顶部 API Key 区域配置。" });
      return;
    }

    const style = String(styleNode.data.text || "").trim();
    if (!style) {
      patchNode(nodeId, { error: "请先填写需要优化的语音风格。" });
      return;
    }

    patchNode(nodeId, { isRunning: true, error: undefined });

    try {
      const response = await fetch("/api/voice-style/optimize", {
        method: "POST",
        headers: getApiHeaders(true),
        body: JSON.stringify({ style })
      });
      const payload = (await response.json()) as StyleOptimizeResponse;

      if (!response.ok) {
        patchNode(nodeId, { isRunning: false, error: formatOptimizationError(payload.error || "AI 优化失败。") });
        return;
      }

      patchNode(nodeId, {
        text: payload.optimizedText,
        isRunning: false,
        error: undefined
      });
    } catch (error) {
      patchNode(nodeId, {
        isRunning: false,
        error: formatOptimizationError(error instanceof Error ? error.message : "AI 优化请求失败。")
      });
    }
  }

  async function optimizeVoiceDesign(nodeId: string) {
    const { nodesRef, edgesRef, isAnyApiKeyReady, patchNode, getApiHeaders } = getContext();
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;
    const designNode = currentNodes.find((node) => node.id === nodeId);
    if (!designNode || designNode.type !== "voiceDesign") {
      return;
    }

    if (!isAnyApiKeyReady()) {
      patchNode(nodeId, { error: "API Key 未配置，请点击顶部 API Key 区域配置。" });
      return;
    }

    const connectedInstructions = resolveVoiceDesignInstructionInputs(designNode, currentNodes, currentEdges);
    const rawInstruction = String(designNode.data.instruction || "").trim();
    const voiceDescription = (connectedInstructions.length > 0
      ? [rawInstruction, ...connectedInstructions].filter(Boolean).join("\n\n")
      : rawInstruction).trim();
    if (!voiceDescription) {
      patchNode(nodeId, { error: "请先填写需要润色的音色描述。" });
      return;
    }

    patchNode(nodeId, { isRunning: true, error: undefined });

    try {
      const response = await fetch("/api/voice-design/optimize", {
        method: "POST",
        headers: getApiHeaders(true),
        body: JSON.stringify({ voiceDescription })
      });
      const payload = (await response.json()) as StyleOptimizeResponse;

      if (!response.ok) {
        patchNode(nodeId, { isRunning: false, error: formatOptimizationError(payload.error || "AI 润色音色描述失败。") });
        return;
      }

      patchNode(nodeId, {
        instruction: payload.optimizedText,
        isRunning: false,
        error: undefined
      });
    } catch (error) {
      patchNode(nodeId, {
        isRunning: false,
        error: formatOptimizationError(error instanceof Error ? error.message : "AI 润色音色描述请求失败。")
      });
    }
  }

  return { runAudioMerge, runVoiceClone, deleteBatchArtifactItem, deleteIntegratedArtifactItem, runIntegratedBatch, runIntegratedSingleRow, runBatchVoiceClone, runSingleRowBatchVoiceClone, runBatchVoiceDesign, runSingleRowBatchVoiceDesign, runVoiceDesign, runGameVocalClone, optimizeVoiceStyle, optimizeVoiceDesign };
}
