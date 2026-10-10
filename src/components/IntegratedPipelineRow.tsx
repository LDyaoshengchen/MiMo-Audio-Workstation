import { memo, type ChangeEvent, type ClipboardEvent, type DragEvent } from "react";
import { Loader2, Mic, Square, Trash2, Upload, Zap } from "lucide-react";
import type { BatchVoiceCloneRow } from "../types/studioAudio";
import { StudioAudioPlayer } from "./StudioAudioPlayer";
import { IntegratedRowArtifactList, type IntegratedArtifactContext } from "./IntegratedRowArtifactList";

export type IntegratedRowActions = {
  onDragOver: (rowId: string | null) => void;
  onDrop: (rowId: string, event: DragEvent) => void | Promise<void>;
  onClearReference: (rowId: string) => void;
  onUpload: (rowId: string, event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  onStopRecording: () => void;
  onStartRecording: (rowId: string) => void | Promise<void>;
  onUpdate: (rowId: string, field: keyof BatchVoiceCloneRow, value: string) => void;
  onPaste: (index: number, field: "title" | "instruction" | "voiceStyle" | "text", event: ClipboardEvent) => void;
  onRemove: (rowId: string) => void;
  onRun: (rowId: string) => void;
};

export const IntegratedPipelineRow = memo(function IntegratedPipelineRow({
  row, index, canRemove, isDragOver, isRecording, isGenerating, isBatchRunning, recordTimeStr, actions, artifactContext
}: {
  row: BatchVoiceCloneRow; index: number; canRemove: boolean; isDragOver: boolean; isRecording: boolean;
  isGenerating: boolean; isBatchRunning: boolean; recordTimeStr: string;
  actions: IntegratedRowActions; artifactContext: IntegratedArtifactContext;
}) {
  return (
          <div className="integrated-pipeline-row">
            {/* Col 1: Reference Audio Cell */}
            <div
              className={`integrated-cell cell-ref ${isDragOver ? "dragging-over" : ""}`}
              onDragEnter={(e) => {
                e.preventDefault();
                e.stopPropagation();
                actions.onDragOver(row.id);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = "copy";
                if (!isDragOver) actions.onDragOver(row.id);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const related = e.relatedTarget as HTMLElement | null;
                if (!related || !e.currentTarget.contains(related)) {
                  actions.onDragOver(null);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                actions.onDragOver(null);
                void actions.onDrop(row.id, e);
              }}
            >
              <div className="cell-title">
                <span title={row.refAudioName || row.title}>
                  {index + 1}. {row.refAudioName || "暂无参考音频"}
                </span>
                {row.refAudioUrl && (
                  <button
                    type="button"
                    className="batch-row-remove-btn"
                    onClick={() => actions.onClearReference(row.id)}
                    title="清除此行参考音频"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>

              {row.refAudioUrl ? (
                <div className="integrated-ref-player-box">
                  <StudioAudioPlayer src={row.refAudioUrl} />
                </div>
              ) : (
                <div className="integrated-ref-placeholder">
                  <p className="node-muted" style={{ fontSize: 11 }}>可拖入/上传音频 (多选文件自动合并为本行参考)</p>
                </div>
              )}

              <div className="integrated-ref-actions nodrag">
                <label className="integrated-btn" style={{ flex: 1 }} title="点击上传1个或多个音频文件，选多个将自动在本行拼接整合">
                  <Upload size={13} />
                  <span>{row.refAudioUrl ? "更换/多选" : "上传(多选整合)"}</span>
                  <input type="file" accept="audio/*" multiple onChange={(e) => actions.onUpload(row.id, e)} hidden />
                </label>

                {isRecording ? (
                  <button type="button" className="integrated-btn recording" style={{ flex: 1 }} onClick={actions.onStopRecording}>
                    <Square size={13} />
                    <span>停止({recordTimeStr})</span>
                  </button>
                ) : (
                  <button type="button" className="integrated-btn" style={{ flex: 1 }} onClick={() => void actions.onStartRecording(row.id)}>
                    <Mic size={13} />
                    <span>录制</span>
                  </button>
                )}
              </div>
            </div>

            {/* Col 2: Voice Clone Cell */}
            <div className={isGenerating ? "integrated-cell cell-clone is-row-generating" : "integrated-cell cell-clone"}>
              <div className="integrated-row-top">
                <span className="node-muted" style={{ fontSize: 11, fontWeight: 700 }}>#{index + 1}</span>
                <input
                  className="batch-row-title-input nodrag nopan nowheel"
                  value={row.title}
                  onChange={(e) => actions.onUpdate(row.id, "title", e.target.value)}
                  onPaste={(e) => actions.onPaste(index, "title", e)}
                  placeholder="标识/名字"
                />
                {canRemove && (
                  <button type="button" className="batch-row-remove-btn" onClick={() => actions.onRemove(row.id)}>
                    <Trash2 size={12} />
                  </button>
                )}
              </div>

              <textarea
                className="nodrag nopan nowheel integrated-textarea"
                value={row.instruction || ""}
                onChange={(e) => actions.onUpdate(row.id, "instruction", e.target.value)}
                onPaste={(e) => actions.onPaste(index, "instruction", e)}
                rows={2}
                placeholder="输入语音风格 (导演文本/语气)..."
              />

              <textarea
                className="nodrag nopan nowheel integrated-textarea"
                value={row.text}
                onChange={(e) => actions.onUpdate(row.id, "text", e.target.value)}
                onPaste={(e) => actions.onPaste(index, "text", e)}
                rows={2}
                placeholder="输入音频文本..."
              />

              <button
                type="button"
                className={isGenerating ? "batch-row-single-clone-btn is-running is-generating" : "batch-row-single-clone-btn"}
                onClick={() => actions.onRun(row.id)}
                disabled={isBatchRunning || isGenerating || !row.text.trim()}
              >
                {isGenerating ? (
                  <Loader2 size={14} className="spin-icon spin" />
                ) : (
                  <Zap size={13} />
                )}
                <span>{isGenerating ? "生成中..." : "运行生成"}</span>
              </button>
            </div>

            {/* Col 3: Audio Artifact Cell */}
            <div className="integrated-cell cell-artifact">
              <IntegratedRowArtifactList
                rowId={row.id} rowTitle={row.title} artifacts={row.artifacts}
                context={artifactContext}
              />
            </div>
          </div>
  );
});

