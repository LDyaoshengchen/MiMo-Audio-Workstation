import type { RefObject, Dispatch, SetStateAction } from "react";
import type { ArtifactData } from "../types/studioAudio";
import type { WorkspaceSummary, WorkspacePayload, StudioNode, StudioEdge, StashItem } from "../types/studio";
import { createId } from "./format";
import { sanitizeFileName } from "../utils/audioNaming";
import { showAppleConfirm } from "./confirmation";

export interface WorkspaceActionsContext {
  saveTimerRef: RefObject<number | null>;
  maxSaveTimerRef: RefObject<number | null>;
  setActiveWorkspace: Dispatch<SetStateAction<WorkspacePayload | null>>;
  setNodes: Dispatch<SetStateAction<StudioNode[]>>;
  setEdges: Dispatch<SetStateAction<StudioEdge[]>>;
  loadWorkspaceList: (preferredId?: string) => Promise<void>;
  activeWorkspace: WorkspacePayload | null;
  setSaveAsTargetWorkspace: Dispatch<SetStateAction<WorkspaceSummary | null>>;
  saveWorkspace: (overrideNodes?: StudioNode[], overrideEdges?: StudioEdge[], overrideWorkspace?: WorkspacePayload) => Promise<void>;
  saveAsTemplateWorkspace: WorkspaceSummary | null;
  setWorkspaces: Dispatch<SetStateAction<WorkspaceSummary[]>>;
  activeWorkspaceRef: RefObject<WorkspacePayload | null>;
  isArtifactStashed: (artifact: ArtifactData) => boolean;
  setIsStashOpen: Dispatch<SetStateAction<boolean>>;
  setAppToast: Dispatch<SetStateAction<{ id: number; text: string; actionText?: string; onAction?: () => void; } | null>>;
  setSelectedWorkspaceIds: Dispatch<SetStateAction<Set<string>>>;
  setLastSelectedIndex: Dispatch<SetStateAction<number | null>>;
  lastSelectedIndex: number | null;
  workspaces: WorkspaceSummary[];
  loadWorkspace: (id: string) => Promise<void>;
  selectedWorkspaceIds: Set<string>;
}

