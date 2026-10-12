import type { Dispatch, SetStateAction } from "react";
import { useRef } from "react";
import { useSettingsPopover } from "./useSettingsPopover";
import type { SingleDownloadSettings } from "../../utils/downloadSettings";
import type { WorkspacePayload } from "../../types/studio";
import { DownloadNamingSettings } from "../DownloadNamingSettings";
import { FolderOpen, X } from "lucide-react";

export interface StorageSettingsDialogProps {
  showStoragePathModal: boolean;
  handleBackdropMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleBackdropClick: (e: React.MouseEvent<HTMLDivElement>, onClose: () => void) => void;
  setShowStoragePathModal: Dispatch<SetStateAction<boolean>>;
  singleDownloadSettings: SingleDownloadSettings;
  setSingleDownloadSettings: Dispatch<SetStateAction<SingleDownloadSettings>>;
  activeWorkspace: WorkspacePayload | null;
  customPathInput: string;
  setCustomPathInput: Dispatch<SetStateAction<string>>;
  selectFolderAndSave: () => Promise<void>;
  storagePathInfo: { dataDir: string; workspaceFilePath: string; isCustom: boolean; } | null;
  saveCustomStoragePath: () => Promise<void>;
  resetStoragePath: () => Promise<void>;
  openLocalWorkspaceFolder: (workspaceId?: string) => Promise<void>;
  openLocalAudiosFolder: () => Promise<void>;
}

export function StorageSettingsDialog({
  showStoragePathModal,
  handleBackdropMouseDown,
  handleBackdropClick,
  setShowStoragePathModal,
  singleDownloadSettings,
  setSingleDownloadSettings,
  activeWorkspace,
  customPathInput,
  setCustomPathInput,
  selectFolderAndSave,
  storagePathInfo,
  saveCustomStoragePath,
  resetStoragePath,
  openLocalWorkspaceFolder,
  openLocalAudiosFolder,
}: StorageSettingsDialogProps) {
  const panel=useRef<HTMLDivElement>(null);
  const popover=useSettingsPopover(showStoragePathModal,'[data-settings-trigger="storage"]',panel);
  return (<>{showStoragePathModal && (
    <div
      className={`api-key-modal${popover.overlayClass}`}
      onMouseDown={handleBackdropMouseDown}
      onClick={(e) => handleBackdropClick(e, () => setShowStoragePathModal(false))}
    >
      <div ref={panel} className={`api-key-modal-content${popover.panelClass}`} style={{ maxWidth:520,...popover.style }} onClick={(e) => e.stopPropagation()}>
        <div className="api-key-modal-header">
          <h3>
            <FolderOpen size={18} />
            存储设置
          </h3>
          <button className="api-key-modal-close settings-close-button" type="button" aria-label="关闭存储设置" title="关闭" onClick={() => setShowStoragePathModal(false)}>
            <X size={18} />
          </button>
        </div>
        <div className="api-key-modal-body">
          <DownloadNamingSettings settings={singleDownloadSettings} onChange={setSingleDownloadSettings} workspaceName={activeWorkspace?.name} />
          <p className="section-hint">更改目录会复制并校验画板、音频和模板；原目录保留，目标同名文件会先备份。请等待生成和保存完成后操作。</p>
          <div className="storage-path-card" style={{ marginTop: 0 }}>
            <span className="storage-path-card-title">
              <FolderOpen size={16} /> 当前数据保存目录
            </span>
            <div className="storage-path-input-group">
              <input
                type="text"
                value={customPathInput}
                onChange={(e) => setCustomPathInput(e.target.value)}
                placeholder="本地存储目录绝对路径..."
              />
              <button
                type="button"
                className="storage-path-btn-primary"
                onClick={() => void selectFolderAndSave()}
                title="调起系统文件资源管理器窗口选择文件夹"
              >
                <FolderOpen size={14} />
                更改目录
              </button>
              {customPathInput.trim() && customPathInput.trim() !== storagePathInfo?.dataDir ? (
                <button
                  type="button"
                  className="storage-path-btn-apply"
                  onClick={() => void saveCustomStoragePath()}
                  title="应用手动粘贴的路径地址"
                >
                  应用地址
                </button>
              ) : null}
              <button type="button" className="storage-path-btn-default" onClick={() => void resetStoragePath()}>恢复默认</button>
            </div>
            <div className="storage-path-actions" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                className="storage-path-btn-open"
                onClick={() => void openLocalWorkspaceFolder(activeWorkspace?.id)}
              >
                <FolderOpen size={14} /> 在本地资源管理器打开画板工程文件
              </button>
              <button
                type="button"
                className="storage-path-btn-open"
                onClick={() => void openLocalAudiosFolder()}
                style={{ background: "#2563eb", color: "#ffffff", borderColor: "#3b82f6" }}
              >
                <FolderOpen size={14} /> 📂 打开生成的音频保存目录 (audios/)
              </button>
            </div>
          </div>
        </div>
        <div className="api-key-modal-footer">
          <button type="button" className="api-key-btn-save" onClick={() => setShowStoragePathModal(false)}>完成</button>
        </div>
      </div>
    </div>
  )}</>);
}
