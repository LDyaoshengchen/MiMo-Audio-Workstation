import type { BatchVoiceCloneRow } from "../../types/studioAudio";
import { Upload, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useState, ChangeEvent, useMemo, useRef } from "react";

export interface AudioRowMapping {
  file: File;
  targetRowIndex: number;
}

export function BatchAudioUploadModal({
  rows,
  onClose,
  onApply
}: {
  rows: BatchVoiceCloneRow[];
  onClose: () => void;
  onApply: (mappings: { file: File; targetRowIndex: number }[]) => void;
}) {
  const [items, setItems] = useState<AudioRowMapping[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  function handleFileAdd(e: ChangeEvent<HTMLInputElement>) {
    const newFiles = Array.from(e.target.files || []);
    if (newFiles.length === 0) return;

    setItems((prev) => {
      const startIdx = prev.length > 0 ? prev[prev.length - 1].targetRowIndex + 1 : 0;
      const added: AudioRowMapping[] = newFiles.map((file, i) => ({
        file,
        targetRowIndex: startIdx + i
      }));
      return [...prev, ...added];
    });
  }

  function handleDropFiles(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files || []).filter(
      (file) => file.type.startsWith("audio/") || /\.(mp3|wav|m4a|aac|ogg|flac|mp4)$/i.test(file.name)
    );
    if (droppedFiles.length === 0) return;

    setItems((prev) => {
      const startIdx = prev.length > 0 ? prev[prev.length - 1].targetRowIndex + 1 : 0;
      const added: AudioRowMapping[] = droppedFiles.map((file, i) => ({
        file,
        targetRowIndex: startIdx + i
      }));
      return [...prev, ...added];
    });
  }

  function handleRemoveItem(idx: number) {
    setItems((prev) => {
      const removed = prev[idx];
      if (!removed) return prev;
      const wasSoleOwner = prev.filter((it, i) => i !== idx && it.targetRowIndex === removed.targetRowIndex).length === 0;
      const filtered = prev.filter((_, i) => i !== idx);
      if (wasSoleOwner) {
        return filtered.map((item, i) => {
          if (i >= idx && item.targetRowIndex >= removed.targetRowIndex) {
            return { ...item, targetRowIndex: Math.max(0, item.targetRowIndex - 1) };
          }
          return item;
        });
      }
      return filtered;
    });
  }

  function handleUpdateTargetRow(itemIdx: number, newTargetIdx: number) {
    setItems((prev) => {
      const oldTargetIdx = prev[itemIdx]?.targetRowIndex ?? 0;
      if (oldTargetIdx === newTargetIdx) return prev;

      // 检查原行是否仅由当前 itemIdx 独占
      const wasSoleOwner = prev.filter((it, i) => i !== itemIdx && it.targetRowIndex === oldTargetIdx).length === 0;

      return prev.map((item, i) => {
        if (i === itemIdx) {
          return { ...item, targetRowIndex: newTargetIdx };
        }
        if (i > itemIdx) {
          // 场景 A: 往前合并（例如第 6 个文件选择了与第 5 行合并）：
          // 原第 6 行被腾出，后续所有原本 >= oldTargetIdx 的文件自动全部向前顺延平移 1 行
          // 这样第 7 个文件就自动顺延变为第 6 行，第 8 个文件自动为第 7 行
          if (newTargetIdx < oldTargetIdx && wasSoleOwner) {
            if (item.targetRowIndex >= oldTargetIdx) {
              return { ...item, targetRowIndex: Math.max(0, item.targetRowIndex - 1) };
            }
          }
          // 场景 B: 往后拆分新行（例如从合并行中解绑独立成新行，或在中间插入新行）：
          // 后续大于等于新行编号的文件自动向后顺延 1 行
          else if (newTargetIdx > oldTargetIdx && !wasSoleOwner) {
            if (item.targetRowIndex >= newTargetIdx) {
              return { ...item, targetRowIndex: item.targetRowIndex + 1 };
            }
          }
        }
        return item;
      });
    });
  }

  function handleAutoSequential() {
    setItems((prev) =>
      prev.map((item, i) => ({
        ...item,
        targetRowIndex: i
      }))
    );
  }

  function handleAllToOneRow(targetIdx: number) {
    setItems((prev) => prev.map((item) => ({ ...item, targetRowIndex: targetIdx })));
  }

  function handleConfirm() {
    if (items.length === 0) {
      alert("请先添加至少一个音频文件！");
      return;
    }
    onApply(items);
    onClose();
  }

  const rowCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    items.forEach((item) => {
      counts[item.targetRowIndex] = (counts[item.targetRowIndex] || 0) + 1;
    });
    return counts;
  }, [items]);

  // 计算当前下拉菜单应当提供的所有有效行选项
  const maxRowIndex = useMemo(() => {
    let max = Math.max(rows.length, items.length);
    for (const it of items) {
      if (it.targetRowIndex + 1 > max) {
        max = it.targetRowIndex + 1;
      }
    }
    return max;
  }, [rows.length, items]);

  const getRowOptionLabel = (rIdx: number) => {
    if (rIdx < rows.length) {
      return `第 ${rIdx + 1} 行 (${rows[rIdx].title || `句段 ${rIdx + 1}`})`;
    }
    const firstItemOnRow = items.find((it) => it.targetRowIndex === rIdx);
    if (firstItemOnRow) {
      const cleanName = firstItemOnRow.file.name.replace(/\.[^/.]+$/, "");
      return `第 ${rIdx + 1} 行 (${cleanName})`;
    }
    return `第 ${rIdx + 1} 行 (新增句段)`;
  };

  const backdropMouseDownRef = useRef<EventTarget | null>(null);

  return createPortal(
    <div
      className="integrated-audio-modal-backdrop nodrag nopan nowheel"
      onMouseDown={(e) => {
        backdropMouseDownRef.current = e.target;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && backdropMouseDownRef.current === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={`integrated-multi-audio-card ${isDraggingOver ? "dragging-over" : ""} nodrag nopan nowheel`}
        onClick={(e) => e.stopPropagation()}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!isDraggingOver) setIsDraggingOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDraggingOver(false);
        }}
        onDrop={handleDropFiles}
      >
        <div className="integrated-multi-audio-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>📁</span>
            <h3>音频文件 ➔ 目标句段行 分配与合并表</h3>
          </div>
          <button type="button" className="excel-modal-close" style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 22, cursor: "pointer" }} onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="integrated-multi-audio-banner">
          <label className="integrated-multi-audio-upload-btn" style={{ cursor: "pointer", fontWeight: 700, padding: "8px 16px", borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Upload size={15} />
            <span>📁 添加/拖入音频文件 (支持多选与拖拽)</span>
            <input type="file" accept="audio/*" multiple onChange={handleFileAdd} hidden />
          </label>

          {items.length > 0 && (
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="integrated-mini-tool" style={{ padding: "5px 10px", fontSize: 12 }} onClick={handleAutoSequential} title="按音频文件自上而下1对1依次各占新行">
                🔄 1对1顺序填入
              </button>
              <button type="button" className="integrated-mini-tool" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => handleAllToOneRow(0)} title="所有音频全部并入第1行融合生成">
                🔀 全部对齐第1行
              </button>
              <button type="button" className="integrated-mini-tool danger" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => setItems([])}>
                🗑️ 清空
              </button>
            </div>
          )}
        </div>

        <div className="integrated-multi-audio-table-wrap">
          {items.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center", color: isDraggingOver ? "#38bdf8" : "#94a3b8", fontSize: 13 }}>
              {isDraggingOver ? "✨ 松开鼠标直接导入音频文件..." : "暂未添加音频文件，请点击上方“添加音频文件”或直接将音频文件拖拽至此处。"}
            </div>
          ) : (
            <table className="integrated-multi-audio-table">
              <thead>
                <tr>
                  <th style={{ width: "55%", verticalAlign: "middle" }}>音频文件名称</th>
                  <th style={{ width: "35%", verticalAlign: "middle" }}>目标分配行 (选择对应句段)</th>
                  <th style={{ width: "10%", textAlign: "center", verticalAlign: "middle" }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const countForThisRow = rowCounts[item.targetRowIndex] || 0;
                  const isMerged = countForThisRow > 1;

                  return (
                    <tr key={idx}>
                      <td style={{ padding: "8px 14px", fontWeight: 600, verticalAlign: "middle" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ color: "#94a3b8", fontSize: 11, minWidth: 18, flexShrink: 0 }}>#{idx + 1}</span>
                          <span style={{ wordBreak: "break-all", lineHeight: 1.4 }}>{item.file.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: "8px 14px", verticalAlign: "middle" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <select
                            className="nodrag nopan nowheel integrated-multi-audio-select"
                            value={item.targetRowIndex}
                            onChange={(e) => handleUpdateTargetRow(idx, Number(e.target.value))}
                          >
                            {Array.from({ length: maxRowIndex }, (_, rIdx) => (
                              <option key={rIdx} value={rIdx}>
                                {getRowOptionLabel(rIdx)}
                              </option>
                            ))}
                            <option value={maxRowIndex}>
                              + 新增第 {maxRowIndex + 1} 行
                            </option>
                          </select>
                          {isMerged && (
                            <span style={{ fontSize: 10, color: "#38bdf8", background: "rgba(56, 189, 248, 0.2)", border: "1px solid rgba(56, 189, 248, 0.5)", padding: "2px 6px", borderRadius: 4, whiteSpace: "nowrap" }}>
                              自动合并
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: "8px 10px", textAlign: "center", verticalAlign: "middle" }}>
                        <button
                          type="button"
                          className="integrated-multi-audio-del-btn"
                          onClick={() => handleRemoveItem(idx)}
                          title="移除此项"
                        >
                          <X size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {items.length > 0 && (
          <div className="integrated-multi-audio-summary">
            <span style={{ fontWeight: 700 }}>分配概览:</span>
            {(() => {
              const mergedEntries = Object.entries(rowCounts).filter(([_, count]) => count > 1);
              if (mergedEntries.length === 0) {
                return (
                  <span>
                    共 {items.length} 个音频文件，已 1 对 1 顺序分配至 {items.length} 个句段行
                  </span>
                );
              }
              return mergedEntries
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([rowIdxStr, count]) => {
                  const rIdx = Number(rowIdxStr);
                  const firstItemOnRow = items.find((it) => it.targetRowIndex === rIdx);
                  const rowTitle = rows[rIdx]?.title || (firstItemOnRow ? firstItemOnRow.file.name.replace(/\.[^/.]+$/, "") : `句段 ${rIdx + 1}`);
                  return (
                    <span key={rIdx} style={{ color: "#38bdf8", fontWeight: 600 }}>
                      第 {rIdx + 1} 行 ({rowTitle}): {count} 个文件 (多文件自动融合)
                    </span>
                  );
                });
            })()}
          </div>
        )}

        <div className="integrated-multi-audio-footer">
          <button type="button" className="integrated-modal-cancel-btn" onClick={onClose}>
            取消
          </button>
          <button type="button" className="integrated-modal-confirm-btn" onClick={handleConfirm}>
            确定导入并整合
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