// Read controller dependencies on invocation, never during render initialization.
export function createWorkspaceActions(getContext: () => WorkspaceActionsContext) {
  async function executeDeleteWorkspace(workspaceId: string) {
    const { saveTimerRef, maxSaveTimerRef, setActiveWorkspace, setNodes, setEdges, loadWorkspaceList } = getContext();
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (maxSaveTimerRef.current) {
      window.clearTimeout(maxSaveTimerRef.current);
      maxSaveTimerRef.current = null;
    }

    try {
      await fetch(`/api/workspaces/${workspaceId}`, { method: "DELETE" });
    } catch (err) {
      console.warn("删除画板失败:", err);
    }
    setActiveWorkspace(null);
    setNodes([]);
    setEdges([]);
    await loadWorkspaceList();
  }

  async function promptDeleteCurrentWorkspace() {
    const { activeWorkspace } = getContext();
    if (!activeWorkspace) return;
    const confirmed = await showAppleConfirm({
      title: "删除画板",
      message: `确定要删除「${activeWorkspace.name}」吗？删除后不可恢复。`,
      confirmLabel: "删除画板",
      cancelLabel: "取消",
      isDestructive: true,
      icon: "trash"
    });
    if (confirmed) {
      await executeDeleteWorkspace(activeWorkspace.id);
    }
  }

  function openSaveAsModal(target?: WorkspaceSummary) {
    const { setSaveAsTargetWorkspace, activeWorkspace } = getContext();
    if (target) {
      setSaveAsTargetWorkspace(target);
    } else if (activeWorkspace) {
      setSaveAsTargetWorkspace({
        id: activeWorkspace.id,
        name: activeWorkspace.name,
        type: activeWorkspace.type,
        createdAt: activeWorkspace.createdAt,
        updatedAt: activeWorkspace.updatedAt
      });
    }
  }

  async function duplicateWorkspaceById(id: string, customName?: string) {
    const { activeWorkspace, saveWorkspace, loadWorkspaceList } = getContext();
    if (activeWorkspace && activeWorkspace.id === id) {
      await saveWorkspace();
    }

    const response = await fetch(`/api/workspaces/${id}/duplicate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: customName })
    });

    const data = (await response.json()) as WorkspacePayload & { error?: string };
    if (!response.ok) {
      throw new Error(data.error || `另存为失败：HTTP ${response.status}`);
    }

    await loadWorkspaceList(data.id);
  }

  async function exportWorkspace(id?: string) {
    const { activeWorkspace, saveWorkspace } = getContext();
    const targetId = id || activeWorkspace?.id;
    if (!targetId) return;

    if (activeWorkspace && activeWorkspace.id === targetId) {
      await saveWorkspace();
    }

    const response = await fetch(`/api/workspaces/${targetId}`);
    if (!response.ok) {
      alert("导出失败");
      return;
    }
    const workspace = (await response.json()) as WorkspacePayload;
    const jsonStr = JSON.stringify(workspace, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    const safeName = sanitizeFileName(workspace.name || "workspace");
    link.download = `${safeName}_${dateStr}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function exportWorkspaceAsTemplate(id?: string) {
    const { activeWorkspace, saveWorkspace } = getContext();
    const targetId = id || activeWorkspace?.id;
    if (!targetId) return;

    if (activeWorkspace && activeWorkspace.id === targetId) {
      await saveWorkspace();
    }

    const response = await fetch(`/api/workspaces/${targetId}`);
    if (!response.ok) {
      alert("导出模板失败");
      return;
    }
    const workspace = (await response.json()) as WorkspacePayload;

    if (workspace.type === "board" && workspace.nodes) {
      workspace.nodes = workspace.nodes.map((n) => {
        const copyData = { ...n.data };
        delete copyData.artifact;
        delete copyData.batchArtifacts;
        delete copyData.singleRunningRowId;
        delete copyData.error;
        delete copyData.isRunning;
        return { ...n, data: copyData };
      });
    }

    const templatePayload = {
      ...workspace,
      name: `${workspace.name} 模板`,
      isTemplate: true
    };

    const jsonStr = JSON.stringify(templatePayload, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    const safeName = sanitizeFileName(workspace.name || "workspace");
    link.download = `${safeName}_模板_${dateStr}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importWorkspaceFile(file: File) {
    const { loadWorkspaceList } = getContext();
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const response = await fetch("/api/workspaces/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json)
      });
      const imported = (await response.json()) as WorkspacePayload & { error?: string };
      if (!response.ok) {
        throw new Error(imported.error || "导入画板失败");
      }
      await loadWorkspaceList(imported.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "无法解析并导入画板文件");
    }
  }

  async function saveWorkspaceAsTemplate(name: string, description: string) {
    const { saveAsTemplateWorkspace, activeWorkspace, saveWorkspace } = getContext();
    if (!saveAsTemplateWorkspace) return;
    if (activeWorkspace && activeWorkspace.id === saveAsTemplateWorkspace.id) {
      await saveWorkspace();
    }

    const response = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: saveAsTemplateWorkspace.id, name, description })
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      throw new Error(result.error || "保存为模板失败");
    }
  }

  function patchWorkspaceName(name: string) {
    const { setActiveWorkspace, setWorkspaces, activeWorkspaceRef, saveTimerRef, saveWorkspace } = getContext();
    const trimmed = name;
    setActiveWorkspace((workspace) => (workspace ? { ...workspace, name: trimmed } : workspace));
    setWorkspaces((items) =>
      items.map((item) => (item.id === activeWorkspaceRef.current?.id ? { ...item, name: trimmed } : item))
    );
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      void saveWorkspace();
    }, 400);
  }

  function stashArtifact(artifact: ArtifactData) {
    const { activeWorkspace, isArtifactStashed, activeWorkspaceRef, setActiveWorkspace, setWorkspaces, setIsStashOpen, saveWorkspace } = getContext();
    if (!activeWorkspace || activeWorkspace.type !== "board" || isArtifactStashed(artifact)) {
      return;
    }

    const item: StashItem = {
      id: createId("stash"),
      ...artifact
    };
    const nextStash = [item, ...(activeWorkspace.stashItems ?? [])];
    const nextWs: WorkspacePayload = {
      ...activeWorkspace,
      stashItems: nextStash
    };
    activeWorkspaceRef.current = nextWs;
    setActiveWorkspace(nextWs);
    setWorkspaces((items) => items.map((w) => (w.id === activeWorkspace.id ? { ...w, stashCount: nextStash.length } : w)));
    setIsStashOpen(true);
    void saveWorkspace(undefined, undefined, nextWs);
  }

  function toggleStashArtifact(artifact: ArtifactData) {
    const { activeWorkspace } = getContext();
    if (!activeWorkspace || activeWorkspace.type !== "board") return;
    const items = activeWorkspace.stashItems ?? [];
    const existing = items.find(
      (item) => item.fileName === artifact.fileName && item.audioDataUrl === artifact.audioDataUrl
    );

    if (existing) {
      deleteStashItem(existing.id);
    } else {
      stashArtifact(artifact);
    }
  }

  function deleteStashItem(itemId: string) {
    const { activeWorkspace, activeWorkspaceRef, setActiveWorkspace, setWorkspaces, saveWorkspace } = getContext();
    if (!activeWorkspace || activeWorkspace.type !== "board") {
      return;
    }

    const nextStash = (activeWorkspace.stashItems ?? []).filter((item) => item.id !== itemId);
    const nextWs: WorkspacePayload = {
      ...activeWorkspace,
      stashItems: nextStash
    };
    activeWorkspaceRef.current = nextWs;
    setActiveWorkspace(nextWs);
    setWorkspaces((items) =>
      items.map((workspace) =>
        workspace.id === activeWorkspace.id ? { ...workspace, stashCount: nextStash.length } : workspace
      )
    );
    void saveWorkspace(undefined, undefined, nextWs);
  }

  async function openLocalWorkspaceFolder(workspaceId?: string) {
    try {
      const desktop = (window as Window & { electronApi?: { openStorageFolder?: (kind: "workspace" | "audios", workspaceId?: string) => Promise<unknown> } }).electronApi;
      if (desktop?.openStorageFolder) { await desktop.openStorageFolder("workspace", workspaceId); return; }
      const res = await fetch("/api/workspaces/open-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId })
      });
      if (!res.ok) {
        throw new Error("无法在本地资源管理器中打开画板文件夹。");
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "打开本地文件夹失败。");
    }
  }

  async function openLocalAudiosFolder() {
    try {
      const desktop = (window as Window & { electronApi?: { openStorageFolder?: (kind: "workspace" | "audios", workspaceId?: string) => Promise<unknown> } }).electronApi;
      if (desktop?.openStorageFolder) { await desktop.openStorageFolder("audios"); return; }
      const res = await fetch("/api/workspaces/open-audios-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (!res.ok) {
        throw new Error("无法在本地资源管理器中打开音频输出目录。");
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "打开音频输出目录失败。");
    }
  }

  async function handleOptimizeCurrentWorkspace() {
    const { activeWorkspace, setAppToast } = getContext();
    if (!activeWorkspace) return;
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspace.id}/optimize`, {
        method: "POST"
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "整理画板失败");

      setAppToast({
        id: Date.now(),
        text: `✨ 成功整理并瘦身当前画板！已将 ${data.optimizedCount || 0} 个音频无损存至本地 audios 文件夹，大幅释放内存。`,
        actionText: "打开音频目录",
        onAction: () => void openLocalAudiosFolder()
      });
    } catch (err) {
      alert("整理画板失败：" + (err instanceof Error ? err.message : String(err)));
    }
  }

  function handleWorkspaceClick(event: React.MouseEvent, workspace: WorkspaceSummary, index: number) {
    const { setSelectedWorkspaceIds, setLastSelectedIndex, lastSelectedIndex, workspaces, loadWorkspace } = getContext();
    if (event.ctrlKey || event.metaKey) {
      setSelectedWorkspaceIds((prev) => {
        const next = new Set(prev);
        if (next.has(workspace.id)) {
          next.delete(workspace.id);
        } else {
          next.add(workspace.id);
        }
        return next;
      });
      setLastSelectedIndex(index);
    } else if (event.shiftKey && lastSelectedIndex !== null) {
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const rangeIds = workspaces.slice(start, end + 1).map((w) => w.id);
      setSelectedWorkspaceIds((prev) => new Set([...prev, ...rangeIds]));
    } else {
      setSelectedWorkspaceIds(new Set([workspace.id]));
      setLastSelectedIndex(index);
      void loadWorkspace(workspace.id);
    }
  }

  async function executeBatchDeleteWorkspaces(ids: string[]) {
    const { saveTimerRef, maxSaveTimerRef, setSelectedWorkspaceIds, setLastSelectedIndex, loadWorkspaceList } = getContext();
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (maxSaveTimerRef.current) {
      window.clearTimeout(maxSaveTimerRef.current);
      maxSaveTimerRef.current = null;
    }

    try {
      const res = await fetch("/api/workspaces/batch-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids })
      });
      if (!res.ok) throw new Error("批量删除失败。");
      const data = await res.json();
      setSelectedWorkspaceIds(new Set());
      setLastSelectedIndex(null);
      await loadWorkspaceList(data.activeWorkspaceId);
    } catch (err) {
      alert(err instanceof Error ? err.message : "批量删除失败。");
    }
  }

  async function promptBatchDeleteWorkspaces() {
    const { selectedWorkspaceIds } = getContext();
    const ids = Array.from(selectedWorkspaceIds);
    if (ids.length === 0) return;
    const confirmed = await showAppleConfirm({
      title: "批量删除画板",
      message: `确定要批量删除选中的 ${ids.length} 个画板吗？删除后画板数据不可恢复。`,
      confirmLabel: `删除画板 (${ids.length})`,
      cancelLabel: "取消",
      isDestructive: true,
      icon: "trash"
    });
    if (confirmed) {
      await executeBatchDeleteWorkspaces(ids);
    }
  }

  async function batchExportSelectedWorkspaces() {
    const { selectedWorkspaceIds, workspaces } = getContext();
    const ids = Array.from(selectedWorkspaceIds);
    if (ids.length === 0) return;

    try {
      const res = await fetch("/api/workspaces/batch-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids })
      });
      if (!res.ok) throw new Error("批量导出失败。");
      const bundleData = await res.json();
      const text = JSON.stringify(bundleData, null, 2);
      const blob = new Blob([text], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      const selectedNames = workspaces
        .filter((w) => selectedWorkspaceIds.has(w.id))
        .map((w) => sanitizeFileName(w.name));
      let exportName = "画板导出";
      if (selectedNames.length === 1) {
        exportName = selectedNames[0];
      } else if (selectedNames.length > 1) {
        exportName = `${selectedNames[0]}等${selectedNames.length}个画板`;
      }
      a.download = `${exportName}_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "批量导出失败。");
    }
  }

  return { executeDeleteWorkspace, promptDeleteCurrentWorkspace, openSaveAsModal, duplicateWorkspaceById, exportWorkspace, exportWorkspaceAsTemplate, importWorkspaceFile, saveWorkspaceAsTemplate, patchWorkspaceName, stashArtifact, toggleStashArtifact, deleteStashItem, openLocalWorkspaceFolder, openLocalAudiosFolder, handleOptimizeCurrentWorkspace, handleWorkspaceClick, executeBatchDeleteWorkspaces, promptBatchDeleteWorkspaces, batchExportSelectedWorkspaces };
}
