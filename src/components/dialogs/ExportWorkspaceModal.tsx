import type { WorkspaceSummary, WorkspacePayload } from "../../types/studio";
import { FileDown, X, Square, CheckSquare, Search, Check, FileJson, Archive, Sparkles, FolderOpen, AlertTriangle, Loader2 } from "lucide-react";
import { createZipInstance } from "../../utils/zipUtils";
import { sanitizeFileName } from "../../utils/audioNaming";
import { useState, useMemo, useRef } from "react";

export function ExportWorkspaceModal({
  workspaces,
  activeWorkspace,
  initialSelectedIds,
  initialTargetId,
  onClose,
  onSaveActiveWorkspace,
  onShowToast
}: {
  workspaces: WorkspaceSummary[];
  activeWorkspace: WorkspacePayload | null;
  initialSelectedIds?: Set<string>;
  initialTargetId?: string;
  onClose: () => void;
  onSaveActiveWorkspace?: () => Promise<void>;
  onShowToast?: (text: string, actionText?: string, onAction?: () => void) => void;
}) {
  const [mode, setMode] = useState<"single" | "multiple">(() => {
    if (initialTargetId) return "single";
    if (initialSelectedIds && initialSelectedIds.size > 1) return "multiple";
    return "multiple";
  });

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    if (initialTargetId) {
      return new Set([initialTargetId]);
    }
    if (initialSelectedIds && initialSelectedIds.size > 0) {
      return new Set(initialSelectedIds);
    }
    if (activeWorkspace?.id) {
      return new Set([activeWorkspace.id]);
    }
    if (workspaces.length > 0) {
      return new Set([workspaces[0].id]);
    }
    return new Set();
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [exportFormat, setExportFormat] = useState<"individual_json" | "bundle_json" | "zip">("individual_json");
  const [isTemplateFormat, setIsTemplateFormat] = useState(false);
  const [exportDestinationDir, setExportDestinationDir] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredWorkspaces = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return workspaces;
    return workspaces.filter((w) => w.name.toLowerCase().includes(q));
  }, [workspaces, searchQuery]);

  function handleModeChange(newMode: "single" | "multiple") {
    setMode(newMode);
    if (newMode === "single") {
      const firstId = Array.from(selectedIds)[0] || initialTargetId || activeWorkspace?.id || workspaces[0]?.id;
      if (firstId) {
        setSelectedIds(new Set([firstId]));
      }
    }
  }

  function handleRowClick(id: string) {
    if (mode === "single") {
      setSelectedIds(new Set([id]));
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    }
  }

  function handleSelectAll() {
    setSelectedIds(new Set(filteredWorkspaces.map((w) => w.id)));
  }

  function handleDeselectAll() {
    setSelectedIds(new Set());
  }

  function handleInvertSelection() {
    setSelectedIds((prev) => {
      const next = new Set<string>();
      filteredWorkspaces.forEach((w) => {
        if (!prev.has(w.id)) {
          next.add(w.id);
        }
      });
      return next;
    });
  }

  function handleSelectActive() {
    if (activeWorkspace?.id) {
      setSelectedIds(new Set([activeWorkspace.id]));
    }
  }

  const selectedCount = selectedIds.size;

  const exportFileNamePreview = useMemo(() => {
    const selectedList = workspaces.filter((w) => selectedIds.has(w.id));
    const dateStr = new Date().toISOString().slice(0, 10);
    const templateTag = isTemplateFormat ? "_模板" : "";

    if (selectedList.length === 0) {
      return "未选择画板";
    }
    if (selectedList.length === 1) {
      const safeName = sanitizeFileName(selectedList[0].name || "workspace");
      const ext = exportFormat === "zip" ? ".zip" : ".json";
      return `${safeName}${templateTag}_${dateStr}${ext}`;
    }

    const firstSafe = sanitizeFileName(selectedList[0].name || "画板");
    if (exportFormat === "individual_json") {
      return `${firstSafe}${templateTag}_${dateStr}.json 等 ${selectedList.length} 个独立文件`;
    }
    if (exportFormat === "zip") {
      return `${firstSafe}等${selectedList.length}个画板${templateTag}_${dateStr}.zip`;
    }
    return `${firstSafe}等${selectedList.length}个画板${templateTag}_${dateStr}.json`;
  }, [workspaces, selectedIds, exportFormat, isTemplateFormat]);

  function cleanWorkspaceForTemplate(ws: WorkspacePayload): WorkspacePayload & { isTemplate?: boolean } {
    if (ws.type === "board" && ws.nodes) {
      const cleanNodes = ws.nodes.map((n) => {
        const copyData = { ...n.data };
        delete copyData.artifact;
        delete copyData.batchArtifacts;
        delete copyData.singleRunningRowId;
        delete copyData.error;
        delete copyData.isRunning;
        return { ...n, data: copyData };
      });
      return {
        ...ws,
        name: ws.name.endsWith("模板") ? ws.name : `${ws.name} 模板`,
        isTemplate: true,
        nodes: cleanNodes
      };
    }
    return ws;
  }

  async function executeDirectExportToDirectory(targetDir: string) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      setError("请至少选择一个要导出的画板");
      return;
    }

    setIsExporting(true);
    setError(null);

    try {
      if (activeWorkspace && selectedIds.has(activeWorkspace.id) && onSaveActiveWorkspace) {
        await onSaveActiveWorkspace();
      }

      const res = await fetch("/api/workspaces/export-to-path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetDir,
          ids,
          exportFormat,
          isTemplateFormat
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "导出到目录失败");
      }

      const result = await res.json();
      setIsExporting(false);
      onClose();

      if (onShowToast) {
        onShowToast(
          `✨ 成功导出 ${result.count || ids.length} 个画板到：${targetDir}`,
          "在文件夹中打开",
          () => {
            void fetch("/api/workspaces/open-folder", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ folderPath: targetDir })
            });
          }
        );
      }
    } catch (err) {
      setIsExporting(false);
      setError(err instanceof Error ? err.message : "导出画板失败");
    }
  }

  async function handleSelectFolderAndExport(autoExport = true) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      setError("请至少选择一个要导出的画板");
      return;
    }
    setError(null);
    try {
      const res = await fetch("/api/settings/select-folder", { method: "POST" });
      if (!res.ok) throw new Error("调起文件夹选择器失败");
      const data = await res.json();
      if (data.canceled || !data.folderPath) {
        return;
      }
      const chosenPath = data.folderPath;
      setExportDestinationDir(chosenPath);
      if (autoExport) {
        await executeDirectExportToDirectory(chosenPath);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "选择导出文件夹失败");
    }
  }

  async function handleExecuteExport() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      setError("请至少选择一个要导出的画板");
      return;
    }

    if (exportDestinationDir.trim()) {
      await executeDirectExportToDirectory(exportDestinationDir.trim());
      return;
    }

    setIsExporting(true);
    setError(null);

    try {
      if (activeWorkspace && selectedIds.has(activeWorkspace.id) && onSaveActiveWorkspace) {
        await onSaveActiveWorkspace();
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      const templateTag = isTemplateFormat ? "_模板" : "";

      if (exportFormat === "individual_json") {
        let exportWorkspaces: WorkspacePayload[] = [];

        if (ids.length === 1) {
          const response = await fetch(`/api/workspaces/${ids[0]}`);
          if (!response.ok) throw new Error("获取画板数据失败");
          const payload = await response.json();
          exportWorkspaces = [payload];
        } else {
          const response = await fetch("/api/workspaces/batch-export", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids })
          });
          if (!response.ok) throw new Error("批量获取画板数据失败");
          const bundleData = await response.json();
          exportWorkspaces = bundleData.workspaces || [];
        }

        if (isTemplateFormat) {
          exportWorkspaces = exportWorkspaces.map(cleanWorkspaceForTemplate);
        }

        const usedNames = new Set<string>();
        for (let i = 0; i < exportWorkspaces.length; i++) {
          const ws = exportWorkspaces[i];
          let baseName = sanitizeFileName(ws.name || "workspace");
          let fileName = `${baseName}${templateTag}_${dateStr}.json`;
          let counter = 1;
          while (usedNames.has(fileName)) {
            fileName = `${baseName}_${counter}${templateTag}_${dateStr}.json`;
            counter++;
          }
          usedNames.add(fileName);

          const text = JSON.stringify(ws, null, 2);
          const blob = new Blob([text], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          if (exportWorkspaces.length > 1 && i < exportWorkspaces.length - 1) {
            await new Promise((r) => setTimeout(r, 150));
          }
        }
      } else {
        const response = await fetch("/api/workspaces/batch-export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids })
        });
        if (!response.ok) throw new Error("批量获取画板数据失败");
        const bundleData = await response.json();
        let exportWorkspaces: WorkspacePayload[] = bundleData.workspaces || [];

        if (isTemplateFormat) {
          exportWorkspaces = exportWorkspaces.map(cleanWorkspaceForTemplate);
        }

        if (exportFormat === "zip") {
          const zip = await createZipInstance();
          const usedNames = new Set<string>();

          for (const ws of exportWorkspaces) {
            let baseName = sanitizeFileName(ws.name || "workspace");
            let fileName = `${baseName}.json`;
            let counter = 1;
            while (usedNames.has(fileName)) {
              fileName = `${baseName}_${counter}.json`;
              counter++;
            }
            usedNames.add(fileName);
            zip.file(fileName, JSON.stringify(ws, null, 2));
          }

          const content = await zip.generateAsync({ type: "blob" });
          const url = URL.createObjectURL(content);
          const a = document.createElement("a");
          a.href = url;
          a.download = exportFileNamePreview;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } else {
          // bundle_json
          const payload = ids.length === 1 ? exportWorkspaces[0] : {
            exportedAt: new Date().toISOString(),
            count: exportWorkspaces.length,
            workspaces: exportWorkspaces
          };
          const text = JSON.stringify(payload, null, 2);
          const blob = new Blob([text], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = exportFileNamePreview;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      }

      setIsExporting(false);
      onClose();
      onShowToast?.(`✨ 成功导出 ${selectedCount} 个画板文件！`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "导出画板失败");
      setIsExporting(false);
    }
  }

  const backdropMouseDownRef = useRef<EventTarget | null>(null);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => { backdropMouseDownRef.current = e.target; }}
      onClick={(e) => {
        if (e.target === e.currentTarget && backdropMouseDownRef.current === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="export-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="api-key-modal-header">
          <h3>
            <FileDown size={19} />
            导出画板
          </h3>
          <button className="api-key-modal-close" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="api-key-modal-body export-modal-body">
          {/* Mode Switcher Tabs */}
          <div className="export-mode-tabs">
            <button
              type="button"
              className={`export-tab-btn ${mode === "single" ? "active" : ""}`}
              onClick={() => handleModeChange("single")}
            >
              <Square size={15} />
              导出一个画板
            </button>
            <button
              type="button"
              className={`export-tab-btn ${mode === "multiple" ? "active" : ""}`}
              onClick={() => handleModeChange("multiple")}
            >
              <CheckSquare size={15} />
              导出多个画板 ({selectedCount})
            </button>
          </div>

          {/* Search and Quick Action Toolbar */}
          <div className="export-toolbar">
            <div className="export-search-input-wrap">
              <Search size={14} className="export-search-icon" />
              <input
                type="text"
                className="export-search-input"
                placeholder="搜索画板名称..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="export-search-clear"
                  onClick={() => setSearchQuery("")}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {mode === "multiple" && (
              <div className="export-quick-actions">
                <button type="button" className="export-mini-btn" onClick={handleSelectAll}>
                  全选
                </button>
                <button type="button" className="export-mini-btn" onClick={handleInvertSelection}>
                  反选
                </button>
                <button type="button" className="export-mini-btn" onClick={handleDeselectAll}>
                  取消全选
                </button>
                {activeWorkspace && (
                  <button type="button" className="export-mini-btn highlight" onClick={handleSelectActive}>
                    仅当前画板
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Workspace List Container */}
          <div className="export-workspace-list">
            {filteredWorkspaces.length === 0 ? (
              <div className="export-empty-tip">未找到匹配的画板</div>
            ) : (
              filteredWorkspaces.map((w) => {
                const isSelected = selectedIds.has(w.id);
                const isActive = w.id === activeWorkspace?.id;
                return (
                  <div
                    key={w.id}
                    className={`export-workspace-row ${isSelected ? "selected" : ""} ${isActive ? "is-active" : ""}`}
                    onClick={() => handleRowClick(w.id)}
                  >
                    <div className="export-row-checkbox">
                      {mode === "single" ? (
                        <span className={`export-radio-dot ${isSelected ? "checked" : ""}`} />
                      ) : (
                        <span className={`export-check-box ${isSelected ? "checked" : ""}`}>
                          {isSelected && <Check size={12} />}
                        </span>
                      )}
                    </div>
                    <div className="export-row-info">
                      <div className="export-row-header">
                        <strong className="export-row-title">{w.name}</strong>
                        {isActive && <span className="export-tag active-tag">当前打开</span>}
                        <span className="export-tag type-tag">
                          {w.type === "audiobook" ? "有声书工作台" : "节点画板"}
                        </span>
                      </div>
                      <div className="export-row-meta">
                        <span>
                          {w.type === "audiobook"
                            ? `${w.characterCount ?? 0} 角色 · ${w.segmentCount ?? 0} 段落`
                            : `${w.nodeCount ?? 0} 节点 · ${w.edgeCount ?? 0} 连线`}
                        </span>
                        {w.stashCount && w.stashCount > 0 ? (
                          <span className="export-stash-badge">含 {w.stashCount} 音效暂存</span>
                        ) : null}
                        {w.updatedAt && (
                          <span className="export-date">{w.updatedAt.slice(0, 10)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Export Options */}
          <div className="export-options-panel">
            {/* Format Selection Row */}
            <div className="export-option-row">
              <span className="export-option-row-header">
                <FileDown size={15} /> 导出格式：
              </span>
              <div className="export-format-grid">
                <div
                  className={`export-format-card ${exportFormat === "individual_json" ? "active" : ""}`}
                  onClick={() => setExportFormat("individual_json")}
                >
                  <div className="export-format-card-main">
                    <div className="export-format-icon-wrap">
                      <FileJson size={20} />
                    </div>
                    <div className="export-format-text-wrap">
                      <div className="export-format-card-title">
                        {selectedCount > 1 ? "独立 JSON 文件 (.json)" : "标准 JSON 文件 (.json)"}
                      </div>
                      <div className="export-format-card-desc">
                        {selectedCount > 1 ? "每个画板保存为一个单独的 .json 格式文件" : "包含完整节点配置、参数与连线拓扑"}
                      </div>
                    </div>
                  </div>
                  <div className="export-capsule-indicator">
                    <span className="export-capsule-dot" />
                    <span className="export-capsule-text">{exportFormat === "individual_json" ? "已选择" : "选择"}</span>
                  </div>
                </div>

                {selectedCount > 1 && (
                  <div
                    className={`export-format-card ${exportFormat === "bundle_json" ? "active" : ""}`}
                    onClick={() => setExportFormat("bundle_json")}
                  >
                    <div className="export-format-card-main">
                      <div className="export-format-icon-wrap">
                        <FileJson size={20} />
                      </div>
                      <div className="export-format-text-wrap">
                        <div className="export-format-card-title">JSON 整合包 (.json)</div>
                        <div className="export-format-card-desc">将选中的所有画板合并打包存储在单个 .json 文件中</div>
                      </div>
                    </div>
                    <div className="export-capsule-indicator">
                      <span className="export-capsule-dot" />
                      <span className="export-capsule-text">{exportFormat === "bundle_json" ? "已选择" : "选择"}</span>
                    </div>
                  </div>
                )}

                <div
                  className={`export-format-card ${exportFormat === "zip" ? "active" : ""}`}
                  onClick={() => setExportFormat("zip")}
                >
                  <div className="export-format-card-main">
                    <div className="export-format-icon-wrap">
                      <Archive size={20} />
                    </div>
                    <div className="export-format-text-wrap">
                      <div className="export-format-card-title">ZIP 压缩包 (.zip)</div>
                      <div className="export-format-card-desc">自动将所有画板 .json 归档打包为单个 ZIP 压缩包</div>
                    </div>
                  </div>
                  <div className="export-capsule-indicator">
                    <span className="export-capsule-dot" />
                    <span className="export-capsule-text">{exportFormat === "zip" ? "已选择" : "选择"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Template Toggle with Capsule Switch */}
            <div className="export-option-row">
              <div
                className={`export-template-card ${isTemplateFormat ? "active" : ""}`}
                onClick={() => setIsTemplateFormat(!isTemplateFormat)}
              >
                <div className="export-template-left">
                  <Sparkles size={18} className="export-template-icon" />
                  <div className="export-template-text">
                    <div className="export-template-title">导出为轻量模板</div>
                    <div className="export-template-desc">自动去除生成的音频二进制与临时缓存，大幅减小导出文件体积，便于备份分享</div>
                  </div>
                </div>
                <div className={`capsule-switch ${isTemplateFormat ? "checked" : ""}`}>
                  <span className="capsule-switch-thumb" />
                </div>
              </div>
            </div>

            {/* Export Destination Directory Row */}
            <div className="export-option-row">
              <span className="export-option-row-header">
                <FolderOpen size={15} /> 导出保存路径：
              </span>
              <div className="export-path-input-group">
                <input
                  type="text"
                  value={exportDestinationDir}
                  onChange={(e) => setExportDestinationDir(e.target.value)}
                  placeholder="默认保存到浏览器下载目录 (或点击右侧选择本地文件夹)..."
                />
                <button
                  type="button"
                  className="export-path-btn-auto"
                  onClick={() => void handleSelectFolderAndExport(true)}
                  title="调起本地文件夹选择窗口，选择后自动将画板导出到该目录"
                >
                  <FolderOpen size={15} />
                  选择路径并自动导出
                </button>
                {exportDestinationDir && (
                  <button
                    type="button"
                    className="export-path-btn-change"
                    onClick={() => setExportDestinationDir("")}
                    title="重置为默认浏览器下载"
                  >
                    重置默认
                  </button>
                )}
              </div>
            </div>
          </div>

          {error && (
            <p className="api-key-modal-warn">
              <AlertTriangle size={14} />
              {error}
            </p>
          )}
        </div>

        {/* Modal Footer */}
        <div className="api-key-modal-footer export-modal-footer">
          <div className="export-footer-summary">
            <span className="export-count-pill">
              已选 <strong>{selectedCount}</strong> / {workspaces.length} 个画板
            </span>
            <span className="export-filename-preview" title={exportFileNamePreview}>
              {exportFileNamePreview}
            </span>
          </div>
          <div className="export-footer-btns">
            <button
              type="button"
              className="api-key-btn-cancel"
              onClick={onClose}
              disabled={isExporting}
            >
              取消
            </button>
            <button
              type="button"
              className="api-key-btn-save"
              onClick={() => void handleExecuteExport()}
              disabled={isExporting || selectedCount === 0}
            >
              {isExporting ? (
                <>
                  <Loader2 size={15} className="spin" />
                  正在打包导出...
                </>
              ) : (
                <>
                  <FileDown size={15} />
                  {exportDestinationDir ? `导出到所选目录 (${selectedCount})` : `确认下载导出 (${selectedCount})`}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
