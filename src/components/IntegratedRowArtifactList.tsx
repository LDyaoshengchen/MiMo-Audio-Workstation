import { memo } from "react";
import { Archive, Trash2 } from "lucide-react";
import type { ArtifactData, IntegratedRowArtifact } from "../types/studioAudio";
import type { SingleDownloadSettings } from "../utils/downloadSettings";
import { formatHierarchyName } from "../utils/audioNaming";
import { WindowedList } from "./WindowedList";
import { SingleArtifactDownloadLink } from "./SingleArtifactDownloadLink";
import { StudioAudioPlayer } from "./StudioAudioPlayer";
import { ArtifactReview } from "./ArtifactReview";
import type { ProductReview } from "../types/studioAudio";

export type IntegratedArtifactContext = {
  nodeId: string;
  nodeTitle: string;
  workspaceName?: string;
  settings?: SingleDownloadSettings;
  stashedKeys?: ReadonlySet<string>;
  onToggleStash?: (artifact: ArtifactData) => void;
  onDeleteArtifact?: (rowId: string, artifactId: string) => void;
  onReview?: (rowId: string, artifactId: string, review: ProductReview) => void;
};

const EMPTY_ARTIFACTS: IntegratedRowArtifact[] = [];

// Text/instruction edits do not invalidate this list or its audio players.
export const IntegratedRowArtifactList = memo(function IntegratedRowArtifactList({
  rowId, rowTitle, artifacts = EMPTY_ARTIFACTS, context
}: {
  rowId: string; rowTitle: string; artifacts?: IntegratedRowArtifact[]; context: IntegratedArtifactContext;
}) {
  return (
    <div
      className="integrated-row-artifact-box nodrag nowheel nopan"
      onWheel={(e) => e.stopPropagation()}
    >
      <div className="integrated-row-artifact-header">
        <span className="node-muted" style={{ fontSize: 12, fontWeight: 700 }}>
          {rowTitle} 产物 ({artifacts.length})
        </span>
      </div>

      {artifacts.length === 0 ? (
        <span className="node-muted" style={{ fontSize: 11 }}>等待生成产物…</span>
      ) : (
        <WindowedList className="integrated-artifact-cards-list"
          items={artifacts} itemKey={art => art.id} estimatedHeight={104} gap={8}
          maxHeight={174} followAppend
          renderItem={(art, index) => {
            const rowName = rowTitle || "句段";
            const itemSeq = art.seqIndex ?? (index + 1);
            const itemSubTitle = formatHierarchyName(context.nodeTitle, rowName, itemSeq);
            const fullStashName = itemSubTitle;
            const isLatest = index === artifacts.length - 1;

            const artifactForStash: ArtifactData = {
              fileName: art.fileName,
              audioDataUrl: art.audioDataUrl,
              elapsedMs: art.elapsedMs,
              createdAt: art.createdAt,
              sourceNodeName: fullStashName,
              sourceNodeId: context.nodeId,
              sourceRowId: rowId
            };
            const isStashed = context.stashedKeys?.has(JSON.stringify([art.fileName, art.audioDataUrl])) ?? false;

            return (
              <div
                key={art.id}
                className={`batch-artifact-item-card ${isLatest && artifacts.length > 1 ? "is-latest" : ""}`}
              >
                <div className="batch-artifact-item-header">
                  <div className="batch-artifact-name-wrap">
                    <span className="batch-artifact-item-name">{itemSubTitle}</span>
                    {isLatest && artifacts.length > 1 && (
                      <span className="batch-artifact-latest-tag">最新</span>
                    )}
                  </div>
                  <div className="batch-artifact-item-actions">
                    <ArtifactReview title={itemSubTitle} src={art.audioDataUrl} review={art.review} onChange={review => context.onReview?.(rowId, art.id, review)} />
                    <button
                      type="button"
                      className={isStashed ? "batch-artifact-item-btn stashed" : "batch-artifact-item-btn"}
                      onClick={() => context.onToggleStash?.(artifactForStash)}
                      title={isStashed ? "已暂存 (点击取消暂存)" : "暂存此音频"}
                    >
                      <Archive size={12} />
                      {isStashed ? "已暂存" : "暂存"}
                    </button>
                    <SingleArtifactDownloadLink title={itemSubTitle} fileName={art.fileName} audioDataUrl={art.audioDataUrl}
                      workspaceName={context.workspaceName} createdAt={art.createdAt} settings={context.settings}
                      className="batch-artifact-item-btn download-btn" iconSize={12} />
                    <button
                      type="button"
                      className="batch-artifact-item-btn"
                      onClick={() => context.onDeleteArtifact?.(rowId, art.id)}
                      title="删除此音频"
                      style={{ color: "#ef4444" }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                <StudioAudioPlayer src={art.audioDataUrl} />
              </div>
            );
          }}
        />
      )}
    </div>
  );
});

