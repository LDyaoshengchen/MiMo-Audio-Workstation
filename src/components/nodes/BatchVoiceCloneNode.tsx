import type { BatchVoiceCloneRow } from "../../types/studioAudio";
import type { NodeConfirmOptions } from "../dialogs/NodeConfirmModal";
import type { NodeProps } from "@xyflow/react";
import type { StudioNode } from "../../types/studio";
import { AudioLines, ClipboardPaste, Square, Trash2, GripVertical, Copy, ChevronUp, ChevronDown, Loader2, Sparkles, Plus } from "lucide-react";
import { ExcelPasteModal } from "../dialogs/ExcelPasteModal";
import { GAME_CHARACTER_PRESETS } from "../../utils/gamePresets";
import { Handle, Position } from "@xyflow/react";
import { NodeConfirmModal } from "../dialogs/NodeConfirmModal";
import { StudioNodeFrame } from "./StudioNodeFrame";
import { GenerationButtonText } from "../GenerationButtonText";
import { RoleVoiceLibrary } from "../studio/RoleVoiceLibrary";
import { createId } from "../../studio/format";
import { memo, useState, Fragment } from "react";
import { parseTableText } from "../../studio/tableText";
import { useAutoUpdateNodeInternals } from "../../studio/nodeInternals";

export const BatchVoiceCloneNode = memo(function BatchVoiceCloneNode({ id, data }: NodeProps<StudioNode>) {
  const rows = data.batchRows || [
    { id: `${id}_row_1`, title: "句段 1", instruction: "自然、清晰的讲述感", text: "今天我们验证批量音频克隆的第一条生成句段。" },
    { id: `${id}_row_2`, title: "句段 2", instruction: "轻松自然的语调", text: "这是批量生成的第二条句段，声音连贯稳定。" }
  ];

  const [isExcelPasteOpen, setIsExcelPasteOpen] = useState(false);
  const [pasteToast, setPasteToast] = useState<string | null>(null);
  const [nodeConfirm, setNodeConfirm] = useState<NodeConfirmOptions | null>(null);

  useAutoUpdateNodeInternals(id, [rows.length]);

  function patchRows(newRows: BatchVoiceCloneRow[]) {
    data.onPatch?.(id, { batchRows: newRows });
  }

  function handleAddRow() {
    const nextNum = rows.length + 1;
    const newRow: BatchVoiceCloneRow = {
      id: createId("row"),
      title: `句段 ${nextNum}`,
      instruction: rows[rows.length - 1]?.instruction || "",
      text: ""
    };
    patchRows([...rows, newRow]);
  }

  function handleRemoveRow(rowId: string) {
    if (rows.length <= 1) return;
    patchRows(rows.filter((r) => r.id !== rowId));
  }

  function handleDuplicateRow(index: number) {
    const target = rows[index];
    if (!target) return;
    const newRow = {
      ...target,
      id: createId("row"),
      title: `${target.title}_副本`
    };
    const nextRows = [...rows];
    nextRows.splice(index + 1, 0, newRow);
    patchRows(nextRows);
  }

  function handleMoveRow(index: number, direction: "up" | "down") {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= rows.length) return;
    const nextRows = [...rows];
    const [moved] = nextRows.splice(index, 1);
    nextRows.splice(targetIndex, 0, moved);
    patchRows(nextRows);
  }

  function handleClearRows() {
    setNodeConfirm({
      title: "清空所有行数据",
      message: "确定要清空当前批量音色克隆表格中的所有行吗？表格将重置为单个初始句段。",
      confirmLabel: "清空表格",
      cancelLabel: "取消",
      isDestructive: true,
      onConfirm: () => {
        patchRows([
          { id: createId("row"), title: "句段 1", instruction: "", text: "" }
        ]);
        setNodeConfirm(null);
      },
      onCancel: () => setNodeConfirm(null)
    });
  }

  function handleClearColumn(columnType: "style" | "text") {
    if (columnType === "style") {
      const hasContent = rows.some((r) => Boolean((r.instruction || r.voiceStyle || "").trim()));
      if (!hasContent) {
        setPasteToast("「语音风格」列已经是空的");
        setTimeout(() => setPasteToast(null), 2000);
        return;
      }
      setNodeConfirm({
        title: "清空「语音风格」",
        message: "确定要清空所有行的「语音风格」吗？此操作无法撤销。",
        confirmLabel: "清空",
        cancelLabel: "取消",
        isDestructive: true,
        onConfirm: () => {
          const nextRows = rows.map((r) => ({
            ...r,
            instruction: "",
            voiceStyle: ""
          }));
          patchRows(nextRows);
          setPasteToast("✨ 已清空所有行的语音风格！");
          setTimeout(() => setPasteToast(null), 2500);
          setNodeConfirm(null);
        },
        onCancel: () => setNodeConfirm(null)
      });
    } else if (columnType === "text") {
      const hasContent = rows.some((r) => Boolean(r.text?.trim()));
      if (!hasContent) {
        setPasteToast("「音频文本」列已经是空的");
        setTimeout(() => setPasteToast(null), 2000);
        return;
      }
      setNodeConfirm({
        title: "清空「音频文本」",
        message: "确定要清空所有行的「音频文本」吗？此操作无法撤销。",
        confirmLabel: "清空",
        cancelLabel: "取消",
        isDestructive: true,
        onConfirm: () => {
          const nextRows = rows.map((r) => ({
            ...r,
            text: ""
          }));
          patchRows(nextRows);
          setPasteToast("✨ 已清空所有行的音频文本！");
          setTimeout(() => setPasteToast(null), 2500);
          setNodeConfirm(null);
        },
        onCancel: () => setNodeConfirm(null)
      });
    }
  }

  function handleUpdateRow(rowId: string, field: keyof BatchVoiceCloneRow, value: string) {
    patchRows(
      rows.map((r) => {
        if (r.id !== rowId) return r;
        if (field === "instruction" || field === "voiceStyle") {
          return { ...r, instruction: value, voiceStyle: value };
        }
        return { ...r, [field]: value };
      })
    );
  }

  function handleImportFromExcel(
    importedRows: BatchVoiceCloneRow[],
    mode: "replace" | "append",
    activeFields?: Array<keyof BatchVoiceCloneRow>
  ) {
    const normalizedImported = importedRows.map((r) => {
      const val = r.instruction || r.voiceStyle || "";
      return {
        ...r,
        instruction: val,
        voiceStyle: val
      };
    });

    if (mode === "replace") {
      const fieldsToUpdate = activeFields && activeFields.length > 0
        ? Array.from(new Set([...activeFields, "instruction" as keyof BatchVoiceCloneRow, "voiceStyle" as keyof BatchVoiceCloneRow]))
        : (["title", "instruction", "naturalControl", "voiceStyle", "text"] as Array<keyof BatchVoiceCloneRow>);

      const mergedRows = normalizedImported.map((imported, i) => {
        const existing = rows[i];
        if (existing) {
          const updatedRow = { ...existing };
          fieldsToUpdate.forEach((field) => {
            if (field in imported) {
              (updatedRow as any)[field] = imported[field];
            }
          });
          if (updatedRow.voiceStyle && !updatedRow.instruction) {
            updatedRow.instruction = updatedRow.voiceStyle;
          } else if (updatedRow.instruction && !updatedRow.voiceStyle) {
            updatedRow.voiceStyle = updatedRow.instruction;
          }
          return updatedRow;
        }
        return imported;
      });
      patchRows(mergedRows);
    } else {
      patchRows([...rows, ...normalizedImported]);
    }
    setPasteToast(`已成功表格导入 ${importedRows.length} 条数据！`);
    setTimeout(() => setPasteToast(null), 3500);
  }

  function handlePasteAtRow(
    startIndex: number,
    field: "title" | "instruction" | "voiceStyle" | "text",
    event: React.ClipboardEvent
  ) {
    const pasteText = event.clipboardData.getData("text/plain");
    if (!pasteText) return;

    const hasTabs = pasteText.includes("\t");

    if (hasTabs) {
      event.preventDefault();
      const parsedGrid = parseTableText(pasteText);
      const updatedRows = [...rows];

      parsedGrid.forEach((cols, offset) => {
        const idx = startIndex + offset;
        const item: Partial<BatchVoiceCloneRow> = {};

        if (cols.length >= 3) {
          item.title = cols[0];
          item.instruction = cols[1];
          item.voiceStyle = cols[1];
          item.text = cols[2];
        } else if (cols.length === 2) {
          if (/^(VO_|ID_|#|[A-Za-z0-9_-]{3,15}$)/i.test(cols[0]) && !cols[0].includes(" ")) {
            item.title = cols[0];
            item.text = cols[1];
          } else {
            item.instruction = cols[0];
            item.voiceStyle = cols[0];
            item.text = cols[1];
          }
        } else {
          item[field === "voiceStyle" ? "instruction" : field] = cols[0];
          if (field === "instruction" || field === "voiceStyle") {
            item.instruction = cols[0];
            item.voiceStyle = cols[0];
          }
        }

        if (idx < updatedRows.length) {
          updatedRows[idx] = {
            ...updatedRows[idx],
            ...item
          };
        } else {
          updatedRows.push({
            id: createId("row"),
            title: item.title || `句段 ${idx + 1}`,
            instruction: item.instruction || item.voiceStyle || "",
            text: item.text || ""
          });
        }
      });

      patchRows(updatedRows);
      setPasteToast(`自动从剪贴板表格更新了 ${parsedGrid.length} 行！`);
      setTimeout(() => setPasteToast(null), 3500);
    }
  }

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  function handleDragStart(e: React.DragEvent, index: number) {
    e.stopPropagation();
    e.dataTransfer.setData("application/x-batch-row-index", String(index));
    e.dataTransfer.setData("text/plain", String(index));
    e.dataTransfer.effectAllowed = "move";
    setDraggedIndex(index);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    if (draggedIndex === null) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  }

  function handleDragLeave(e: React.DragEvent) {
    e.stopPropagation();
  }

  function handleDragEnd(e: React.DragEvent) {
    e.stopPropagation();
    setDraggedIndex(null);
    setDragOverIndex(null);
  }

  function handleDropRow(e: React.DragEvent, targetIndex: number) {
    if (draggedIndex === null) return;
    e.preventDefault();
    e.stopPropagation();
    const sourceIndex = draggedIndex;
    setDraggedIndex(null);
    setDragOverIndex(null);
    if (sourceIndex === null || sourceIndex === undefined || isNaN(sourceIndex) || sourceIndex === targetIndex) return;

    const nextRows = [...rows];
    const [moved] = nextRows.splice(sourceIndex, 1);
    nextRows.splice(targetIndex, 0, moved);
    patchRows(nextRows);
  }

  return (
    <StudioNodeFrame
      id={id}
      data={data}
      icon={<AudioLines size={17} />}
      tone="batch-clone"
      style={{
        minHeight: isExcelPasteOpen ? 460 : undefined,
        transition: "min-height 0.22s cubic-bezier(0.16, 1, 0.3, 1)"
      }}
    >
      <Handle type="target" position={Position.Left} id="voice" className="node-handle" style={{ top: "50%" }} />
      <span className="input-handle-label" style={{ top: "50%" }}>参考</span>
      <Handle type="source" position={Position.Right} id="output" className="node-handle" style={{ top: "50%" }} />

      <div className="batch-toolbar-row nodrag">
        <button
          type="button"
          className="batch-excel-paste-btn"
          onClick={() => setIsExcelPasteOpen(true)}
          title="从 Excel / 飞书 / 腾讯文档批量复制并粘贴导入"
        >
          <ClipboardPaste size={14} /> 📋 从 Excel / 表格一键粘贴...
        </button>
        <div className="clone-toolbar" style={{ marginTop: 0, padding: 0 }}>
          <select
            className="clone-preset-select"
            value=""
            onChange={(e) => {
              const val = e.target.value;
              if (!val) return;
              if (val === "all_zh") {
                const nextRows = GAME_CHARACTER_PRESETS.map((p, i) => ({
                  id: `row_${Date.now()}_${i}`,
                  title: `${p.nameZh} (${p.categoryZh})`,
                  instruction: p.directionEn,
                  text: p.dialogueZh
                }));
                patchRows(nextRows);
                setPasteToast("已填入全套 8 位游戏角色 (中文对白)！");
                setTimeout(() => setPasteToast(null), 3000);
                return;
              }
              if (val === "all_en") {
                const nextRows = GAME_CHARACTER_PRESETS.map((p, i) => ({
                  id: `row_${Date.now()}_${i}`,
                  title: `${p.nameZh} (${p.categoryZh})`,
                  instruction: p.directionEn,
                  text: p.dialogueEn
                }));
                patchRows(nextRows);
                setPasteToast("已填入全套 8 位游戏角色 (English 对白)！");
                setTimeout(() => setPasteToast(null), 3000);
                return;
              }
              const isEn = val.endsWith("_en");
              const charId = val.replace(/_(?:zh|en)$/, "").replace("game_", "");
              const p = GAME_CHARACTER_PRESETS.find((c) => c.id === charId);
              if (p) {
                const newRow: BatchVoiceCloneRow = {
                  id: `row_${Date.now()}`,
                  title: `${p.nameZh} (${p.categoryZh})`,
                  instruction: p.directionEn,
                  text: isEn ? p.dialogueEn : p.dialogueZh
                };
                if (rows.length <= 1 && (!rows[0]?.text && !rows[0]?.instruction)) {
                  patchRows([newRow]);
                } else {
                  patchRows([...rows, newRow]);
                }
                setPasteToast(`已填入【${p.nameZh}】(${isEn ? "EN" : "中文"})！`);
                setTimeout(() => setPasteToast(null), 3000);
              }
            }}
            title="选择游戏角色预设（官方支持多语种）"
          >
            <option value="">🎮 角色预设</option>
            <optgroup label="🎮 官方多语种角色预设 (支持中/英/日/韩等语种)">
              {GAME_CHARACTER_PRESETS.map((p) => (
                <Fragment key={p.id}>
                  <option value={`game_${p.id}_zh`}>{p.avatar} {p.nameZh} (中)</option>
                  <option value={`game_${p.id}_en`}>{p.avatar} {p.nameZh} (英)</option>
                </Fragment>
              ))}
            </optgroup>
            <optgroup label="⚡ 一键整套载入">
              <option value="all_zh">🌟 一键载入全套 8 位角色 (中文对白)</option>
              <option value="all_en">🌟 一键载入全套 8 位角色 (English 对白)</option>
            </optgroup>
          </select>
          <RoleVoiceLibrary nodeId={id} data={data} />
        </div>
        <div style={{ display: "flex", gap: 6, marginLeft: "auto", flexShrink: 0 }}>
          {data.isRunning ? (
            <button
              type="button"
              className="batch-abort-btn"
              onClick={() => {
                data.onPatch?.(id, { isRunning: false, error: "用户已手动暂停/中断生成。" });
              }}
              title="一键暂停/中断当前正在运行的批量生成任务"
            >
              <Square size={12} /> 暂停生成
            </button>
          ) : null}
          {rows.length > 1 || rows[0]?.text || rows[0]?.instruction ? (
            <button
              type="button"
              className="batch-clear-btn"
              onClick={handleClearRows}
              title="清空表格"
            >
              <Trash2 size={12} /> 清空
            </button>
          ) : null}
        </div>
      </div>

      {pasteToast ? (
        <div className="batch-paste-toast nodrag">
          ✨ {pasteToast}
        </div>
      ) : null}

      <div className="batch-table-header nodrag">
        <div className="batch-col-meta">
          <span>音频克隆</span>
        </div>
        <div className="batch-col-style batch-col-header-cell">
          <span className="batch-col-header-title">语音风格</span>
          <button
            type="button"
            className="batch-col-clear-btn"
            onClick={() => handleClearColumn("style")}
            title="一键清空整列「语音风格」"
          >
            <Trash2 size={10} />
            <span>清空</span>
          </button>
        </div>
        <div className="batch-col-text batch-col-header-cell">
          <span className="batch-col-header-title">音频文本</span>
          <button
            type="button"
            className="batch-col-clear-btn"
            onClick={() => handleClearColumn("text")}
            title="一键清空整列「音频文本」"
          >
            <Trash2 size={10} />
            <span>清空</span>
          </button>
        </div>
        <div className="batch-col-action">操作</div>
      </div>

      <div className={`batch-row-list nodrag ${draggedIndex !== null ? "is-dragging-active" : ""}`}>
        {rows.map((row, index) => (
          <div
            key={row.id}
            className={`batch-row-card ${draggedIndex === index ? "is-dragging" : ""} ${dragOverIndex === index && draggedIndex !== index ? "is-drag-over" : ""}`}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDragEnd={handleDragEnd}
            onDrop={(e) => handleDropRow(e, index)}
          >
            <div className="batch-row-meta-col">
              <div className="batch-row-meta-top">
                <span
                  className="batch-row-drag-handle node-muted"
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 3,
                    cursor: "grab",
                    userSelect: "none",
                    WebkitUserSelect: "none"
                  }}
                  title="按住拖拽可上下排序"
                >
                  <GripVertical size={13} style={{ color: "var(--accent-color, #0a84ff)" }} /> #{index + 1}
                </span>
                <div style={{ display: "flex", gap: 2, marginLeft: "auto" }}>
                  <button
                    type="button"
                    className="batch-row-remove-btn"
                    onClick={() => handleDuplicateRow(index)}
                    title="复制此行"
                  >
                    <Copy size={11} />
                  </button>
                  <button
                    type="button"
                    className="batch-row-remove-btn"
                    disabled={index === 0}
                    onClick={() => handleMoveRow(index, "up")}
                    title="向上移动"
                  >
                    <ChevronUp size={11} />
                  </button>
                  <button
                    type="button"
                    className="batch-row-remove-btn"
                    disabled={index === rows.length - 1}
                    onClick={() => handleMoveRow(index, "down")}
                    title="向下移动"
                  >
                    <ChevronDown size={11} />
                  </button>
                  {rows.length > 1 ? (
                    <button
                      type="button"
                      className="batch-row-remove-btn"
                      onClick={() => handleRemoveRow(row.id)}
                      title="删除此行"
                    >
                      <Trash2 size={11} />
                    </button>
                  ) : null}
                </div>
              </div>
              <input
                className="batch-row-title-input nodrag nopan nowheel"
                value={row.title}
                draggable={false}
                onDragStart={(e) => e.stopPropagation()}
                onChange={(e) => handleUpdateRow(row.id, "title", e.target.value)}
                onPaste={(e) => handlePasteAtRow(index, "title", e)}
                placeholder="标识/名字"
                title="名字/标识（可直接从 Excel 粘贴多列数据）"
              />
            </div>

            <div className="batch-row-style-col">
              <textarea
                className="nodrag nopan nowheel"
                value={row.instruction}
                draggable={false}
                onDragStart={(e) => e.stopPropagation()}
                onChange={(e) => handleUpdateRow(row.id, "instruction", e.target.value)}
                onPaste={(e) => handlePasteAtRow(index, "instruction", e)}
                rows={2}
                placeholder="输入语音风格 (导演文本)..."
              />
            </div>

            <div className="batch-row-text-col">
              <textarea
                className="nodrag nopan nowheel"
                value={row.text}
                draggable={false}
                onDragStart={(e) => e.stopPropagation()}
                onChange={(e) => handleUpdateRow(row.id, "text", e.target.value)}
                onPaste={(e) => handlePasteAtRow(index, "text", e)}
                rows={2}
                placeholder="输入音频文本..."
              />
            </div>

            <div className="batch-row-action-col">
              <button
                type="button"
                className={data.singleRunningRowId === row.id ? "batch-row-single-clone-btn is-running is-generating" : "batch-row-single-clone-btn"}
                onClick={() => data.onRunSingleRowBatchVoiceClone?.(id, row.id)}
                disabled={data.isRunning || data.singleRunningRowId === row.id || !row.text.trim()}
                title="单条克隆：仅生成此行音频并精准更新至专属产物节点"
              >
                {data.singleRunningRowId === row.id ? (
                  <Loader2 size={14} className="spin-icon spin" />
                ) : (
                  <Sparkles size={13} />
                )}
                <span>{data.singleRunningRowId === row.id ? "克隆中" : "单生成"}</span>
              </button>
            </div>
          </div>
        ))}

        <button type="button" className="batch-add-row-btn" onClick={handleAddRow}>
          <Plus size={14} /> 加一行 音频克隆、语音风格、音频文本
        </button>
      </div>

      {data.error ? <p className="node-error">{data.error}</p> : null}

      <button
        className={data.isRunning ? "run-button nodrag is-running is-generating" : "run-button nodrag"}
        type="button"
        onClick={() => data.onRunBatchVoiceClone?.(id)}
        disabled={data.isRunning}
        style={{ marginTop: 12 }}
      >
        {data.isRunning ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />}
        <GenerationButtonText data={data} idle="运行批量克隆" />
      </button>

      {nodeConfirm ? <NodeConfirmModal options={nodeConfirm} /> : null}
      {isExcelPasteOpen ? (
        <ExcelPasteModal
          onClose={() => setIsExcelPasteOpen(false)}
          onImport={handleImportFromExcel}
        />
      ) : null}
    </StudioNodeFrame>
  );
});
