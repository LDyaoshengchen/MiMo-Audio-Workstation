import type { BatchVoiceCloneRow } from "../../types/studioAudio";
import { Table, X } from "lucide-react";
import { createId } from "../../studio/format";
import { parseTableText } from "../../studio/tableText";
import { useState, useMemo, useEffect, useRef } from "react";

export function ExcelPasteModal({
  onClose,
  onImport
}: {
  onClose: () => void;
  onImport: (
    parsedRows: BatchVoiceCloneRow[],
    mode: "replace" | "append",
    activeFields: Array<keyof BatchVoiceCloneRow>
  ) => void;
}) {
  const [rawText, setRawText] = useState("");
  const [colMap, setColMap] = useState<("title" | "instruction" | "naturalControl" | "voiceStyle" | "text" | "ignore")[]>(["instruction", "text"]);

  const parsedGrid = useMemo(() => {
    return parseTableText(rawText);
  }, [rawText]);

  const maxCols = useMemo(() => {
    return parsedGrid.reduce((max, row) => Math.max(max, row.length), 0);
  }, [parsedGrid]);

  useEffect(() => {
    if (maxCols === 0) return;
    const initialMap: ("title" | "instruction" | "naturalControl" | "voiceStyle" | "text" | "ignore")[] = [];
    const sampleRow = parsedGrid[0] || [];

    const isHeaderRow = sampleRow.some((cell) =>
      /^(标题|名字|标识|音色描述|描述|自然语言|自然控制|语音风格|风格|导演文本|音频文本|文本|title|instruction|style|text)/i.test(cell)
    );

    if (isHeaderRow) {
      sampleRow.forEach((cell) => {
        const c = cell.toLowerCase();
        if (/风格|style|导演/i.test(c)) {
          initialMap.push("voiceStyle");
        } else if (/控制|natural|角色/i.test(c)) {
          initialMap.push("naturalControl");
        } else if (/描述|instruction/i.test(c)) {
          initialMap.push("instruction");
        } else if (/文本|text|音频/i.test(c)) {
          initialMap.push("text");
        } else if (/标题|名字|标识|title|name|id/i.test(c)) {
          initialMap.push("title");
        } else {
          initialMap.push("ignore");
        }
      });
    } else if (maxCols >= 5) {
      initialMap.push("title", "instruction", "naturalControl", "voiceStyle", "text");
      for (let i = 5; i < maxCols; i++) initialMap.push("ignore");
    } else if (maxCols === 4) {
      initialMap.push("title", "instruction", "naturalControl", "text");
    } else if (maxCols === 3) {
      initialMap.push("title", "instruction", "text");
    } else if (maxCols === 2) {
      if (/^(VO_|ID_|#|[A-Za-z0-9_-]{3,15}$)/i.test(sampleRow[0] || "") && !sampleRow[0]?.includes(" ")) {
        initialMap.push("title", "text");
      } else {
        initialMap.push("voiceStyle", "text");
      }
    } else {
      initialMap.push("voiceStyle");
    }
    setColMap(initialMap);
  }, [maxCols, parsedGrid]);

  function handleColSelect(colIdx: number, value: "title" | "instruction" | "naturalControl" | "voiceStyle" | "text" | "ignore") {
    const updated = [...colMap];
    updated[colIdx] = value;
    setColMap(updated);
  }

  function joinCellValues(list: string[]): string {
    if (list.length === 0) return "";
    if (list.length === 1) return list[0];

    let result = list[0];
    for (let i = 1; i < list.length; i++) {
      const prev = result.trimEnd();
      const curr = list[i].trim();
      if (!curr) continue;

      const lastChar = prev.slice(-1);
      if (/[.,!?;:。，！？；：]/.test(lastChar)) {
        result = `${prev} ${curr}`;
      } else {
        result = `${prev}, ${curr}`;
      }
    }
    return result;
  }

  function handleCommit(mode: "replace" | "append") {
    if (parsedGrid.length === 0) return;

    type ValidField = "title" | "instruction" | "naturalControl" | "voiceStyle" | "text";
    const activeFields: Array<keyof BatchVoiceCloneRow> = Array.from(
      new Set(colMap.filter((f): f is ValidField => f !== "ignore"))
    );

    const isHeaderRow = (parsedGrid[0] || []).some((cell) =>
      /^(标题|名字|标识|音色描述|描述|自然语言|自然控制|语音风格|风格|导演文本|音频文本|文本|title|instruction|style|text)/i.test(cell)
    );
    const dataRows = isHeaderRow ? parsedGrid.slice(1) : parsedGrid;

    const resultRows: BatchVoiceCloneRow[] = dataRows.map((gridRow, idx) => {
      const fieldValues: Record<string, string[]> = {};
      gridRow.forEach((cell, colIdx) => {
        const mappedField = colMap[colIdx];
        if (mappedField && mappedField !== "ignore" && cell.trim()) {
          if (!fieldValues[mappedField]) {
            fieldValues[mappedField] = [];
          }
          fieldValues[mappedField].push(cell.trim());
        }
      });

      const getMergedVal = (field: string) => joinCellValues(fieldValues[field] || []);

      const styleVal = getMergedVal("voiceStyle") || getMergedVal("instruction");
      const instVal = getMergedVal("instruction") || getMergedVal("voiceStyle");
      const natVal = getMergedVal("naturalControl");
      const textVal = getMergedVal("text");
      const titleVal = getMergedVal("title");

      return {
        id: createId("row"),
        title: titleVal || `句段 ${idx + 1}`,
        instruction: instVal || styleVal,
        naturalControl: natVal,
        voiceStyle: styleVal || instVal,
        text: textVal
      };
    });

    onImport(resultRows, mode, activeFields);
    onClose();
  }

  const backdropMouseDownRef = useRef<EventTarget | null>(null);

  return (
    <div
      className="node-modal-backdrop nodrag nopan nowheel"
      onMouseDown={(e) => { backdropMouseDownRef.current = e.target; }}
      onClick={(e) => {
        if (e.target === e.currentTarget && backdropMouseDownRef.current === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="api-key-modal-content excel-paste-modal" onClick={(e) => e.stopPropagation()}>
        <div className="api-key-modal-header" style={{ padding: "10px 14px" }}>
          <h3 style={{ fontSize: 13.5 }}>
            <Table size={16} />
            从 Excel / 飞书 / 腾讯文档表格一键粘贴导入
          </h3>
          <button className="api-key-modal-close" type="button" onClick={onClose} style={{ width: 24, height: 24 }}>
            <X size={16} />
          </button>
        </div>
        <div className="api-key-modal-body" style={{ padding: "10px 14px", gap: 8 }}>
          <p className="api-key-modal-hint" style={{ fontSize: 11.5, margin: 0, lineHeight: 1.4 }}>
            请在 Excel / WPS / 飞书表格中选中多行多列区域并复制（Ctrl+C），直接在下方输入框内按 <strong>Ctrl + V</strong> 粘贴：
          </p>
          <textarea
            className="excel-paste-textarea nodrag nopan nowheel"
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder={"点击此处直接按 Ctrl + V 粘贴表格内容，例如：\n疑惑而友善，语气自然。\tCan I help you?\n惊讶、错愕又有点无奈\tA pirate?! Me? Hold on..."}
            rows={3}
            style={{ minHeight: 56, height: 68, fontSize: 11.5, marginTop: 4, padding: "6px 8px" }}
            autoFocus
          />

          {parsedGrid.length > 0 ? (
            <div style={{ marginTop: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <strong className="excel-preview-heading" style={{ fontSize: 12 }}>
                  数据预览（智能解析共 {parsedGrid.length} 行 {maxCols} 列，可自定义对应列）：
                </strong>
              </div>
              <div className="nodrag nopan nowheel excel-preview-scroll-wrap" style={{ overflowX: "auto", overflowY: "auto", maxHeight: 180, borderRadius: 6 }}>
                <table className="excel-paste-preview-table" style={{ marginTop: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 40, textAlign: "center", verticalAlign: "top" }}>#</th>
                      {Array.from({ length: maxCols }).map((_, cIdx) => (
                        <th key={cIdx} style={{ verticalAlign: "top" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <span>第 {cIdx + 1} 列</span>
                            <select
                              className="excel-col-select"
                              value={colMap[cIdx] || "ignore"}
                              onChange={(e) => handleColSelect(cIdx, e.target.value as "title" | "instruction" | "naturalControl" | "voiceStyle" | "text" | "ignore")}
                            >
                              <option value="instruction">音色描述词</option>
                              <option value="naturalControl">自然语言控制 (角色/指导)</option>
                              <option value="voiceStyle">语音风格 (导演文本/语气)</option>
                              <option value="text">音频文本</option>
                              <option value="title">名字 / 标识</option>
                              <option value="ignore">❌ 忽略此列</option>
                            </select>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedGrid.map((gridRow, rIdx) => (
                      <tr key={rIdx}>
                        <td style={{ textAlign: "center", color: "#9f947b", fontSize: 11, verticalAlign: "top", paddingTop: 8 }}>{rIdx + 1}</td>
                        {Array.from({ length: maxCols }).map((_, cIdx) => (
                          <td key={cIdx} style={{ whiteSpace: "pre-wrap", maxWidth: 220, verticalAlign: "top", paddingTop: 8, lineHeight: 1.45 }}>
                            {gridRow[cIdx] || ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
        <div className="api-key-modal-footer excel-modal-footer" style={{ padding: "8px 14px", gap: 8 }}>
          <button type="button" className="excel-modal-btn cancel" onClick={onClose} style={{ height: 28, fontSize: 11.5, padding: "0 10px" }}>
            取消
          </button>
          <button
            type="button"
            className="excel-modal-btn append"
            disabled={parsedGrid.length === 0}
            onClick={() => handleCommit("append")}
            style={{ height: 28, fontSize: 11.5, padding: "0 10px" }}
          >
            追加到表格末尾 ({parsedGrid.length} 条)
          </button>
          <button
            type="button"
            className="excel-modal-btn replace"
            disabled={parsedGrid.length === 0}
            onClick={() => handleCommit("replace")}
            style={{ height: 28, fontSize: 11.5, padding: "0 10px" }}
          >
            覆盖现有表格 ({parsedGrid.length} 条)
          </button>
        </div>
      </div>
    </div>
  );
}
