import type { BatchVoiceCloneRow, ArtifactData } from "../../types/studioAudio";
import type { NodeConfirmOptions } from "../dialogs/NodeConfirmModal";
import type { NodeProps } from "@xyflow/react";
import type { StudioNode } from "../../types/studio";
import { BatchAudioUploadModal } from "../dialogs/BatchAudioUploadModal";
import { ExcelPasteModal } from "../dialogs/ExcelPasteModal";
import { IntegratedPipelineRow } from "../IntegratedPipelineRow";
import { NodeConfirmModal } from "../dialogs/NodeConfirmModal";
import { Sparkles, Mic, Upload, AudioLines, ClipboardPaste, Plus, Trash2, Archive, Download, Loader2, Zap } from "lucide-react";
import { StudioNodeFrame } from "./StudioNodeFrame";
import { WindowedList } from "../WindowedList";
import { ZipExportProgress } from "../ZipExportProgress";
import { createId } from "../../studio/format";
import { memo, useState, useRef, ChangeEvent, useMemo } from "react";
import { mergeAudioFiles, blobToDataUrl } from "../../studio/audio";
import { parseTableText } from "../../studio/tableText";
import { sanitizeFileName, getArtifactDownloadFileName, formatHierarchyName } from "../../utils/audioNaming";
import { useAudioZipExport } from "../../utils/useAudioZipExport";
import { useAutoUpdateNodeInternals } from "../../studio/nodeInternals";
import { useStableEvent } from "../../utils/useStableEvent";

