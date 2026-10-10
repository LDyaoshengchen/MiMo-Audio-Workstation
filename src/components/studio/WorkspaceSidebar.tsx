import type { Dispatch, SetStateAction, RefObject } from "react";
import type { AudioAsset } from "../../types/studioAudio";
import type { WorkspaceSummary, WorkspacePayload } from "../../types/studio";
import { FileDown, FolderOpen, Trash2, PanelTop, ChevronRight, ChevronLeft, Plus, BookOpen, Copy, FileJson, LayoutTemplate } from "lucide-react";
import { StashPanel } from "../canvas/StashPanel";

export interface WorkspaceSidebarProps {
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  openLocalWorkspaceFolder: (workspaceId?: string) => Promise<void>;
  activeWorkspace: WorkspacePayload | null;
  setSidebarCollapsed: Dispatch<SetStateAction<boolean>>;
  setBoardDialog: Dispatch<SetStateAction<"audiobook" | "choice" | "templates" | "smart" | null>>;
  jsonFileInputRef: RefObject<HTMLInputElement | null>;
  importWorkspaceFile: (file: File) => Promise<void>;
  workspaces: WorkspaceSummary[];
  selectedWorkspaceIds: Set<string>;
  handleWorkspaceClick: (event: React.MouseEvent, workspace: WorkspaceSummary, index: number) => void;
  openSaveAsModal: (target?: WorkspaceSummary) => void;
  exportWorkspaceAsTemplate: (id?: string) => Promise<void>;
  openExportModal: (targetId?: string) => void;
  isStashOpen: boolean;
  downloadStashZip: () => Promise<void>;
  deleteStashItem: (itemId: string) => void;
  setIsStashOpen: Dispatch<SetStateAction<boolean>>;
  createReferenceAudioFromData: (title: string, audioAsset: AudioAsset) => void;
  openLocalAudiosFolder: () => Promise<void>;
  promptBatchDeleteWorkspaces: () => Promise<void>;
  promptDeleteCurrentWorkspace: () => Promise<void>;
}

