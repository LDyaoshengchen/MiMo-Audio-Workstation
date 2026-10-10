import type { ArtifactData } from "../../types/studioAudio";
import type { NodeProps } from "@xyflow/react";
import type { StudioNode } from "../../types/studio";
import { Archive, Trash2, Loader2, FileDown } from "lucide-react";
import { SingleArtifactDownloadLink } from "../SingleArtifactDownloadLink";
import { StudioAudioPlayer } from "../StudioAudioPlayer";
import { StudioNodeFrame } from "./StudioNodeFrame";
import { ZipExportProgress } from "../ZipExportProgress";
import { memo, useRef, useEffect } from "react";
import { sanitizeFileName, formatHierarchyName, getArtifactDownloadFileName, getAudioFileExtension } from "../../utils/audioNaming";
import { scheduleBatchNodeInternalsUpdate } from "../../studio/nodeInternals";
import { useAudioZipExport } from "../../utils/useAudioZipExport";
import { useUpdateNodeInternals, Handle, Position } from "@xyflow/react";

export const BatchArtifactNode = memo(function BatchArtifactNode({ id, data }: NodeProps<StudioNode>) {
  const updateNodeInternals = useUpdateNodeInternals();
  const zipExport = useAudioZipExport();
  const isZipping = zipExport.isZipping;
  const items = data.batchArtifacts || [];
  const listRef = useRef<HTMLDivElement>(null);
  const lastItemRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(items.length);

  useEffect(() => {
    scheduleBatchNodeInternalsUpdate(id, updateNodeInternals);
  }, [id, updateNodeInternals, items.length]);

  useEffect(() => {
    // 仅当实际生成新增了产物条目时，才平滑滚动到最新项
    // 移动视口导致节点移出再移回重新挂载时，保持用户当前的浏览位置，绝不强制滚到底部
    if (items.length > prevCountRef.current) {
      const timer = setTimeout(() => {
        if (lastItemRef.current) {
          lastItemRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
        } else if (listRef.current) {
          listRef.current.scrollTop = listRef.current.scrollHeight;
        }
      }, 60);
      prevCountRef.current = items.length;
      return () => clearTimeout(timer);
    }
    prevCountRef.current = items.length;
  }, [items.length]);

  async function handleDownloadZip() {
    const nodeTitle = data.title || "批量产物";
    const parentTitle = data.parentTitle || "批量节点";
    const folderName = sanitizeFileName(formatHierarchyName(parentTitle, nodeTitle));
    const files = items.map((item, index) => ({
      name: folderName + "/" + getArtifactDownloadFileName(formatHierarchyName(parentTitle, nodeTitle, item.seqIndex ?? (index + 1)), item.fileName, data.workspaceName),
      source: item.audioDataUrl
    }));
    await zipExport.download(files, folderName + ".zip");
  }

  return (
    <StudioNodeFrame id={id} data={data} icon={<Archive size={17} />} tone="batch-artifact">
      <Handle type="target" position={Position.Left} id="artifact" className="node-handle" style={{ top: "50%" }} />
      <span className="input-handle-label" style={{ top: "50%" }}>产物</span>
      {items.length > 0 ? (
        <Handle type="source" position={Position.Right} id="audio" className="node-handle" style={{ top: "50%" }} />
      ) : null}

      {items.length === 0 ? (
        <p className="node-muted">等待批量节点写入产物。</p>
      ) : (
        <>
          <div
            ref={listRef}
            className="batch-artifact-item-list nodrag nowheel nopan"
            onWheel={(e) => e.stopPropagation()}
          >
            {items.map((item, index) => {
              const nodeTitle = data.title || "产物";
              const itemSeq = item.seqIndex ?? (index + 1);
              const parentTitle = (data.parentTitle && data.parentTitle !== "批量节点" && data.parentTitle !== "节点名称") ? data.parentTitle : "";
              const fullStashName = formatHierarchyName(parentTitle, nodeTitle, itemSeq);
              const isLatest = index === items.length - 1;

              const artifactForStash: ArtifactData = {
                fileName: `${fullStashName}${getAudioFileExtension(item.audioDataUrl, item.fileName)}`,
                audioDataUrl: item.audioDataUrl,
                elapsedMs: item.elapsedMs,
                createdAt: item.createdAt,
                sourceNodeName: fullStashName,
                sourceNodeId: id,
                sourceRowId: data.batchRowId
              };
              const isStashed = data.isArtifactStashed?.(artifactForStash) ?? false;

              return (
                <div
                  key={item.id}
                  ref={isLatest ? lastItemRef : undefined}
                  className={`batch-artifact-item-card ${isLatest && items.length > 1 ? "is-latest" : ""}`}
                >
                  <div className="batch-artifact-item-header">
                    <div className="batch-artifact-name-wrap">
                      <span className="batch-artifact-item-name">{fullStashName}</span>
                      {isLatest && items.length > 1 && (
                        <span className="batch-artifact-latest-tag">最新</span>
                      )}
                    </div>
                    <div className="batch-artifact-item-actions">
                      <button
                        type="button"
                        className={isStashed ? "batch-artifact-item-btn stashed" : "batch-artifact-item-btn"}
                        onClick={() => data.onToggleStashArtifact?.(artifactForStash)}
                        title={isStashed ? "已暂存 (点击取消暂存)" : "暂存此音频"}
                      >
                        <Archive size={12} />
                        {isStashed ? "已暂存" : "暂存"}
                      </button>
                      <SingleArtifactDownloadLink title={fullStashName} fileName={item.fileName} audioDataUrl={item.audioDataUrl}
                        workspaceName={data.workspaceName} createdAt={item.createdAt} settings={data.singleDownloadSettings}
                        className="batch-artifact-item-btn download-btn" iconSize={12} />
                      <button
                        type="button"
                        className="batch-artifact-item-btn"
                        onClick={() => data.onDeleteBatchArtifactItem?.(id, item.id)}
                        title="删除此音频"
                        style={{ color: "#ef4444" }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <StudioAudioPlayer src={item.audioDataUrl} />
                </div>
              );
            })}
          </div>

          <button
            type="button"
            className="batch-download-all-btn nodrag"
            onClick={() => void handleDownloadZip()}
            disabled={isZipping}
          >
            {isZipping ? <Loader2 className="spin" size={16} /> : <FileDown size={16} />}
            {isZipping ? "正在打包中..." : `批量打包下载此节点语音 (.zip)`}
          </button>
          <ZipExportProgress progress={zipExport.progress} onCancel={zipExport.cancel} />
        </>
      )}
    </StudioNodeFrame>
  );
});