export const IntegratedStudioNode = memo(function IntegratedStudioNode({ id, data, selected }: NodeProps<StudioNode>) {
  const rows = data.batchRows || [
    { id: `${id}_row_1`, title: "句段 1", instruction: "自然、清晰的讲述感", text: "今天我们验证全能综合工作台的第一条生成句段。" },
    { id: `${id}_row_2`, title: "句段 2", instruction: "轻松自然的语调", text: "这是全能综合工作台的第二条生成句段，自动分行生成产物。" }
  ];

  const [isExcelPasteOpen, setIsExcelPasteOpen] = useState(false);
  const [isBatchAudioModalOpen, setIsBatchAudioModalOpen] = useState(false);
  const [pasteToast, setPasteToast] = useState<string | null>(null);
  const [nodeConfirm, setNodeConfirm] = useState<NodeConfirmOptions | null>(null);
  const [recordingRowId, setRecordingRowId] = useState<string | null>(null);
  const [recordSec, setRecordSec] = useState(0);
  const zipExport = useAudioZipExport();
  const isZipping = zipExport.isZipping;
  const [draggingRefRowId, setDraggingRefRowId] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

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
      text: "",
      artifacts: []
    };
    patchRows([...rows, newRow]);
  }

  function handleRemoveRow(rowId: string) {
    if (rows.length <= 1) return;
    patchRows(rows.filter((r) => r.id !== rowId));
  }

  function handleClearRows() {
    setNodeConfirm({
      title: "清空所有行数据",
      message: "确定要清空全能综合工作台中的所有句段吗？表格将重置为单个初始句段。",
      confirmLabel: "清空表格",
      cancelLabel: "取消",
      isDestructive: true,
      onConfirm: () => {
        patchRows([
          { id: createId("row"), title: "句段 1", instruction: "", text: "", artifacts: [] }
        ]);
        setNodeConfirm(null);
      },
      onCancel: () => setNodeConfirm(null)
    });
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
      return { ...r, instruction: val, voiceStyle: val, artifacts: [] };
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
          updatedRows[idx] = { ...updatedRows[idx], ...item };
        } else {
          updatedRows.push({
            id: createId("row"),
            title: item.title || `句段 ${idx + 1}`,
            instruction: item.instruction || item.voiceStyle || "",
            text: item.text || "",
            artifacts: []
          });
        }
      });

      patchRows(updatedRows);
      setPasteToast(`自动从剪贴板表格更新了 ${parsedGrid.length} 行！`);
      setTimeout(() => setPasteToast(null), 3500);
    }
  }

  // Row-level reference audio upload: ONLY targets rowId, merges multiple files into 1 combined reference audio for rowId
  async function handleSingleRowRefAudioUpload(rowId: string, e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (files.length > 1) {
      setPasteToast(`正在自动拼接整合 ${files.length} 个音频文件到本行...`);
    }

    try {
      const merged = await mergeAudioFiles(files);
      patchRows(
        rows.map((r) => {
          if (r.id !== rowId) return r;
          return {
            ...r,
            refAudioUrl: merged.dataUrl,
            refAudioName: merged.fileName
          };
        })
      );
      if (files.length > 1) {
        setPasteToast(`✨ 成功将 ${files.length} 个音频整合为 1 个参考音频导入本行！`);
        setTimeout(() => setPasteToast(null), 3500);
      }
    } catch (err) {
      alert("音频整合解码失败：" + (err instanceof Error ? err.message : String(err)));
    }
  }

  // Row-level drag & drop: ONLY targets rowId, merges multiple files into 1 combined reference audio for rowId
  async function handleDropRefAudioOnRow(rowId: string, event: React.DragEvent) {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files).filter(
      (f) => f.type.startsWith("audio/") || /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(f.name)
    );
    if (files.length === 0) return;

    if (files.length > 1) {
      setPasteToast(`正在自动拼接整合拖入的 ${files.length} 个音频文件到本行...`);
    }

    try {
      const merged = await mergeAudioFiles(files);
      patchRows(
        rows.map((r) => {
          if (r.id !== rowId) return r;
          return {
            ...r,
            refAudioUrl: merged.dataUrl,
            refAudioName: merged.fileName
          };
        })
      );
      if (files.length > 1) {
        setPasteToast(`✨ 成功将拖入的 ${files.length} 个音频整合为 1 个参考音频导入本行！`);
        setTimeout(() => setPasteToast(null), 3500);
      }
    } catch (err) {
      alert("音频整合解码失败：" + (err instanceof Error ? err.message : String(err)));
    }
  }

  async function handleApplyBatchAudioTable(mappings: { file: File; targetRowIndex: number }[]) {
    if (mappings.length === 0) return;

    const rowGroups: Record<number, File[]> = {};
    mappings.forEach((m) => {
      if (!rowGroups[m.targetRowIndex]) {
        rowGroups[m.targetRowIndex] = [];
      }
      rowGroups[m.targetRowIndex].push(m.file);
    });

    const targetIndices = Object.keys(rowGroups).map(Number).sort((a, b) => a - b);
    setPasteToast(`正在自动分发与拼接整合 ${mappings.length} 个音频文件到 ${targetIndices.length} 个句段行...`);

    const updatedRows = [...rows];
    let maxIdxNeeded = Math.max(...targetIndices);

    while (updatedRows.length <= maxIdxNeeded) {
      const nextNum = updatedRows.length + 1;
      updatedRows.push({
        id: createId("row"),
        title: `句段 ${nextNum}`,
        instruction: updatedRows[updatedRows.length - 1]?.instruction || "",
        text: "",
        artifacts: []
      });
    }

    try {
      for (const targetIdx of targetIndices) {
        const files = rowGroups[targetIdx];
        if (files.length === 1) {
          const dataUrl = await blobToDataUrl(files[0]);
          const cleanName = files[0].name.replace(/\.[^/.]+$/, "");
          updatedRows[targetIdx] = {
            ...updatedRows[targetIdx],
            refAudioUrl: dataUrl,
            refAudioName: files[0].name,
            title: updatedRows[targetIdx].title.startsWith("句段") ? cleanName : updatedRows[targetIdx].title
          };
        } else if (files.length > 1) {
          const merged = await mergeAudioFiles(files);
          const firstClean = files[0].name.replace(/\.[^/.]+$/, "").replace(/[-_]\d+$/, "");
          updatedRows[targetIdx] = {
            ...updatedRows[targetIdx],
            refAudioUrl: merged.dataUrl,
            refAudioName: merged.fileName,
            title: updatedRows[targetIdx].title.startsWith("句段") ? (firstClean || updatedRows[targetIdx].title) : updatedRows[targetIdx].title
          };
        }
      }

      patchRows(updatedRows);
      setPasteToast(`✨ 成功按表格完成 ${mappings.length} 个音频文件的分发与合并导入！`);
      setTimeout(() => setPasteToast(null), 3500);
    } catch (err) {
      alert("音频处理与整合解码失败：" + (err instanceof Error ? err.message : String(err)));
    }
  }

  function handleClearRowRefAudio(rowId: string) {
    patchRows(
      rows.map((r) => {
        if (r.id !== rowId) return r;
        return { ...r, refAudioUrl: undefined, refAudioName: undefined };
      })
    );
  }

  async function startRecordingRow(rowId: string) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        const reader = new FileReader();
        reader.onload = (event) => {
          const dataUrl = event.target?.result as string;
          patchRows(
            rows.map((r) => {
              if (r.id !== rowId) return r;
              return {
                ...r,
                refAudioUrl: dataUrl,
                refAudioName: `录制句段音频_${new Date().toLocaleTimeString().replace(/:/g, "")}.wav`
              };
            })
          );
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setRecordingRowId(rowId);
      setRecordSec(0);
      timerRef.current = window.setInterval(() => {
        setRecordSec((s) => s + 1);
      }, 1000);
    } catch (err) {
      alert("无法开启麦克风录音：" + (err instanceof Error ? err.message : String(err)));
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && recordingRowId) {
      mediaRecorderRef.current.stop();
      setRecordingRowId(null);
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }

  async function handleDownloadAllZip() {
    const folderName = sanitizeFileName(data.title || "全能工作台产物");
    const files = rows.flatMap(row => (row.artifacts || []).map((item, index) => ({
      name: folderName + "/" + getArtifactDownloadFileName(formatHierarchyName(data.title, row.title, item.seqIndex ?? (index + 1)), item.fileName, data.workspaceName),
      source: item.audioDataUrl
    })));
    await zipExport.download(files, folderName + ".zip");
  }

  const recordTimeStr = `${Math.floor(recordSec / 60).toString().padStart(2, "0")}:${(recordSec % 60).toString().padStart(2, "0")}`;

  const onDrop = useStableEvent(handleDropRefAudioOnRow);
  const onClearReference = useStableEvent(handleClearRowRefAudio);
  const onUpload = useStableEvent(handleSingleRowRefAudioUpload);
  const onStopRecording = useStableEvent(stopRecording);
  const onStartRecording = useStableEvent(startRecordingRow);
  const onUpdate = useStableEvent(handleUpdateRow);
  const onPaste = useStableEvent(handlePasteAtRow);
  const onRemove = useStableEvent(handleRemoveRow);
  const onRun = useStableEvent((rowId: string) => data.onRunIntegratedSingleRow?.(id, rowId));
  const onToggleStash = useStableEvent((artifact: ArtifactData) => data.onToggleStashArtifact?.(artifact));
  const onDeleteArtifact = useStableEvent((rowId: string, artifactId: string) => data.onDeleteIntegratedArtifactItem?.(id, rowId, artifactId));
  const rowActions = useMemo(() => ({
    onDragOver: setDraggingRefRowId, onDrop, onClearReference, onUpload, onStopRecording,
    onStartRecording, onUpdate, onPaste, onRemove, onRun
  }), [onDrop, onClearReference, onUpload, onStopRecording, onStartRecording, onUpdate, onPaste, onRemove, onRun]);
  const artifactContext = useMemo(() => ({
    nodeId: id, nodeTitle: data.title, workspaceName: data.workspaceName, settings: data.singleDownloadSettings,
    stashedKeys: data.stashedArtifactKeys, onToggleStash, onDeleteArtifact
  }), [id, data.title, data.workspaceName, data.singleDownloadSettings, data.stashedArtifactKeys, onToggleStash, onDeleteArtifact]);

  return (
    <StudioNodeFrame id={id} data={data} icon={<Sparkles size={17} />} tone="integrated-studio">
      <ZipExportProgress progress={zipExport.progress} onCancel={zipExport.cancel} />

      {pasteToast ? (
        <div className="batch-paste-toast nodrag">
          ✨ {pasteToast}
        </div>
      ) : null}

      {data.error ? <p className="node-error nodrag">{data.error}</p> : null}

      {/* Top 3 Column Headers */}
      <div className="integrated-top-headers nodrag">
        <div className="integrated-header-cell col-1">
          <div className="integrated-header-title-block">
            <Mic size={15} className="integrated-header-icon" />
            <div className="integrated-header-text-stacked">
              <span className="integrated-header-title-main">参考音频</span>
              <span className="integrated-header-title-sub">(上传/录制)</span>
            </div>
          </div>
          <button
            type="button"
            className="integrated-mini-tool integrated-batch-upload-btn"
            onClick={() => setIsBatchAudioModalOpen(true)}
            title="打开批量上传参考音频设置，可选择目标起始行或多文件合并"
          >
            <Upload size={13} />
            <div className="integrated-btn-text-stacked">
              <span className="btn-text-main">批量上传</span>
              <span className="btn-text-sub">(多选)</span>
            </div>
          </button>
        </div>

        <div className="integrated-header-cell col-2">
          <AudioLines size={15} />
          <span>音频克隆 (批量/单生成)</span>
          <div className="integrated-col-tools">
            <button
              type="button"
              className="integrated-mini-tool"
              onClick={() => setIsExcelPasteOpen(true)}
              title="从 Excel / 飞书 / 腾讯文档批量粘贴导入"
            >
              <ClipboardPaste size={12} /> Excel一键粘贴
            </button>
            <button type="button" className="integrated-mini-tool" onClick={handleAddRow} title="加一行">
              <Plus size={12} /> 加一行
            </button>
            <button type="button" className="integrated-mini-tool danger" onClick={handleClearRows} title="清空所有句段">
              <Trash2 size={12} /> 清空
            </button>
          </div>
        </div>

        <div className="integrated-header-cell col-3">
          <Archive size={15} />
          <span>音频产物 (自动按行排列)</span>
          {rows.some((r) => (r.artifacts || []).length > 0) && (
            <button
              type="button"
              className="integrated-mini-tool"
              onClick={() => void handleDownloadAllZip()}
              disabled={isZipping}
              style={{ marginLeft: "auto" }}
            >
              <Download size={12} /> 打包全产物
            </button>
          )}
        </div>
      </div>

      {/* Row-by-Row 3-Column Pipelines List */}
      <WindowedList
        className="integrated-pipeline-rows-list nodrag nopan nowheel"
        items={rows} itemKey={row => row.id} estimatedHeight={252} gap={12}
        pinnedKeys={[recordingRowId, data.singleRunningRowId].filter((key): key is string => !!key)}
        renderItem={(row, index) => (
          <IntegratedPipelineRow row={row} index={index} canRemove={rows.length > 1}
            isDragOver={draggingRefRowId === row.id} isRecording={recordingRowId === row.id}
            isGenerating={data.singleRunningRowId === row.id} isBatchRunning={!!data.isRunning}
            recordTimeStr={recordingRowId === row.id ? recordTimeStr : ""}
            actions={rowActions} artifactContext={artifactContext} />
        )}
      />

      <button
        className={data.isRunning ? "run-button nodrag is-running is-generating" : "run-button nodrag"}
        type="button"
        onClick={() => data.onRunIntegratedBatch?.(id)}
        disabled={data.isRunning}
        style={{ marginTop: 12 }}
      >
        {data.isRunning ? <Loader2 className="spin" size={16} /> : <Zap size={16} />}
        {data.isRunning ? "正在批量全员生成中..." : "运行批量全部生成"}
      </button>

      {nodeConfirm ? <NodeConfirmModal options={nodeConfirm} /> : null}
      {isExcelPasteOpen ? (
        <ExcelPasteModal
          onClose={() => setIsExcelPasteOpen(false)}
          onImport={handleImportFromExcel}
        />
      ) : null}

      {isBatchAudioModalOpen ? (
        <BatchAudioUploadModal
          rows={rows}
          onClose={() => setIsBatchAudioModalOpen(false)}
          onApply={handleApplyBatchAudioTable}
        />
      ) : null}
    </StudioNodeFrame>
  );
});