export function WorkspaceSidebar({
  sidebarCollapsed,
  sidebarWidth,
  openLocalWorkspaceFolder,
  activeWorkspace,
  setSidebarCollapsed,
  setBoardDialog,
  jsonFileInputRef,
  importWorkspaceFile,
  workspaces,
  selectedWorkspaceIds,
  handleWorkspaceClick,
  openSaveAsModal,
  exportWorkspaceAsTemplate,
  openExportModal,
  isStashOpen,
  downloadStashZip,
  deleteStashItem,
  setIsStashOpen,
  createReferenceAudioFromData,
  openLocalAudiosFolder,
  promptBatchDeleteWorkspaces,
  promptDeleteCurrentWorkspace,
}: WorkspaceSidebarProps) {
  return (<aside
    className={`board-sidebar ${sidebarCollapsed ? "collapsed" : ""} ${!sidebarCollapsed && sidebarWidth < 250 ? "is-compact" : ""}`}
    style={sidebarCollapsed ? undefined : { width: sidebarWidth }}
  >
    <div className="sidebar-title">
      <div className="sidebar-title-left">
        <PanelTop size={17} />
        <span>画板库</span>
      </div>
      <div className="sidebar-actions-group">
        {!sidebarCollapsed && (
          <button
            className="sidebar-toggle folder-btn"
            type="button"
            onClick={() => void openLocalWorkspaceFolder(activeWorkspace?.id)}
            title="在本地资源管理器中打开并选中画板存储文件"
          >
            <FolderOpen size={14} />
          </button>
        )}
        <button
          className="sidebar-toggle"
          type="button"
          onClick={() => setSidebarCollapsed((value) => !value)}
          title={sidebarCollapsed ? "展开画板库" : "折叠画板库"}
        >
          {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>
    </div>
    {!sidebarCollapsed && (
      <>
        <button className="new-board" type="button" onClick={() => setBoardDialog("choice")}>
          <Plus size={16} />
          新建画板
        </button>
        <input
          type="file"
          ref={jsonFileInputRef}
          accept=".json"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              void importWorkspaceFile(file);
            }
            e.target.value = "";
          }}
        />

        <div className="board-list">
          {workspaces.map((workspace, index) => {
            const isSelected = selectedWorkspaceIds.has(workspace.id);
            const isActive = workspace.id === activeWorkspace?.id;
            const itemClass = isActive
              ? (isSelected ? "board-item active selected-multi" : "board-item active")
              : (isSelected ? "board-item selected-multi" : "board-item");

            return (
              <div className="board-list-entry" key={workspace.id}>
                <div className="board-item-header">
                  <button
                    className={itemClass}
                    type="button"
                    onClick={(e) => handleWorkspaceClick(e, workspace, index)}
                    title="Click 选中/加载 | Ctrl+Click 多选 | Shift+Click 连选"
                  >
                    <strong>
                      {workspace.type === "audiobook" ? <BookOpen size={14} style={{ marginRight: 6, verticalAlign: "middle" }} /> : null}
                      {workspace.name}
                    </strong>
                    <span>
                      {workspace.type === "audiobook"
                        ? `${workspace.characterCount ?? 0} 角色 / ${workspace.segmentCount ?? 0} 段落`
                        : `${workspace.nodeCount ?? 0} 节点 / ${workspace.edgeCount ?? 0} 连线`}
                    </span>
                  </button>
                  <div className="board-item-btn-grid">
                    <button
                      className="board-square-btn"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openSaveAsModal(workspace);
                      }}
                      title="另存为新画板"
                    >
                      <Copy size={13} />
                    </button>
                    <button
                      className="board-square-btn"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        jsonFileInputRef.current?.click();
                      }}
                      title="打开本地画板json文件"
                    >
                      <FileJson size={13} />
                    </button>
                    <button
                      className="board-square-btn"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void exportWorkspaceAsTemplate(workspace.id);
                      }}
                      title="导出模板"
                    >
                      <LayoutTemplate size={13} />
                    </button>
                    <button
                      className="board-square-btn"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openExportModal(workspace.id);
                      }}
                      title="导出画板"
                    >
                      <FileDown size={13} />
                    </button>
                  </div>
                </div>
                {workspace.id === activeWorkspace?.id && activeWorkspace.type === "board" && activeWorkspace.stashItems.length > 0 ? (
                  <StashPanel
                    isOpen={isStashOpen}
                    items={activeWorkspace.stashItems}
                    workspaceName={activeWorkspace.name}
                    onBatchDownload={() => void downloadStashZip()}
                    onDelete={deleteStashItem}
                    onToggle={() => setIsStashOpen((value) => !value)}
                    onConvertToRefAudio={createReferenceAudioFromData}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="sidebar-actions">
          <div className="sidebar-actions-row">
            <button
              className="subtle"
              type="button"
              onClick={() => void openLocalAudiosFolder()}
              title="在资源管理器中打开生成的音频保存目录 (audios/)"
            >
              <FolderOpen size={14} />
              音频目录
            </button>
            <button
              className="subtle"
              type="button"
              onClick={() => openExportModal()}
              disabled={workspaces.length === 0}
              title={
                selectedWorkspaceIds.size > 0
                  ? `导出选中的 ${selectedWorkspaceIds.size} 个画板`
                  : "导出画板"
              }
            >
              <FileDown size={15} />
              {selectedWorkspaceIds.size > 0 ? `导出 (${selectedWorkspaceIds.size})` : "导出画板"}
            </button>
          </div>
          <button
            className="danger subtle sidebar-btn-full"
            type="button"
            onClick={
              selectedWorkspaceIds.size > 0
                ? promptBatchDeleteWorkspaces
                : promptDeleteCurrentWorkspace
            }
            disabled={selectedWorkspaceIds.size === 0 && !activeWorkspace}
            title={
              selectedWorkspaceIds.size > 0
                ? `删除选中的 ${selectedWorkspaceIds.size} 个画板`
                : "删除当前画板"
            }
          >
            <Trash2 size={16} />
            {selectedWorkspaceIds.size > 0 ? `删除选中的 ${selectedWorkspaceIds.size} 项画板` : "删除画板"}
          </button>
        </div>
      </>
    )}
  </aside>);
}
