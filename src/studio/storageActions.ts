import type { Dispatch, SetStateAction } from "react";

export interface StorageActionsContext {
  setStoragePathInfo: Dispatch<SetStateAction<{ dataDir: string; workspaceFilePath: string; isCustom: boolean; } | null>>;
  setCustomPathInput: Dispatch<SetStateAction<string>>;
  loadWorkspaceList: (preferredId?: string) => Promise<void>;
  customPathInput: string;
}

// Read controller dependencies on invocation, never during render initialization.
export function createStorageActions(getContext: () => StorageActionsContext) {
  async function loadStoragePathInfo() {
    const { setStoragePathInfo, setCustomPathInput } = getContext();
    try {
      const res = await fetch("/api/settings/storage-path");
      if (res.ok) {
        const data = await res.json();
        setStoragePathInfo(data);
        setCustomPathInput(data.dataDir);
      }
    } catch (err) {
      console.error("Failed to fetch storage path info", err);
    }
  }

  async function selectFolderAndSave() {
    const { setCustomPathInput, setStoragePathInfo, loadWorkspaceList } = getContext();
    try {
      const res = await fetch("/api/settings/select-folder", { method: "POST" });
      const data = await res.json();
      if (data.canceled) {
        return;
      }
      if (!res.ok || !data.folderPath) {
        throw new Error(data.error || "未选择有效的文件夹。");
      }
      setCustomPathInput(data.folderPath);
      const saveRes = await fetch("/api/settings/storage-path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetDir: data.folderPath })
      });
      if (!saveRes.ok) {
        const errJson = await saveRes.json();
        throw new Error(errJson.error || "更新存储目录失败。");
      }
      const savedInfo = await saveRes.json();
      setStoragePathInfo(savedInfo);
      alert(`本地存储目录已成功更改为：\n${savedInfo.dataDir}\n原目录保留，目标同名文件已备份。${savedInfo.backupDir ? `\n备份目录：${savedInfo.backupDir}` : ""}`);
      await loadWorkspaceList();
    } catch (err) {
      alert(err instanceof Error ? err.message : "选择文件夹失败。");
    }
  }

  async function saveCustomStoragePath() {
    const { customPathInput, setStoragePathInfo, loadWorkspaceList } = getContext();
    if (!customPathInput.trim()) return;
    try {
      const res = await fetch("/api/settings/storage-path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetDir: customPathInput })
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "更新存储目录失败。");
      }
      const data = await res.json();
      setStoragePathInfo(data);
      alert(`本地存储目录已更改为：\n${data.dataDir}\n原目录保留，目标同名文件已备份。${data.backupDir ? `\n备份目录：${data.backupDir}` : ""}`);
      await loadWorkspaceList();
    } catch (err) {
      alert(err instanceof Error ? err.message : "更改存储路径失败。");
    }
  }

  async function resetStoragePath() {
    const { setStoragePathInfo, setCustomPathInput, loadWorkspaceList } = getContext();
    try {
      const res = await fetch("/api/settings/reset-storage-path", { method: "POST" });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "重置存储路径失败。");
      }
      const data = await res.json();
      setStoragePathInfo(data);
      setCustomPathInput(data.dataDir);
      alert(`存储目录已重置为默认值：\n${data.dataDir}`);
      await loadWorkspaceList();
    } catch (err) {
      alert(err instanceof Error ? err.message : "重置存储路径失败。");
    }
  }

  return { loadStoragePathInfo, selectFolderAndSave, saveCustomStoragePath, resetStoragePath };
}
