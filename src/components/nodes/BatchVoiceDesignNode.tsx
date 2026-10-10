import type { BatchVoiceCloneRow } from "../../types/studioAudio";
import type { NodeConfirmOptions } from "../dialogs/NodeConfirmModal";
import type { NodeProps } from "@xyflow/react";
import type { StudioNode } from "../../types/studio";
import { ExcelPasteModal } from "../dialogs/ExcelPasteModal";
import { GAME_CHARACTER_PRESETS, getFormattedNaturalControl } from "../../utils/gamePresets";
import { Handle, Position } from "@xyflow/react";
import { NodeConfirmModal } from "../dialogs/NodeConfirmModal";
import { StudioNodeFrame } from "./StudioNodeFrame";
import { Wand2, ClipboardPaste, Square, Trash2, GripVertical, Copy, ChevronUp, ChevronDown, Loader2, Sparkles, Plus } from "lucide-react";
import { createId } from "../../studio/format";
import { memo, useState, Fragment } from "react";
import { parseTableText } from "../../studio/tableText";
import { useAutoUpdateNodeInternals } from "../../studio/nodeInternals";

export const BatchVoiceDesignNode = memo(function BatchVoiceDesignNode({ id, data }: NodeProps<StudioNode>) {
  const rows = data.batchRows || [
    { id: `${id}_row_1`, title: "句段 1", instruction: "30岁成熟女性，声音温润清亮，具有优雅自然的旁白质感", naturalControl: "角色：旁白/讲述人\n指导：沉静自然", text: "今天我们验证批量音色创造的第一条生成句段。" },
    { id: `${id}_row_2`, title: "句段 2", instruction: "40岁中年男性，嗓音低沉有磁性，语气稳重沉稳", naturalControl: "角色：老掌柜\n指导：温和沧桑", text: "这是批量生成的第二条音色创造句段。" }
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
      naturalControl: rows[rows.length - 1]?.naturalControl || "",
      voiceStyle: rows[rows.length - 1]?.voiceStyle || "",
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
      message: "确定要清空当前批量音色设计表格中的所有行吗？表格将重置为单个初始句段。",
      confirmLabel: "清空表格",
      cancelLabel: "取消",
      isDestructive: true,
      onConfirm: () => {
        patchRows([
          { id: createId("row"), title: "句段 1", instruction: "", naturalControl: "", voiceStyle: "", text: "" }
        ]);
        setNodeConfirm(null);
      },
      onCancel: () => setNodeConfirm(null)
    });
  }

  function handleClearColumn(field: "instruction" | "naturalControl" | "voiceStyle" | "text", label: string) {
    const hasContent = rows.some((r) => Boolean((r[field] || "").trim()));
    if (!hasContent) {
      setPasteToast(`「${label}」列已经是空的`);
      setTimeout(() => setPasteToast(null), 2000);
      return;
    }
    setNodeConfirm({
      title: `清空「${label}」`,
      message: `确定要清空所有行的「${label}」内容吗？此操作无法撤销。`,
      confirmLabel: "清空",
      cancelLabel: "取消",
      isDestructive: true,
      onConfirm: () => {
        const nextRows = rows.map((r) => ({
          ...r,
          [field]: ""
        }));
        patchRows(nextRows);
        setPasteToast(`✨ 已清空所有行的${label}！`);
        setTimeout(() => setPasteToast(null), 2500);
        setNodeConfirm(null);
      },
      onCancel: () => setNodeConfirm(null)
    });
  }

  function handleUpdateRow(rowId: string, field: keyof BatchVoiceCloneRow, value: string) {
    patchRows(
      rows.map((r) => (r.id === rowId ? { ...r, [field]: value } : r))
    );
  }

  function handleImportFromExcel(
    importedRows: BatchVoiceCloneRow[],
    mode: "replace" | "append",
    activeFields?: Array<keyof BatchVoiceCloneRow>
  ) {
    if (mode === "replace") {
      const fieldsToUpdate = activeFields && activeFields.length > 0
        ? activeFields
        : (["title", "instruction", "naturalControl", "voiceStyle", "text"] as Array<keyof BatchVoiceCloneRow>);

      const mergedRows = importedRows.map((imported, i) => {
        const existing = rows[i];
        if (existing) {
          const updatedRow = { ...existing };
          fieldsToUpdate.forEach((field) => {
            if (field in imported) {
              (updatedRow as any)[field] = imported[field];
            }
          });
          return updatedRow;
        }
        return imported;
      });
      patchRows(mergedRows);
    } else {
      patchRows([...rows, ...importedRows]);
    }
    setPasteToast(`已成功表格导入 ${importedRows.length} 条数据！`);
    setTimeout(() => setPasteToast(null), 3500);
  }

  function handlePasteAtRow(
    startIndex: number,
    field: "title" | "instruction" | "naturalControl" | "voiceStyle" | "text",
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

        if (cols.length >= 5) {
          item.title = cols[0];
          item.instruction = cols[1];
          item.naturalControl = cols[2];
          item.voiceStyle = cols[3];
          item.text = cols[4];
        } else if (cols.length === 4) {
          item.title = cols[0];
          item.instruction = cols[1];
          item.naturalControl = cols[2];
          item.text = cols[3];
        } else if (cols.length === 3) {
          item.title = cols[0];
          item.instruction = cols[1];
          item.text = cols[2];
        } else if (cols.length === 2) {
          if (/^(VO_|ID_|#|[A-Za-z0-9_-]{3,15}$)/i.test(cols[0]) && !cols[0].includes(" ")) {
            item.title = cols[0];
            item.text = cols[1];
          } else {
            item.voiceStyle = cols[0];
            item.text = cols[1];
          }
        } else {
          item[field] = cols[0];
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
            instruction: item.instruction || "",
            naturalControl: item.naturalControl || "",
            voiceStyle: item.voiceStyle || "",
            text: item.text || ""
          });
        }
      });

      patchRows(updatedRows);
      setPasteToast(`已成功识别并直接粘贴填充了 ${parsedGrid.length} 行数据！`);
      setTimeout(() => setPasteToast(null), 3000);
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
    e.preventDefault();
    e.stopPropagation();
    const rawCustom = e.dataTransfer.getData("application/x-batch-row-index");
    const rawPlain = e.dataTransfer.getData("text/plain");
    let sourceIndex = draggedIndex;
    if (rawCustom !== "") {
      const parsed = parseInt(rawCustom, 10);
      if (!isNaN(parsed)) sourceIndex = parsed;
    } else if (rawPlain !== "") {
      const clean = rawPlain.replace(/[^0-9]/g, "");
      const parsed = parseInt(clean, 10);
      if (!isNaN(parsed)) sourceIndex = parsed;
    }
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
      icon={<Wand2 size={17} />}
      tone="batch-design"
      style={{
        minHeight: isExcelPasteOpen ? 460 : undefined,
        transition: "min-height 0.22s cubic-bezier(0.16, 1, 0.3, 1)"
      }}
    >
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
            style={{ fontSize: 12, height: 28, padding: "2px 6px", width: 135, maxWidth: 140 }}
            value=""
            onChange={(e) => {
              const val = e.target.value;
              if (!val) return;
              if (val === "all_zh") {
                const nextRows = GAME_CHARACTER_PRESETS.map((p, i) => ({
                  id: `row_${Date.now()}_${i}`,
                  title: p.nameZh,
                  instruction: p.voiceDescriptionEn,
                  naturalControl: getFormattedNaturalControl(p),
                  text: p.dialogueZh
                }));
                patchRows(nextRows);
                setPasteToast("已填入全套 8 位游戏角色音色设计 (中文对白)！");
                setTimeout(() => setPasteToast(null), 3000);
                return;
              }
              if (val === "all_en") {
                const nextRows = GAME_CHARACTER_PRESETS.map((p, i) => ({
                  id: `row_${Date.now()}_${i}`,
                  title: p.nameZh,
                  instruction: p.voiceDescriptionEn,
                  naturalControl: getFormattedNaturalControl(p),
                  text: p.dialogueEn
                }));
                patchRows(nextRows);
                setPasteToast("已填入全套 8 位游戏角色音色设计 (English 对白)！");
                setTimeout(() => setPasteToast(null), 3000);
                return;
              }
              const isEn = val.endsWith("_en");
              const charId = val.replace(/_(?:zh|en)$/, "").replace("game_", "");
              const p = GAME_CHARACTER_PRESETS.find((c) => c.id === charId);
              if (p) {
                const newRow: BatchVoiceCloneRow = {
                  id: `row_${Date.now()}`,
                  title: p.nameZh,
                  instruction: p.voiceDescriptionEn,
                  naturalControl: getFormattedNaturalControl(p),
                  text: isEn ? p.dialogueEn : p.dialogueZh
                };
                if (rows.length <= 1 && (!rows[0]?.text && !rows[0]?.instruction && !rows[0]?.naturalControl)) {
                  patchRows([newRow]);
                } else {
                  patchRows([...rows, newRow]);
                }
                setPasteToast(`已填入【${p.nameZh}】音色设计(${isEn ? "EN" : "中文"})！`);
                setTimeout(() => setPasteToast(null), 3000);
              }
            }}
            title="选择游戏音色设计预设（官方支持多语种）"
          >
            <option value="">🎮 角色预设...</option>
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
          {rows.length > 1 || rows[0]?.text || rows[0]?.instruction || rows[0]?.naturalControl || rows[0]?.voiceStyle ? (
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

      <div className="batch-table-header design-mode nodrag">
        <div className="batch-col-meta">
          <span>音色创造</span>
        </div>
        <div className="batch-col-style batch-col-header-cell">
          <span className="batch-col-header-title">音色描述词</span>
          <button
            type="button"
            className="batch-col-clear-btn design-mode"
            onClick={() => handleClearColumn("instruction", "音色描述词")}
            title="一键清空整列「音色描述词」"
          >
            <Trash2 size={10} />
            <span>清空</span>
          </button>
        </div>
        <div className="batch-col-style batch-col-header-cell">
          <span className="batch-col-header-title">自然语言控制</span>
          <button
            type="button"
            className="batch-col-clear-btn design-mode"
            onClick={() => handleClearColumn("naturalControl", "自然语言控制")}
            title="一键清空整列「自然语言控制」"
          >
            <Trash2 size={10} />
            <span>清空</span>
          </button>
        </div>
        <div className="batch-col-style batch-col-header-cell">
          <span className="batch-col-header-title">语音风格</span>
          <button
            type="button"
            className="batch-col-clear-btn design-mode"
            onClick={() => handleClearColumn("voiceStyle", "语音风格")}
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
            className="batch-col-clear-btn design-mode"
            onClick={() => handleClearColumn("text", "音频文本")}
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
            className={`batch-row-card design-mode ${draggedIndex === index ? "is-dragging" : ""} ${dragOverIndex === index && draggedIndex !== index ? "is-drag-over" : ""}`}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDragEnd={handleDragEnd}
            onDrop={(e) => handleDropRow(e, index)}
          >
            <div className="batch-row-meta-col">
              <div className="batch-row-meta-top">
                <span
                  className="batch-row-drag-handle node-muted"
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
                placeholder="输入音色描述词..."
              />
            </div>

            <div className="batch-row-style-col">
              <textarea
                className="nodrag nopan nowheel"
                value={row.naturalControl || ""}
                draggable={false}
                onDragStart={(e) => e.stopPropagation()}
                onChange={(e) => handleUpdateRow(row.id, "naturalControl", e.target.value)}
                onPaste={(e) => handlePasteAtRow(index, "naturalControl", e)}
                rows={2}
                placeholder="输入自然语言控制..."
              />
            </div>

            <div className="batch-row-style-col">
              <textarea
                className="nodrag nopan nowheel"
                value={row.voiceStyle || ""}
                draggable={false}
                onDragStart={(e) => e.stopPropagation()}
                onChange={(e) => handleUpdateRow(row.id, "voiceStyle", e.target.value)}
                onPaste={(e) => handlePasteAtRow(index, "voiceStyle", e)}
                rows={2}
                placeholder="输入语音风格 (导演文本/语气)..."
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
                className={data.singleRunningRowId === row.id ? "batch-row-single-clone-btn design-btn is-running is-generating" : "batch-row-single-clone-btn design-btn"}
                onClick={() => data.onRunSingleRowBatchVoiceDesign?.(id, row.id)}
                disabled={data.isRunning || data.singleRunningRowId === row.id || !row.text.trim()}
                title="单条创造：仅生成此行音色音频并精准更新至专属产物节点"
              >
                {data.singleRunningRowId === row.id ? (
                  <Loader2 size={14} className="spin-icon spin" />
                ) : (
                  <Sparkles size={13} />
                )}
                <span>{data.singleRunningRowId === row.id ? "生成中" : "单生成"}</span>
              </button>
            </div>
          </div>
        ))}

        <button type="button" className="batch-add-row-btn" onClick={handleAddRow}>
          <Plus size={14} /> 加一行 音色创造、描述词、自然控制、语音风格、音频文本
        </button>
      </div>

      {data.error ? <p className="node-error">{data.error}</p> : null}

      <button
        className={data.isRunning ? "run-button design-mode-run nodrag is-running is-generating" : "run-button design-mode-run nodrag"}
        type="button"
        onClick={() => data.onRunBatchVoiceDesign?.(id)}
        disabled={data.isRunning}
        style={{ marginTop: 12 }}
      >
        {data.isRunning ? <Loader2 className="spin" size={16} /> : <Wand2 size={16} />}
        {data.isRunning ? "正在批量生成音色创造..." : "运行批量音色创造"}
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
