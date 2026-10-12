import { StudioTopbar } from "../components/studio/StudioTopbar";
import { ApiSettingsDialog } from "../components/studio/ApiSettingsDialog";
import { AppearanceSettingsDialog } from "../components/studio/AppearanceSettingsDialog";
import { StorageSettingsDialog } from "../components/studio/StorageSettingsDialog";
import { AppleConfirmDialog } from "../components/studio/AppleConfirmDialog";
import { WorkspaceSidebar } from "../components/studio/WorkspaceSidebar";
import { BoardCanvas } from "../components/studio/BoardCanvas";
import { createSynthesisActions } from "./synthesisActions";
import { createAudiobookActions } from "./audiobookActions";
import { createStorageActions } from "./storageActions";
import { createWorkspaceActions } from "./workspaceActions";
import type { AppleConfirmOptions } from "./confirmation";
import type { ArtifactData, AudioAsset } from "../types/studioAudio";
import type { LayoutNodeInput, LayoutEdgeInput } from "../utils/layout";
import type { ProviderOptions } from "../utils/providerConfig";
import type { ReactFlowInstance, NodeChange, Connection, FinalConnectionState } from "@xyflow/react";
import { STUDIO_NODE_TYPES, STUDIO_EDGE_TYPES } from "../components/nodes/nodeRegistry";
import type { StatusResponse, WorkspaceSummary, WorkspacePayload, StudioNode, StudioEdge, StudioNodeType, NodeData, ApiSettingsResponse, WorkspacesResponse } from "../types/studio";
import type { ThemeConfig } from "./theme";
import { API_KEY_STORAGE_KEY, DEFAULT_API_KEY, API_ENDPOINT_STORAGE_KEY, DEFAULT_API_ENDPOINT, API_PROVIDER_STORAGE_KEY, API_PROVIDERS, NODE_COLOR_MAP, getNodeDefaultData } from "./config";
import { AudiobookConsole } from "../components/audiobook/AudiobookConsole";
import { BoardCreateDialog } from "../components/dialogs/BoardCreateDialog";
import { ExportWorkspaceModal } from "../components/dialogs/ExportWorkspaceModal";
import { FileDown, AlertTriangle, X, CheckCircle2 } from "lucide-react";
import { NodeSearchModal } from "../components/dialogs/NodeSearchModal";
import { SaveAsModal } from "../components/dialogs/SaveAsModal";
import { SaveAsTemplateModal } from "../components/dialogs/SaveAsTemplateModal";
import { WorkspaceSaveQueue } from "../utils/workspaceSaveQueue";
import { ZipExportProgress } from "../components/ZipExportProgress";
import { computeSmartDagLayout, getDownstreamNodeIds } from "../utils/layout";
import { createId, formatDateForFile } from "./format";
import { getAudioFileExtension, formatHierarchyName, buildApiHeaders, sanitizeFileName, getArtifactDownloadFileName } from "../utils/audioNaming";
import { getInitialTheme, resolveSystemMode, lightPresets, darkPresets, applyThemeVariables, getThemeNodeColors } from "./theme";
import { identityMemo, IntegratedNameIndex, pruneMap } from "../utils/boardPerformance";
import { normalizeProviderOptions } from "../utils/providerConfig";
import { setAppleConfirmHandler } from "./confirmation";
import { stripHeavyDataForCache } from "../utils/cache";
import { stripNodeCallbacks, ensureArtifactSeqIndexes } from "./graph";
import { supportsMimoWorkflow, MIMO_WORKFLOW_NOTICE } from "../utils/providerSupport";
import { useAudioZipExport } from "../utils/useAudioZipExport";
import { useDownloadSettings } from "../utils/useDownloadSettings";
import { useNodesState, useEdgesState, addEdge } from "@xyflow/react";
import { useSmoothCanvasZoom } from "../utils/useSmoothCanvasZoom";
import { useState, useEffect, useCallback, useRef, useMemo, useLayoutEffect, startTransition, MouseEvent } from "react";

export function StudioApp() {

  const {
    runAudioMerge,
    runVoiceClone,
    deleteBatchArtifactItem,
    deleteIntegratedArtifactItem,
    runIntegratedBatch,
    runIntegratedSingleRow,
    runBatchVoiceClone,
    runSingleRowBatchVoiceClone,
    runBatchVoiceDesign,
    runSingleRowBatchVoiceDesign,
    runVoiceDesign,
    runGameVocalClone,
    optimizeVoiceStyle,
    optimizeVoiceDesign,
  } = createSynthesisActions(() => ({
    nodesRef,
    edgesRef,
    patchNode,
    setNodes,
    saveWorkspace,
    isAnyApiKeyReady,
    providerOptionsRef,
    getApiHeaders,
    setEdges,
    activeWorkspace,
    vocalAbortMapRef,
  }));

  const {
    createAudiobookWorkspace,
    patchAudiobook,
    addAudiobookChapter,
    activateAudiobookChapter,
    createAudiobookCharacter,
    analyzeAudiobookCharacters,
    generateCharacterVoice,
    deleteCharacterVoice,
    autoAnnotateAudiobook,
    updateAudiobookSegment,
    generateAudiobookAudio,
    retryAudiobookProduct,
    pollAudiobookGeneration,
    wait,
  } = createAudiobookActions(() => ({ apiProviderRef, providerOptionsRef, getApiHeaders, loadWorkspaceList, setActiveWorkspace, activeWorkspace }));

  const { loadStoragePathInfo, selectFolderAndSave, saveCustomStoragePath, resetStoragePath } = createStorageActions(() => ({ setStoragePathInfo, setCustomPathInput, loadWorkspaceList, customPathInput }));

  const {
    executeDeleteWorkspace,
    promptDeleteCurrentWorkspace,
    openSaveAsModal,
    duplicateWorkspaceById,
    exportWorkspace,
    exportWorkspaceAsTemplate,
    importWorkspaceFile,
    saveWorkspaceAsTemplate,
    patchWorkspaceName,
    stashArtifact,
    toggleStashArtifact,
    deleteStashItem,
    openLocalWorkspaceFolder,
    openLocalAudiosFolder,
    handleOptimizeCurrentWorkspace,
    handleWorkspaceClick,
    executeBatchDeleteWorkspaces,
    promptBatchDeleteWorkspaces,
    batchExportSelectedWorkspaces,
  } = createWorkspaceActions(() => ({
    saveTimerRef,
    maxSaveTimerRef,
    setActiveWorkspace,
    setNodes,
    setEdges,
    loadWorkspaceList,
    activeWorkspace,
    setSaveAsTargetWorkspace,
    saveWorkspace,
    saveAsTemplateWorkspace,
    setWorkspaces,
    activeWorkspaceRef,
    isArtifactStashed,
    setIsStashOpen,
    setAppToast,
    setSelectedWorkspaceIds,
    setLastSelectedIndex,
    lastSelectedIndex,
    workspaces,
    loadWorkspace,
    selectedWorkspaceIds,
  }));

  const [themeConfig, setThemeConfig] = useState<ThemeConfig>(getInitialTheme);
  const [systemMode, setSystemMode] = useState<"dark" | "light">(resolveSystemMode);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      setSystemMode(e.matches ? "dark" : "light");
    };
    mq.addEventListener("change", handler);

    const unsubscribe = (window as any).electronApi?.onNativeThemeChanged?.((data: any) => {
      setSystemMode(data.shouldUseDarkColors ? "dark" : "light");
    });

    return () => {
      mq.removeEventListener("change", handler);
      unsubscribe?.();
    };
  }, []);

  const effectiveMode = themeConfig.mode === "system" ? systemMode : themeConfig.mode;
  const isLight = effectiveMode === "light";
  const activeThemeColors = isLight ? themeConfig.lightTheme : themeConfig.darkTheme;
  const nodeColors = useMemo(() => getThemeNodeColors(activeThemeColors, isLight, themeConfig.nodePalette || "apple"), [activeThemeColors, isLight, themeConfig.nodePalette]);
  const [showAppearanceModal, setShowAppearanceModal] = useState(false);
  const [showLightCustomColors, setShowLightCustomColors] = useState(false);
  const [showDarkCustomColors, setShowDarkCustomColors] = useState(false);
  const [showStoragePathModal, setShowStoragePathModal] = useState(false);
  const [appleConfirmState, setAppleConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message?: string;
    confirmLabel: string;
    cancelLabel: string;
    isDestructive: boolean;
    icon: "trash" | "warning" | "info" | "sparkles";
    resolve: (val: boolean) => void;
  } | null>(null);

  useEffect(() => {
    setAppleConfirmHandler((opts: AppleConfirmOptions) => {
      return new Promise<boolean>((resolve) => {
        setAppleConfirmState({
          isOpen: true,
          title: opts.title,
          message: opts.message,
          confirmLabel: opts.confirmLabel ?? (opts.isDestructive !== false ? "清空" : "确定"),
          cancelLabel: opts.cancelLabel ?? "取消",
          isDestructive: opts.isDestructive !== false,
          icon: opts.icon ?? (opts.isDestructive !== false ? "trash" : "warning"),
          resolve
        });
      });
    });
    return () => {
      setAppleConfirmHandler(null);
    };
  }, []);

  const handleAppleConfirmClose = useCallback((result: boolean) => {
    if (appleConfirmState) {
      appleConfirmState.resolve(result);
      setAppleConfirmState(null);
    }
  }, [appleConfirmState]);

  useEffect(() => {
    if (!appleConfirmState?.isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleAppleConfirmClose(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [appleConfirmState, handleAppleConfirmClose]);

  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => { }
  });
  const [appToast, setAppToast] = useState<{
    id: number;
    text: string;
    actionText?: string;
    onAction?: () => void;
  } | null>(null);

  const modalBackdropMouseDownRef = useRef<EventTarget | null>(null);

  function handleBackdropMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    modalBackdropMouseDownRef.current = e.target;
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>, onClose: () => void) {
    if (e.target === e.currentTarget && modalBackdropMouseDownRef.current === e.currentTarget) {
      onClose();
    }
  }

  const showToast = useCallback((text: string, actionText?: string, onAction?: () => void) => {
    const id = Date.now();
    setAppToast({ id, text, actionText, onAction });
    window.setTimeout(() => {
      setAppToast((curr) => (curr?.id === id ? null : curr));
    }, 5000);
  }, []);

  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);



  const initialBootstrap = useMemo(() => {
    if (typeof window !== "undefined" && (window as any).__MIMO_INITIAL_BOOTSTRAP__) {
      return (window as any).__MIMO_INITIAL_BOOTSTRAP__;
    }
    return null;
  }, []);

  const initialCachedWorkspaces = useMemo<WorkspaceSummary[]>(() => {
    if (initialBootstrap?.workspaces && Array.isArray(initialBootstrap.workspaces) && initialBootstrap.workspaces.length > 0) {
      return initialBootstrap.workspaces;
    }
    try {
      const raw = localStorage.getItem("mimo_cached_workspaces");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }, [initialBootstrap]);

  const initialCachedActiveWorkspace = useMemo<WorkspacePayload | null>(() => {
    if (initialBootstrap?.activeWorkspace) {
      return initialBootstrap.activeWorkspace as WorkspacePayload;
    }
    try {
      const raw = localStorage.getItem("mimo_cached_active_workspace");
      return raw ? (JSON.parse(raw) as WorkspacePayload) : null;
    } catch {
      return null;
    }
  }, [initialBootstrap]);

  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>(initialCachedWorkspaces);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspacePayload | null>(initialCachedActiveWorkspace);
  const [nodes, setNodes, onNodesChange] = useNodesState<StudioNode>(
    initialCachedActiveWorkspace?.type === "board" && Array.isArray(initialCachedActiveWorkspace.nodes)
      ? initialCachedActiveWorkspace.nodes
      : []
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<StudioEdge>(
    initialCachedActiveWorkspace?.type === "board" && Array.isArray(initialCachedActiveWorkspace.edges)
      ? initialCachedActiveWorkspace.edges
      : []
  );
  const selectedNodesCount = useMemo(() => nodes.filter((n) => n.selected).length, [nodes]);
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    flowX: number;
    flowY: number;
    sourceNodeId?: string;
    sourceHandleId?: string | null;
    sourceHandleType?: "source" | "target";
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const workspaceSaveQueue = useRef(new WorkspaceSaveQueue());

  async function sendWorkspaceSnapshot(id: string, body: Record<string, unknown>) {
    return workspaceSaveQueue.current.save(id, body, async snapshot => {
      const response = await fetch(`/api/workspaces/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(snapshot)
      });
      const saved = await response.json() as WorkspacePayload & { error?: string };
      if (!response.ok) throw new Error(saved.error || `保存失败：HTTP ${response.status}`);
      return saved;
    });
  }

  function exportUnsavedBackup() {
    const failed = workspaceSaveQueue.current.getFailedSnapshots();
    const current = activeWorkspaceRef.current;
    const draft = current ? {
      ...current,
      ...(current.type === "board" ? { nodes: nodesRef.current.map(stripNodeCallbacks), edges: edgesRef.current } : {})
    } : null;
    const workspaces = [
      ...(draft ? [draft] : []),
      ...failed.filter(item => item.id !== draft?.id).map(item => ({ ...item, type: "chapters" in item ? "audiobook" : "board" }))
    ];
    const blob = new Blob([JSON.stringify({ format: "mimo-unsaved-backup", createdAt: new Date().toISOString(), workspaces, failedSnapshots: failed }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = "MiMo-未保存编辑备份.json"; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const [isStashOpen, setIsStashOpen] = useState(false);
  const [boardDialog, setBoardDialog] = useState<"choice" | "templates" | "smart" | "audiobook" | null>(null);
  const flowRef = useRef<ReactFlowInstance<StudioNode, StudioEdge> | null>(null);
  const clipboardRef = useRef<{ nodes: StudioNode[]; edges: StudioEdge[] } | null>(null);

  const undoStackRef = useRef<{ nodes: StudioNode[]; edges: StudioEdge[] }[]>([]);
  const redoStackRef = useRef<{ nodes: StudioNode[]; edges: StudioEdge[] }[]>([]);
  const isUndoingRef = useRef<boolean>(false);
  const lastRecordedRef = useRef<string>("");

  useEffect(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    lastRecordedRef.current = "";
    if (activeWorkspace?.id) {
      try {
        localStorage.setItem("mimo_last_active_id", activeWorkspace.id);
      } catch { }
    }
  }, [activeWorkspace?.id]);

  useEffect(() => {
    if (workspaces.length > 0) {
      try {
        localStorage.setItem("mimo_cached_workspaces", JSON.stringify(workspaces));
      } catch { }
    }
  }, [workspaces]);

  useLayoutEffect(() => {
    const activeColors = isLight ? themeConfig.lightTheme : themeConfig.darkTheme;
    const clientTheme = {
      mode: themeConfig.mode,
      isLight,
      bgColor: activeColors.bgColor,
      lightBgColor: themeConfig.lightTheme.bgColor,
      darkBgColor: themeConfig.darkTheme.bgColor
    };

    // 双重 requestAnimationFrame 确保 React DOM 节点全部提交至 GPU 显存帧缓冲后再通知 Electron 显现窗口，底色与主题完全一致
    const raf1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (typeof window !== "undefined" && (window as any).electronApi?.notifyReady) {
          (window as any).electronApi.notifyReady(clientTheme);
        }
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
    };
  }, []);

  const saveTimerRef = useRef<number | null>(null);
  const switchingTargetIdRef = useRef<string | null>(initialCachedActiveWorkspace?.id || null);
  const lastSavedOrLoadedKeyRef = useRef<string>("");
  const flowWrapRef = useRef<HTMLDivElement | null>(null);
  const canvasMotion = useSmoothCanvasZoom(flowWrapRef, flowRef, activeWorkspace?.type === "board" ? activeWorkspace.id : undefined);
  const jsonFileInputRef = useRef<HTMLInputElement | null>(null);
  const rightDragRef = useRef<{
    startX: number;
    startY: number;
    startTime: number;
    startViewportX: number;
    startViewportY: number;
    moved: boolean;
  } | null>(null);
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem(API_KEY_STORAGE_KEY) || DEFAULT_API_KEY;
  });
  const [serverApiKeyConfigured, setServerApiKeyConfigured] = useState<boolean>(() => {
    if (initialBootstrap?.settings) {
      return Boolean(initialBootstrap.settings.hasApiKey || initialBootstrap.settings.configured);
    }
    return localStorage.getItem("mimo_cached_server_configured") === "true";
  });
  const [isSettingsLoaded, setIsSettingsLoaded] = useState<boolean>(() => {
    return Boolean(initialBootstrap?.settings) || localStorage.getItem("mimo_cached_server_configured") !== null || !!localStorage.getItem(API_KEY_STORAGE_KEY);
  });
  const [apiEndpoint, setApiEndpoint] = useState<string>(() => {
    if (initialBootstrap?.settings?.apiEndpoint) return initialBootstrap.settings.apiEndpoint;
    return localStorage.getItem(API_ENDPOINT_STORAGE_KEY) || DEFAULT_API_ENDPOINT;
  });
  const [apiProvider, setApiProvider] = useState<string>(() => {
    if (initialBootstrap?.settings?.apiProvider) return initialBootstrap.settings.apiProvider;
    return localStorage.getItem(API_PROVIDER_STORAGE_KEY) || "mimo";
  });

  const [providerOptions, setProviderOptions] = useState<ProviderOptions>(() => normalizeProviderOptions(initialBootstrap?.settings));
  const providerOptionsRef = useRef(providerOptions);
  providerOptionsRef.current = providerOptions;
  const [providerOptionsInput, setProviderOptionsInput] = useState(providerOptions);
  const [settingsError, setSettingsError] = useState("");
  const apiKeyRef = useRef(apiKey);
  apiKeyRef.current = apiKey;
  const serverApiKeyConfiguredRef = useRef(serverApiKeyConfigured);
  serverApiKeyConfiguredRef.current = serverApiKeyConfigured;
  const apiEndpointRef = useRef(apiEndpoint);
  apiEndpointRef.current = apiEndpoint;
  const apiProviderRef = useRef(apiProvider);
  apiProviderRef.current = apiProvider;

  const isAnyApiKeyReady = useCallback(() => {
    return Boolean(
      (apiKeyRef.current && apiKeyRef.current.trim()) ||
      serverApiKeyConfiguredRef.current ||
      localStorage.getItem(API_KEY_STORAGE_KEY)
    );
  }, []);

  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(apiKey);
  const [apiEndpointInput, setApiEndpointInput] = useState(apiEndpoint);
  const [apiProviderInput, setApiProviderInput] = useState(apiProvider);
  const [topbarCollapsed, setTopbarCollapsed] = useState(false);
  const [showDefaultKeyWarning, setShowDefaultKeyWarning] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = localStorage.getItem("mimo_sidebar_width");
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= 200 && parsed <= 700) {
        return parsed;
      }
    }
    return 280;
  });
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);

  const handleSidebarResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingSidebar(true);

    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const onMouseMove = (moveEvent: globalThis.MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(200, Math.min(700, startWidth + deltaX));
      setSidebarWidth(newWidth);
    };

    const onMouseUp = () => {
      setIsResizingSidebar(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      setSidebarWidth((latestWidth) => {
        localStorage.setItem("mimo_sidebar_width", String(latestWidth));
        return latestWidth;
      });
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [sidebarWidth]);

  const handleSidebarResetWidth = useCallback(() => {
    setSidebarWidth(280);
    localStorage.setItem("mimo_sidebar_width", "280");
  }, []);
  const [saveAsTargetWorkspace, setSaveAsTargetWorkspace] = useState<WorkspaceSummary | null>(null);
  const [saveAsTemplateWorkspace, setSaveAsTemplateWorkspace] = useState<WorkspaceSummary | null>(null);
  const [selectedWorkspaceIds, setSelectedWorkspaceIds] = useState<Set<string>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportInitialTargetId, setExportInitialTargetId] = useState<string | undefined>(undefined);
  const [isDraggingJson, setIsDraggingJson] = useState(false);
  const [storagePathInfo, setStoragePathInfo] = useState<{ dataDir: string; workspaceFilePath: string; isCustom: boolean } | null>(null);
  const [customPathInput, setCustomPathInput] = useState("");
  const [singleDownloadSettings, setSingleDownloadSettings] = useDownloadSettings();
  const stashZipExport = useAudioZipExport();
  const [bgVariant, setBgVariant] = useState<"dots" | "lines" | "cross" | "none">(
    () => (localStorage.getItem("mimo_bg_variant") as "dots" | "lines" | "cross" | "none") || "dots"
  );
  const [showNodeSearchModal, setShowNodeSearchModal] = useState(false);

  function updateBgVariant(variant: "dots" | "lines" | "cross" | "none") {
    setBgVariant(variant);
    localStorage.setItem("mimo_bg_variant", variant);
  }

  useEffect(() => {
    if (activeWorkspace?.name) {
      document.title = `${activeWorkspace.name} - MiMo 音色复刻调试台`;
    } else {
      document.title = "MiMo 音色复刻调试台";
    }
  }, [activeWorkspace?.name]);

  const tidyWorkspaceNodes = useCallback((onlySelected?: boolean) => {
    const allNodes = nodesRef.current;
    const allEdges = edgesRef.current;
    if (!allNodes || allNodes.length === 0) return;

    // Check if user has selected multiple nodes
    const selectedNodesList = allNodes.filter((n) => n.selected);
    const isSelectionMode = (onlySelected === true || (selectedNodesList.length >= 2 && onlySelected !== false)) && selectedNodesList.length < allNodes.length;

    const targetNodes = isSelectionMode ? selectedNodesList : allNodes;
    const targetNodeIds = new Set(targetNodes.map((n) => n.id));
    const targetEdges = allEdges.filter((e) => targetNodeIds.has(e.source) && targetNodeIds.has(e.target));

    function getNodeWidth(node: StudioNode): number {
      if (node.measured?.width && node.measured.width > 50) {
        return node.measured.width;
      }
      const t = node.type as StudioNodeType;
      if (t === "batchVoiceDesign") return 880;
      if (t === "batchVoiceClone" || t === "integratedStudio" || t === "gameVocal") return 660;
      if (t === "batchArtifact") return 440;
      if (t === "voiceDesign" || t === "voiceClone") return 360;
      if (t === "referenceAudio" || t === "audioMerge") return 340;
      if (t === "comment") return 280;
      return 340;
    }

    function getNodeHeight(node: StudioNode): number {
      if (node.measured?.height && node.measured.height > 50) {
        return node.measured.height;
      }
      const t = node.type as StudioNodeType;
      if (t === "gameVocal") return 620;
      if (t === "batchVoiceDesign" || t === "batchVoiceClone") {
        const rowCount = node.data.batchRows?.length || 1;
        return Math.max(460, 180 + rowCount * 75);
      }
      if (t === "integratedStudio") {
        const rowCount = node.data.batchRows?.length || 1;
        return Math.max(640, 240 + rowCount * 75);
      }
      if (t === "batchArtifact") {
        const count = node.data.batchArtifacts?.length || 0;
        if (count === 0) return 260;
        return Math.max(340, 110 + count * 85);
      }
      if (t === "artifact") return 145;
      if (t === "voiceDesign") return 640;
      if (t === "voiceClone") return 380;
      if (t === "referenceAudio" || t === "audioMerge") return 220;
      if (t === "comment") return 200;
      return 260;
    }

    const originBaseX = isSelectionMode ? Math.min(...targetNodes.map((n) => n.position.x)) : 80;
    const originBaseY = isSelectionMode ? Math.min(...targetNodes.map((n) => n.position.y)) : 80;

    const layoutInputNodes: LayoutNodeInput[] = targetNodes.map((n) => ({
      id: n.id,
      type: n.type || "default",
      width: getNodeWidth(n),
      height: getNodeHeight(n),
      originalX: n.position.x,
      originalY: n.position.y,
      seqIndex: n.data.seqIndex
    }));

    const layoutInputEdges: LayoutEdgeInput[] = targetEdges.map((e) => ({
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle
    }));

    const nodePositions = computeSmartDagLayout(layoutInputNodes, layoutInputEdges, originBaseX, originBaseY);

    const nextNodes = allNodes.map((node) => {
      if (nodePositions.has(node.id)) {
        return {
          ...node,
          position: nodePositions.get(node.id)!
        };
      }
      return node;
    });

    setNodes(nextNodes);
    window.setTimeout(() => {
      if (!isSelectionMode) {
        flowRef.current?.fitView({ padding: 0.2, duration: 400, minZoom: 0.005 });
      }
      void saveWorkspace();
    }, 60);
  }, [setNodes]);

  const handleSelectSearchNode = useCallback(async (workspaceId: string, node: StudioNode) => {
    setShowNodeSearchModal(false);
    if (!activeWorkspaceRef.current || activeWorkspaceRef.current.id !== workspaceId) {
      await loadWorkspace(workspaceId);
    }
    window.setTimeout(() => {
      if (flowRef.current) {
        flowRef.current.setCenter(node.position.x + 160, node.position.y + 140, { zoom: 1.2, duration: 800 });
      }
    }, 180);
  }, []);
  const topbarHoverTimerRef = useRef<number | null>(null);

  function openExportModal(targetId?: string) {
    setExportInitialTargetId(targetId);
    setShowExportModal(true);
  }

  useEffect(() => {
    const root = document.documentElement;
    const activeColors = isLight ? themeConfig.lightTheme : themeConfig.darkTheme;

    applyThemeVariables(root, activeColors, isLight, themeConfig.nodePalette || "apple");

    try {
      localStorage.setItem("mimo_theme_settings", JSON.stringify(themeConfig));
      if (typeof window !== "undefined" && (window as any).electronApi?.saveTheme) {
        (window as any).electronApi.saveTheme({
          mode: themeConfig.mode,
          isLight,
          bgColor: activeColors.bgColor,
          lightBgColor: themeConfig.lightTheme.bgColor,
          darkBgColor: themeConfig.darkTheme.bgColor
        });
      }
    } catch { /* ignore */ }
  }, [themeConfig, effectiveMode, isLight]);

  function updateMode(mode: ThemeConfig["mode"]) {
    setThemeConfig((prev) => ({ ...prev, mode }));
  }

  function updateLightThemePreset(preset: string) {
    if (preset === "custom") {
      setThemeConfig((prev) => ({ ...prev, lightTheme: { ...prev.lightTheme, preset: "custom" } }));
      return;
    }
    const p = lightPresets[preset];
    if (!p) return;
    setThemeConfig((prev) => ({
      ...prev,
      lightTheme: { preset, bgColor: p.bgColor, fgColor: p.fgColor, accentColor: p.accentColor, nodeColor: p.nodeColor }
    }));
  }

  function updateDarkThemePreset(preset: string) {
    if (preset === "custom") {
      setThemeConfig((prev) => ({ ...prev, darkTheme: { ...prev.darkTheme, preset: "custom" } }));
      return;
    }
    const p = darkPresets[preset];
    if (!p) return;
    setThemeConfig((prev) => ({
      ...prev,
      darkTheme: { preset, bgColor: p.bgColor, fgColor: p.fgColor, accentColor: p.accentColor, nodeColor: p.nodeColor }
    }));
  }

  function updateLightColor(field: "bgColor" | "fgColor" | "accentColor" | "nodeColor", val: string) {
    setThemeConfig((prev) => ({
      ...prev,
      lightTheme: { ...prev.lightTheme, preset: "custom", [field]: val }
    }));
  }

  function updateDarkColor(field: "bgColor" | "fgColor" | "accentColor" | "nodeColor", val: string) {
    setThemeConfig((prev) => ({
      ...prev,
      darkTheme: { ...prev.darkTheme, preset: "custom", [field]: val }
    }));
  }

  function resetLightPreset() {
    updateLightThemePreset("default");
  }

  function resetDarkPreset() {
    updateDarkThemePreset("default");
  }

  function updateBrandTitle(field: "brandTitleZh" | "brandTitleEn", val: string) {
    setThemeConfig((prev) => ({
      ...prev,
      [field]: val
    }));
  }

  function updateAutoHideTopbar(val: boolean) {
    setThemeConfig((prev) => ({
      ...prev,
      autoHideTopbar: val
    }));
    if (!val) {
      setTopbarCollapsed(false);
      if (topbarHoverTimerRef.current) {
        window.clearTimeout(topbarHoverTimerRef.current);
        topbarHoverTimerRef.current = null;
      }
    }
  }

  function resetTheme() {
    localStorage.removeItem("mimo_theme_settings");
    setThemeConfig({
      mode: "system",
      nodePalette: "apple",
      lightTheme: { preset: "default", ...lightPresets.default },
      darkTheme: { preset: "default", ...darkPresets.default },
      brandTitleZh: "",
      brandTitleEn: "",
      autoHideTopbar: true
    });
    setTopbarCollapsed(false);
  }

  const getNodeDataDigest = useMemo(() => identityMemo((data: NodeData): string => {
    const d = data as Record<string, any>;
    // 提取音频资产轻量特征，杜绝遍历与 dump 几兆几十兆的 Base64 文本
    const audioDigest = d.audio
      ? `${d.audio.fileName || ""}_${d.audio.size || 0}_${d.audio.dataUrl ? d.audio.dataUrl.length : 0}`
      : "";
    const audioAssetsDigest = Array.isArray(d.audioAssets)
      ? d.audioAssets.map((a: any) => `${a.fileName || ""}_${a.size || 0}_${a.dataUrl ? a.dataUrl.length : 0}`).join(",")
      : "";
    const artifactDigest = d.artifact
      ? `${d.artifact.id || ""}_${d.artifact.createdAt || ""}_${d.artifact.audioDataUrl ? d.artifact.audioDataUrl.length : 0}`
      : "";
    const batchArtifactsDigest = Array.isArray(d.batchArtifacts)
      ? d.batchArtifacts.map((a: any) => `${a.id || ""}_${a.audioDataUrl ? a.audioDataUrl.length : 0}`).join(",")
      : "";
    const batchRowsDigest = Array.isArray(d.batchRows)
      ? d.batchRows.map((r: any) => `${r.id || ""}_${r.title || ""}_${r.text || ""}_${r.instruction || ""}_${r.artifacts ? r.artifacts.length : 0}_${r.audio ? r.audio.size : 0}`).join(",")
      : "";

    return `${d.title || ""}:${d.instruction || ""}:${d.text || ""}:${d.voiceDescription || ""}:${d.audioText || ""}:${d.naturalControl || ""}:${d.seed ?? ""}:${d.comment || ""}:${d.parentTitle || ""}:${audioDigest}:${audioAssetsDigest}:${artifactDigest}:${batchArtifactsDigest}:${batchRowsDigest}`;
  }), []);

  const getNodeDigest = useCallback((n: StudioNode) =>
    `${n.id}:${n.type}:${Math.round(n.position?.x ?? 0)},${Math.round(n.position?.y ?? 0)}:${getNodeDataDigest(n.data)}`, [getNodeDataDigest]);

  const computeWorkspaceKey = useCallback((ws: WorkspacePayload | null, currentNodes: StudioNode[], currentEdges: StudioEdge[]) => {
    if (!ws) return "";
    if (ws.type === "audiobook") {
      return JSON.stringify({
        id: ws.id,
        name: ws.name,
        novelText: ws.novelText,
        characterHints: ws.characterHints,
        characters: ws.characters,
        segments: ws.segments,
        products: ws.products,
        phase: ws.phase
      });
    }
    const nodeDataHash = currentNodes.map(getNodeDigest).join("|");
    const edgeDataHash = currentEdges.map((e) => `${e.id}:${e.source}:${e.target}:${e.sourceHandle || ""}:${e.targetHandle || ""}`).join("|");
    const stashDigest = (ws.stashItems || []).map((s) => `${s.id || ""}_${s.fileName || ""}_${s.audioDataUrl ? s.audioDataUrl.length : 0}`).join(",");
    return `${ws.id}:${ws.name}:${currentNodes.length}:${currentEdges.length}:${nodeDataHash}:${edgeDataHash}:${stashDigest}`;
  }, [getNodeDigest]);

  const settledAutoSaveKey = useRef("");
  const autoSaveKey = useMemo(() => {
    // Save positions once movement settles, instead of hashing every pointer event.
    if (nodes.some(node => node.dragging)) return settledAutoSaveKey.current;
    const key = computeWorkspaceKey(activeWorkspace, nodes, edges);
    settledAutoSaveKey.current = key;
    return key;
  }, [activeWorkspace, nodes, edges, computeWorkspaceKey]);

  useEffect(() => {
    if (initialCachedActiveWorkspace) {
      const initNodes = initialCachedActiveWorkspace.type === "board" && Array.isArray(initialCachedActiveWorkspace.nodes)
        ? initialCachedActiveWorkspace.nodes
        : [];
      const initEdges = initialCachedActiveWorkspace.type === "board" && Array.isArray(initialCachedActiveWorkspace.edges)
        ? initialCachedActiveWorkspace.edges
        : [];
      lastSavedOrLoadedKeyRef.current = computeWorkspaceKey(initialCachedActiveWorkspace, initNodes, initEdges);
    }
    void loadBootstrap();
    void loadStoragePathInfo();

    if (themeConfig.autoHideTopbar ?? true) {
      topbarHoverTimerRef.current = window.setTimeout(() => {
        setTopbarCollapsed(true);
      }, 1500);
    }

    return () => {
      if (topbarHoverTimerRef.current) {
        window.clearTimeout(topbarHoverTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (themeConfig.autoHideTopbar === false) {
      setTopbarCollapsed(false);
      if (topbarHoverTimerRef.current) {
        window.clearTimeout(topbarHoverTimerRef.current);
        topbarHoverTimerRef.current = null;
      }
    }
  }, [themeConfig.autoHideTopbar]);

  useEffect(() => {
    function handleMouseMove(e: globalThis.MouseEvent) {
      if ((themeConfig.autoHideTopbar ?? true) && e.clientY < 20) {
        setTopbarCollapsed(false);
        if (topbarHoverTimerRef.current) {
          window.clearTimeout(topbarHoverTimerRef.current);
        }
      }
    }

    document.addEventListener("mousemove", handleMouseMove);
    return () => document.removeEventListener("mousemove", handleMouseMove);
  }, [themeConfig.autoHideTopbar]);

  useEffect(() => {
    function handleDragOver(e: globalThis.DragEvent) {
      e.preventDefault();
      if (!e.dataTransfer) return;

      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const isOverInteractiveDropzone = el && Boolean(
        el.closest(".file-picker") ||
        el.closest(".reference-audio-card") ||
        el.closest(".node-audio") ||
        el.closest(".integrated-cell") ||
        el.closest(".integrated-ref-card") ||
        el.closest(".integrated-pipeline-row") ||
        el.closest(".batch-row-card") ||
        el.closest(".studio-node") ||
        el.closest(".modal-backdrop") ||
        el.closest(".excel-modal-content") ||
        el.closest(".integrated-multi-audio-card")
      );

      // If hovering over a node dropzone, disable global JSON overlay so the node receives drop cleanly
      if (isOverInteractiveDropzone) {
        setIsDraggingJson(false);
        e.dataTransfer.dropEffect = "copy";
        return;
      }

      // Check if dragged item is audio/video
      const files = Array.from(e.dataTransfer.files || []);
      const items = Array.from(e.dataTransfer.items || []);

      const isAudio =
        files.some(
          (f) =>
            f.type.startsWith("audio/") ||
            f.type.startsWith("video/") ||
            /\.(mp3|wav|m4a|aac|ogg|flac|mp4|wma)$/i.test(f.name)
        ) ||
        items.some(
          (item) =>
            item.kind === "file" &&
            (item.type.startsWith("audio/") || item.type.startsWith("video/"))
        );

      if (isAudio) {
        setIsDraggingJson(false);
        e.dataTransfer.dropEffect = "copy";
        return;
      }

      const hasFiles =
        (e.dataTransfer.types && Array.from(e.dataTransfer.types).includes("Files")) ||
        items.some((item) => item.kind === "file");

      if (hasFiles) {
        e.dataTransfer.dropEffect = "copy";
        setIsDraggingJson(true);
      }
    }

    function handleDragLeave(e: globalThis.DragEvent) {
      if (
        e.clientX <= 0 ||
        e.clientY <= 0 ||
        e.clientX >= window.innerWidth ||
        e.clientY >= window.innerHeight
      ) {
        setIsDraggingJson(false);
      }
    }

    async function handleDrop(e: globalThis.DragEvent) {
      setIsDraggingJson(false);

      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const isOverInteractiveDropzone = el && Boolean(
        el.closest(".file-picker") ||
        el.closest(".reference-audio-card") ||
        el.closest(".node-audio") ||
        el.closest(".integrated-cell") ||
        el.closest(".integrated-ref-card") ||
        el.closest(".integrated-pipeline-row") ||
        el.closest(".batch-row-card") ||
        el.closest(".studio-node") ||
        el.closest(".modal-backdrop") ||
        el.closest(".excel-modal-content") ||
        el.closest(".integrated-multi-audio-card")
      );

      if (isOverInteractiveDropzone) {
        // Child dropzone handles file directly
        return;
      }

      e.preventDefault();
      if (!e.dataTransfer || !e.dataTransfer.files || e.dataTransfer.files.length === 0) {
        return;
      }

      const files = Array.from(e.dataTransfer.files);
      const jsonFiles = files.filter(
        (f) => f.name.toLowerCase().endsWith(".json") || f.type === "application/json"
      );
      if (jsonFiles.length === 0) return;
      for (const file of files) {
        try {
          const text = await file.text();
          let rawData: unknown;
          try {
            rawData = JSON.parse(text);
          } catch {
            continue;
          }

          if (!rawData || typeof rawData !== "object") continue;

          const res = await fetch("/api/workspaces/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(rawData)
          });

          if (res.ok) {
            const imported = await res.json();
            await loadWorkspaceList();
            if (imported && imported.id) {
              await loadWorkspace(imported.id);
            }
          } else {
            const errData = await res.json().catch(() => ({}));
            alert(`导入画板文件 [${file.name}] 失败：${errData.error || "数据结构不符合规范"}`);
          }
        } catch (err) {
          alert(`读取/导入文件 [${file.name}] 失败：` + (err instanceof Error ? err.message : String(err)));
        }
      }
    }

    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
    };
  }, []);

  const prevCountsRef = useRef({ nodeCount: nodes.length, edgeCount: edges.length });
  const maxSaveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!activeWorkspace) {
      return;
    }

    // 若当前哈希与最近加载或保存的一致，说明没有任何实际修改，坚决不触发网络保存
    if (autoSaveKey === lastSavedOrLoadedKeyRef.current) {
      return;
    }

    const hasCountChanged =
      prevCountsRef.current.nodeCount !== nodes.length ||
      prevCountsRef.current.edgeCount !== edges.length;

    prevCountsRef.current = { nodeCount: nodes.length, edgeCount: edges.length };

    const delay = hasCountChanged ? 200 : 800;

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      if (maxSaveTimerRef.current) {
        window.clearTimeout(maxSaveTimerRef.current);
        maxSaveTimerRef.current = null;
      }
      void saveWorkspace();
    }, delay);

    if (!maxSaveTimerRef.current) {
      maxSaveTimerRef.current = window.setTimeout(() => {
        if (saveTimerRef.current) {
          window.clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
        maxSaveTimerRef.current = null;
        void saveWorkspace();
      }, 2000);
    }

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [autoSaveKey]);

  useEffect(() => {
    function handleBeforeUnload() {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      void saveWorkspace();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        if (saveTimerRef.current) {
          window.clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
        void saveWorkspace();
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!activeWorkspace || activeWorkspace.type !== "board") return;
    const currentId = activeWorkspace.id;
    const curNodesCount = nodes.length;
    const curEdgesCount = edges.length;
    const curStashCount = activeWorkspace.stashItems?.length ?? 0;
    const curName = activeWorkspace.name;

    setWorkspaces((items) =>
      items.map((item) =>
        item.id === currentId
          ? {
            ...item,
            name: curName,
            nodeCount: curNodesCount,
            edgeCount: curEdgesCount,
            stashCount: curStashCount
          }
          : item
      )
    );
  }, [
    activeWorkspace?.id,
    activeWorkspace?.name,
    activeWorkspace?.type === "board" ? activeWorkspace.stashItems?.length : 0,
    nodes.length,
    edges.length
  ]);

  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const edgesRef = useRef(edges);
  edgesRef.current = edges;
  const activeWorkspaceRef = useRef(activeWorkspace);
  activeWorkspaceRef.current = activeWorkspace;
  const vocalAbortMapRef = useRef<Record<string, boolean>>({});

  const patchNode = useCallback(
    (nodeId: string, patch: Partial<NodeData>) => {
      if (patch.isRunning === false) {
        vocalAbortMapRef.current[nodeId] = true;
      }
      const currentNodes = nodesRef.current;
      const targetNode = currentNodes.find((n) => n.id === nodeId);
      const nextNodes = currentNodes.map((node) => (node.id === nodeId ? { ...node, data: { ...node.data, ...patch } } : node));
      nodesRef.current = nextNodes;
      setNodes(nextNodes);

      if (!targetNode) return;

      const oldTitle = targetNode.data.title;
      const newTitle = patch.title;
      const newBatchRows = patch.batchRows;

      // 1) When node title changes:
      if (newTitle !== undefined && newTitle !== oldTitle) {
        const isGeneratorNode =
          targetNode.type === "referenceAudio" ||
          targetNode.type === "voiceClone" ||
          targetNode.type === "voiceDesign" ||
          targetNode.type === "batchVoiceClone" ||
          targetNode.type === "batchVoiceDesign" ||
          targetNode.type === "integratedStudio" ||
          targetNode.type === "gameVocal";

        // Handle direct title edit on an artifact node (renaming an artifact node ONLY renames itself & its own stash item)
        if (targetNode.type === "artifact" && targetNode.data.artifact) {
          patch.artifact = {
            ...targetNode.data.artifact,
            sourceNodeName: newTitle,
            sourceNodeId: targetNode.id
          };

          // Update ONLY the stash item corresponding to this specific artifact node ID
          setActiveWorkspace((workspace) => {
            if (!workspace || workspace.type !== "board") return workspace;
            const currentStash = workspace.stashItems ?? [];
            if (currentStash.length === 0) return workspace;

            return {
              ...workspace,
              stashItems: currentStash.map((s) => (s.sourceNodeId === nodeId ? { ...s, sourceNodeName: newTitle, fileName: `${newTitle}${getAudioFileExtension(s.audioDataUrl, s.fileName)}` } : s))
            };
          });
        }

        // Only Generator nodes cascade down to downstream child nodes and stash items
        if (isGeneratorNode) {
          const currentEdges = edgesRef.current;
          const downstreamChildNodeIds = getDownstreamNodeIds(nodeId, currentEdges);

          const childNodesMap = new Map<string, StudioNode>();
          currentNodes.forEach((n) => {
            if (downstreamChildNodeIds.has(n.id)) {
              childNodesMap.set(n.id, n);
            }
          });

          setNodes((items) => {
            return items.map((node) => {
              if (downstreamChildNodeIds.has(node.id)) {
                if (
                  (node.type === "voiceClone" || node.type === "voiceDesign" || node.type === "batchVoiceClone") &&
                  (oldTitle ? node.data.title === oldTitle || node.data.title === "音频克隆" || node.data.title === "音色创造" : true)
                ) {
                  return {
                    ...node,
                    data: {
                      ...node.data,
                      title: newTitle
                    }
                  };
                }
                if (node.type === "artifact" && node.data.artifact) {
                  const seq = node.data.seqIndex ?? (node.data.title?.match(/_(\d+)$/)?.[1] ? parseInt(node.data.title.match(/_(\d+)$/)![1], 10) : 1);
                  const updatedArtifactTitle = formatHierarchyName(newTitle, "", seq);
                  return {
                    ...node,
                    data: {
                      ...node.data,
                      title: updatedArtifactTitle,
                      seqIndex: seq,
                      artifact: {
                        ...node.data.artifact,
                        sourceNodeName: updatedArtifactTitle,
                        sourceNodeId: node.id
                      }
                    }
                  };
                }
                if (node.type === "batchArtifact") {
                  return {
                    ...node,
                    data: {
                      ...node.data,
                      parentTitle: newTitle
                    }
                  };
                }
              }
              return node;
            });
          });

          // Dynamically update ONLY stash items originating from this generator node or its downstream child nodes
          setActiveWorkspace((workspace) => {
            if (!workspace || workspace.type !== "board") return workspace;
            const currentStash = workspace.stashItems ?? [];
            if (currentStash.length === 0) return workspace;

            const updatedStash = currentStash.map((stashItem) => {
              const isFromThisNode =
                stashItem.sourceNodeId === nodeId ||
                (stashItem.sourceNodeId !== undefined && downstreamChildNodeIds.has(stashItem.sourceNodeId));

              if (isFromThisNode) {
                const childNode = stashItem.sourceNodeId ? childNodesMap.get(stashItem.sourceNodeId) : undefined;
                let updatedName = stashItem.sourceNodeName || "";
                const seqMatch = updatedName.match(/_(\d+)$/);
                const seq = seqMatch ? parseInt(seqMatch[1], 10) : 1;

                if (childNode?.type === "batchArtifact") {
                  const rowTitle = childNode.data.title || "";
                  updatedName = formatHierarchyName(newTitle, rowTitle, seq);
                } else if (childNode?.type === "artifact") {
                  updatedName = formatHierarchyName(newTitle, "", seq);
                } else {
                  if (seqMatch) {
                    updatedName = formatHierarchyName(newTitle, "", seq);
                  } else {
                    updatedName = newTitle;
                  }
                }

                return {
                  ...stashItem,
                  sourceNodeName: updatedName,
                  fileName: `${updatedName}${getAudioFileExtension(stashItem.audioDataUrl, stashItem.fileName)}`
                };
              }
              return stashItem;
            });

            return {
              ...workspace,
              stashItems: updatedStash
            };
          });
        }
      }

      // 2) When row titles inside batchRows change:
      if (newBatchRows && Array.isArray(newBatchRows)) {
        const oldRows = targetNode.data.batchRows || [];
        const rowTitleMap = new Map<string, { oldTitle: string; newTitle: string }>();
        newBatchRows.forEach((r) => {
          const oldR = oldRows.find((o) => o.id === r.id);
          if (oldR && oldR.title !== r.title) {
            rowTitleMap.set(r.id, { oldTitle: oldR.title, newTitle: r.title });
          }
        });

        if (rowTitleMap.size > 0) {
          const parentTitle = targetNode.data.title || "";
          const currentEdges = edgesRef.current;
          const downstreamChildNodeIds = getDownstreamNodeIds(nodeId, currentEdges);

          // Update connected downstream BatchArtifactNodes ONLY (strict topology boundary)
          setNodes((items) => {
            return items.map((node) => {
              if (
                node.type === "batchArtifact" &&
                downstreamChildNodeIds.has(node.id) &&
                node.data.batchRowId &&
                rowTitleMap.has(node.data.batchRowId)
              ) {
                const { newTitle: rNew } = rowTitleMap.get(node.data.batchRowId)!;
                return {
                  ...node,
                  data: {
                    ...node.data,
                    title: rNew
                  }
                };
              }
              return node;
            });
          });

          // Update stashItems matching modified row titles ONLY for this generator node's downstream artifacts
          setActiveWorkspace((workspace) => {
            if (!workspace || workspace.type !== "board") return workspace;
            const currentStash = workspace.stashItems ?? [];
            if (currentStash.length === 0) return workspace;

            const updatedStash = currentStash.map((stashItem) => {
              const isFromThisNode =
                stashItem.sourceNodeId === nodeId ||
                (stashItem.sourceNodeId !== undefined && downstreamChildNodeIds.has(stashItem.sourceNodeId));

              if (isFromThisNode && stashItem.sourceRowId && rowTitleMap.has(stashItem.sourceRowId)) {
                const { newTitle: rNew } = rowTitleMap.get(stashItem.sourceRowId)!;
                const seqMatch = (stashItem.sourceNodeName || "").match(/_(\d+)$/);
                const seq = seqMatch ? parseInt(seqMatch[1], 10) : 1;
                const updatedName = formatHierarchyName(parentTitle, rNew, seq);

                return {
                  ...stashItem,
                  sourceNodeName: updatedName,
                  fileName: `${updatedName}${getAudioFileExtension(stashItem.audioDataUrl, stashItem.fileName)}`
                };
              }
              return stashItem;
            });

            return {
              ...workspace,
              stashItems: updatedStash
            };
          });
        }
      }
    },
    [setNodes, setActiveWorkspace]
  );

  const deleteNode = useCallback((nodeId: string) => {
    const nextNodes = nodesRef.current.filter((node) => node.id !== nodeId);
    const nextEdges = edgesRef.current.filter((edge) => edge.source !== nodeId && edge.target !== nodeId);
    nodesRef.current = nextNodes;
    edgesRef.current = nextEdges;
    setNodes(nextNodes);
    setEdges(nextEdges);
    void saveWorkspace(nextNodes, nextEdges);
  }, [setNodes, setEdges]);

  const deleteEdge = useCallback((edgeId: string) => {
    const nextEdges = edgesRef.current.filter((edge) => edge.id !== edgeId);
    edgesRef.current = nextEdges;
    setEdges(nextEdges);
    void saveWorkspace(undefined, nextEdges);
  }, [setEdges]);

  const isArtifactStashed = useCallback((artifact: ArtifactData) => {
    const ws = activeWorkspaceRef.current;
    if (!ws || ws.type !== "board") return false;
    const items = ws.stashItems ?? [];
    return items.some((item) => item.fileName === artifact.fileName && item.audioDataUrl === artifact.audioDataUrl);
  }, []);

  const createReferenceAudioFromData = useCallback((title: string, audioAsset: AudioAsset) => {
    if (!activeWorkspaceRef.current || activeWorkspaceRef.current.type !== "board") return;
    const newId = createId("referenceAudio");
    const currentNodes = nodesRef.current;
    const newNode: StudioNode = {
      id: newId,
      type: "referenceAudio",
      position: { x: 120, y: 120 + (currentNodes.length % 8) * 50 },
      data: {
        title: `${title}_参考`,
        audio: audioAsset
      }
    };
    const nextNodes = currentNodes.concat(newNode);
    nodesRef.current = nextNodes;
    setNodes(nextNodes);
    void saveWorkspace(nextNodes);
  }, [setNodes]);

  const integratedNameIndex = useRef(new IntegratedNameIndex());
  const integratedArtifactNames = useMemo(() => integratedNameIndex.current.update(nodes), [nodes]);

  // 已暂存的全能产物也按当前节点/行标题刷新，不改变缓存地址和用于暂存识别的原始文件名。
  useEffect(() => {
    if (!activeWorkspace || activeWorkspace.type !== "board" || !activeWorkspace.stashItems?.length) return;
    let changed = false;
    const stashItems = activeWorkspace.stashItems.map(item => {
      const name = integratedArtifactNames.get(JSON.stringify([item.sourceNodeId, item.sourceRowId, item.audioDataUrl]));
      if (!name) return item;
      if (name === item.sourceNodeName) return item;
      changed = true;
      return { ...item, sourceNodeName: name };
    });
    if (!changed) return;
    const workspace = { ...activeWorkspace, stashItems };
    activeWorkspaceRef.current = workspace;
    setActiveWorkspace(workspace);
    void saveWorkspace(undefined, undefined, workspace);
  }, [activeWorkspace, integratedArtifactNames]);

  const stashedArtifactKeys = useMemo(() => new Set(
    (activeWorkspace?.type === "board" ? activeWorkspace.stashItems || [] : [])
      .map(item => JSON.stringify([item.fileName, item.audioDataUrl]))
  ), [activeWorkspace?.type === "board" ? activeWorkspace.stashItems : undefined]);

  const nodeCallbacks = useMemo(
    () => ({
      workspaceName: activeWorkspace?.name,
      singleDownloadSettings,
      stashedArtifactKeys,
      onPatch: patchNode,
      onDelete: deleteNode,
      onRunClone: runVoiceClone,
      onRunBatchVoiceClone: runBatchVoiceClone,
      onRunSingleRowBatchVoiceClone: runSingleRowBatchVoiceClone,
      onRunBatchVoiceDesign: runBatchVoiceDesign,
      onRunSingleRowBatchVoiceDesign: runSingleRowBatchVoiceDesign,
      onRunIntegratedBatch: runIntegratedBatch,
      onRunIntegratedSingleRow: runIntegratedSingleRow,
      onRunGameVocalClone: runGameVocalClone,
      onDeleteIntegratedArtifactItem: deleteIntegratedArtifactItem,
      onDeleteBatchArtifactItem: deleteBatchArtifactItem,
      onRunVoiceDesign: runVoiceDesign,
      onOptimizeStyle: optimizeVoiceStyle,
      onOptimizeVoiceDesign: optimizeVoiceDesign,
      onStashArtifact: stashArtifact,
      onToggleStashArtifact: toggleStashArtifact,
      onRunAudioMerge: runAudioMerge,
      onCreateReferenceFromAudio: createReferenceAudioFromData,
      isArtifactStashed
    }),
    [apiKey, serverApiKeyConfigured, singleDownloadSettings, stashedArtifactKeys, activeWorkspace?.name, patchNode, deleteNode, isArtifactStashed, createReferenceAudioFromData]
  );

  const nodeDataCache = useRef<Map<string, { rawNodeData: unknown; callbacks: unknown; resultNode: StudioNode }>>(new Map());

  const hydratedNodes = useMemo(() => {
    const cache = nodeDataCache.current;
    pruneMap(cache, nodes.map(node => node.id));
    return nodes.map((rawNode) => {
      const cached = cache.get(rawNode.id);
      if (cached && cached.rawNodeData === rawNode.data && cached.callbacks === nodeCallbacks) {
        if (
          cached.resultNode.position.x === rawNode.position.x &&
          cached.resultNode.position.y === rawNode.position.y &&
          cached.resultNode.selected === rawNode.selected &&
          cached.resultNode.dragging === rawNode.dragging &&
          cached.resultNode.measured?.width === rawNode.measured?.width &&
          cached.resultNode.measured?.height === rawNode.measured?.height &&
          cached.resultNode.width === rawNode.width &&
          cached.resultNode.height === rawNode.height
        ) {
          return cached.resultNode;
        }
        cached.resultNode = {
          ...rawNode,
          data: cached.resultNode.data
        };
        return cached.resultNode;
      }
      const newResultData = {
        ...rawNode.data,
        ...(rawNode.type === "artifact" ? { title: rawNode.data.title?.replace(/_产物_(\d+)$/, "_$1") || "产物" } : {}),
        ...nodeCallbacks
      };
      const resultNode: StudioNode = {
        ...rawNode,
        data: newResultData
      };
      cache.set(rawNode.id, { rawNodeData: rawNode.data, callbacks: nodeCallbacks, resultNode });
      return resultNode;
    });
  }, [nodes, nodeCallbacks]);

  const edgeDataCache = useRef<Map<string, { rawEdge: StudioEdge; onDelete: unknown; palette: Record<string, string>; resultEdge: StudioEdge }>>(new Map());

  const hydratedEdges = useMemo(() => {
    const cache = edgeDataCache.current;
    pruneMap(cache, edges.map(edge => edge.id));
    const currentNodes = nodesRef.current;
    const nodeMap = new Map<string, StudioNode>();
    for (let i = 0; i < currentNodes.length; i++) {
      nodeMap.set(currentNodes[i].id, currentNodes[i]);
    }
    const colorMap = nodeColors;
    return edges.map((edge) => {
      const cached = cache.get(edge.id);
      if (cached && cached.rawEdge === edge && cached.onDelete === deleteEdge && cached.palette === nodeColors) {
        return cached.resultEdge;
      }
      const sourceNode = nodeMap.get(edge.source);
      const strokeColor = (sourceNode?.type && colorMap[sourceNode.type]) || nodeColors.referenceAudio;
      const newResultData = {
        ...edge.data,
        onDeleteEdge: deleteEdge
      };
      const resultEdge: StudioEdge = {
        ...edge,
        type: "deletable",
        style: { strokeWidth: isLight ? 2.4 : 2, ...edge.style, stroke: strokeColor },
        data: newResultData
      };
      cache.set(edge.id, { rawEdge: edge, onDelete: deleteEdge, palette: nodeColors, resultEdge });
      return resultEdge;
    });
  }, [edges, deleteEdge, isLight, nodeColors]);

  const nodeTypes = STUDIO_NODE_TYPES;
  const edgeTypes = STUDIO_EDGE_TYPES;

  async function loadBootstrap() {
    try {
      const response = await fetch("/api/bootstrap");
      if (!response.ok) {
        throw new Error(`Bootstrap failed: HTTP ${response.status}`);
      }
      const data = await response.json();

      if (data.status) {
        setStatus(data.status);
      }

      if (data.settings) {
        const isServerConfigured = Boolean(data.settings.hasApiKey || data.settings.configured);
        setServerApiKeyConfigured(isServerConfigured);
        localStorage.setItem("mimo_cached_server_configured", isServerConfigured ? "true" : "false");

        const localKey = localStorage.getItem(API_KEY_STORAGE_KEY) || "";
        const nextKey = localKey;
        setProviderOptions(normalizeProviderOptions(data.settings));
        setApiKey(nextKey);
        setApiKeyInput(nextKey);
        if (data.settings.apiEndpoint) setApiEndpoint(data.settings.apiEndpoint);
        if (data.settings.apiProvider) setApiProvider(data.settings.apiProvider);
      }

      if (Array.isArray(data.workspaces)) {
        setWorkspaces(data.workspaces);
        try {
          localStorage.setItem("mimo_cached_workspaces", JSON.stringify(data.workspaces));
        } catch { }
      }

      if (data.activeWorkspace) {
        // 防乱序检查：如果用户在 bootstrap 请求完成前已经手动点击或切换了画板，绝对不覆盖用户意图
        if (!switchingTargetIdRef.current || switchingTargetIdRef.current === data.activeWorkspace.id) {
          const ws = data.activeWorkspace as WorkspacePayload;
          switchingTargetIdRef.current = ws.id;
          setActiveWorkspace(ws);
          if (ws.type === "board") {
            const boardNodes = ws.nodes ?? [];
            const boardEdges = ws.edges ?? [];
            const normalizedNodes = boardNodes.map((n) => ensureArtifactSeqIndexes(n, boardNodes, boardEdges));
            setNodes(normalizedNodes);
            setEdges(boardEdges);
            lastSavedOrLoadedKeyRef.current = computeWorkspaceKey(ws, normalizedNodes, boardEdges);
          } else {
            setNodes([]);
            setEdges([]);
            lastSavedOrLoadedKeyRef.current = computeWorkspaceKey(ws, [], []);
          }
          const strippedActive = stripHeavyDataForCache(ws);
          try {
            localStorage.setItem("mimo_cached_active_workspace", JSON.stringify(strippedActive || ws));
            localStorage.setItem("mimo_last_active_id", ws.id);
          } catch { }
        }
      }
      setIsSettingsLoaded(true);
    } catch (err) {
      console.warn("[bootstrap] falling back to individual loaders", err);
      void Promise.allSettled([
        loadStatus(),
        loadApiSettings(),
        loadWorkspaceList(),
        loadStoragePathInfo()
      ]);
    }
  }

  async function loadStatus() {
    try {
      setStatusError(null);
      const response = await fetch("/api/status");
      if (!response.ok) {
        throw new Error(`状态检查失败：HTTP ${response.status}`);
      }
      setStatus((await response.json()) as StatusResponse);
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : "状态检查失败");
    }
  }

  async function loadApiSettings() {
    try {
      const response = await fetch("/api/settings");
      if (!response.ok) {
        throw new Error(`API 配置加载失败：HTTP ${response.status}`);
      }

      const settings = (await response.json()) as ApiSettingsResponse;
      const isServerConfigured = Boolean(settings.hasApiKey || settings.configured);
      setServerApiKeyConfigured(isServerConfigured);

      const localKey = localStorage.getItem(API_KEY_STORAGE_KEY) || "";
      const localEndpoint = localStorage.getItem(API_ENDPOINT_STORAGE_KEY) || "";
      const localProvider = localStorage.getItem(API_PROVIDER_STORAGE_KEY) || "";
      const nextKey = localKey || (isServerConfigured ? "" : DEFAULT_API_KEY);
      const nextEndpoint = localEndpoint || settings.apiEndpoint || DEFAULT_API_ENDPOINT;
      const nextProvider = localProvider || settings.apiProvider || "mimo";

      setApiKey(nextKey);
      setApiEndpoint(nextEndpoint);
      setApiProvider(nextProvider);
      setApiKeyInput(nextKey);
      setProviderOptions(normalizeProviderOptions(settings));
      setApiEndpointInput(nextEndpoint);
      setApiProviderInput(nextProvider);

      if (isServerConfigured || localKey || nextKey) {
        setNodes((items) =>
          items.map((node) => {
            if (node.data.error && node.data.error.includes("API Key 未配置")) {
              return { ...node, data: { ...node.data, error: undefined } };
            }
            return node;
          })
        );
        setShowApiKeyModal(false);
      } else {
        setShowApiKeyModal(true);
      }
    } catch (error) {
      console.warn("[settings] failed to load API settings", error);
      setShowApiKeyModal(false);
    } finally {
      setIsSettingsLoaded(true);
    }
  }

  async function saveApiKey() {
    const provider = apiProviderInput.trim() || "mimo";
    const endpoint = apiEndpointInput.trim() || API_PROVIDERS.find(p => p.id === provider)?.endpoint || "";
    try {
      const response = await fetch("/api/settings", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKeyInput.trim(), apiEndpoint: endpoint, apiProvider: provider, ...providerOptionsInput })
      });
      const result = await response.json() as ApiSettingsResponse & { error?: string };
      if (!response.ok) throw new Error(result.error || "配置保存失败");
      setApiKey(""); apiKeyRef.current = "";
      localStorage.removeItem(API_KEY_STORAGE_KEY);
      setServerApiKeyConfigured(Boolean(result.hasApiKey));
      serverApiKeyConfiguredRef.current = Boolean(result.hasApiKey);
      localStorage.setItem("mimo_cached_server_configured", result.hasApiKey ? "true" : "false");
      setApiProvider(provider); apiProviderRef.current = provider;
      setApiEndpoint(result.apiEndpoint); apiEndpointRef.current = result.apiEndpoint;
      localStorage.setItem(API_PROVIDER_STORAGE_KEY, provider);
      localStorage.setItem(API_ENDPOINT_STORAGE_KEY, result.apiEndpoint);
      const safeOptions = normalizeProviderOptions(providerOptionsInput);
      setProviderOptions(safeOptions); providerOptionsRef.current = safeOptions;
      setProviderOptionsInput(safeOptions); setApiKeyInput(""); setSettingsError("");
      closeApiKeyModal(); void loadStatus();
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : "配置保存失败");
    }
  }

  function getApiHeaders(isJson = false, extraHeaders?: Record<string, string>): Record<string, string> {
    return buildApiHeaders({
      apiKey: apiKeyRef.current || localStorage.getItem(API_KEY_STORAGE_KEY) || "",
      apiEndpoint: apiEndpointRef.current || localStorage.getItem(API_ENDPOINT_STORAGE_KEY) || DEFAULT_API_ENDPOINT,
      apiProvider: apiProviderRef.current || localStorage.getItem(API_PROVIDER_STORAGE_KEY) || "mimo",
      appId: providerOptionsRef.current.appId,
      accessToken: providerOptionsRef.current.accessToken,
      customProtocol: providerOptionsRef.current.customProtocol,
      isJson,
      extraHeaders
    });
  }

  function openApiKeyModal() {
    setApiKeyInput(apiKey);
    setApiEndpointInput(apiEndpoint);
    setApiProviderInput(apiProvider);
    setProviderOptionsInput(normalizeProviderOptions(providerOptions));
    setSettingsError("");
    setShowApiKeyModal(true);
  }

  function closeApiKeyModal() {
    setShowApiKeyModal(false);
    if (themeConfig.autoHideTopbar ?? true) {
      topbarHoverTimerRef.current = window.setTimeout(() => setTopbarCollapsed(true), 1500);
    }
  }

  async function loadWorkspaceList(preferredId?: string) {
    try {
      const response = await fetch("/api/workspaces");
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as WorkspacesResponse;
      const workspaceItems = Array.isArray(payload.workspaces) ? payload.workspaces : [];
      setWorkspaces(workspaceItems);

      // 当画板库没有任何画板时，清空画布状态与节点，静默不报错
      if (workspaceItems.length === 0) {
        setActiveWorkspace(null);
        setNodes([]);
        setEdges([]);
        return;
      }

      const currentActiveId = activeWorkspaceRef.current?.id;
      // 关键防混淆：如果明确指定了 preferredId，或者当前正在查看的画板依然有效存在，坚决保持当前画板，绝不乱切！
      if (preferredId && workspaceItems.some((w) => w.id === preferredId)) {
        if (preferredId !== currentActiveId) {
          await loadWorkspace(preferredId);
        }
        return;
      }
      if (currentActiveId && workspaceItems.some((w) => w.id === currentActiveId)) {
        // 当前画板依然存在且有效，维持当前画板展示，绝对不重载
        return;
      }

      const cachedLastId = localStorage.getItem("mimo_last_active_id");
      if (cachedLastId && workspaceItems.some((w) => w.id === cachedLastId)) {
        await loadWorkspace(cachedLastId);
      } else {
        const targetId = (payload.activeWorkspaceId && workspaceItems.some((w) => w.id === payload.activeWorkspaceId))
          ? payload.activeWorkspaceId
          : workspaceItems[0]?.id;
        if (targetId) {
          await loadWorkspace(targetId);
        } else {
          setActiveWorkspace(null);
          setNodes([]);
          setEdges([]);
        }
      }
    } catch (err) {
      console.warn("加载画板列表失败:", err);
    }
  }

  async function loadWorkspace(id: string) {
    if (!id) {
      switchingTargetIdRef.current = null;
      setActiveWorkspace(null);
      setNodes([]);
      setEdges([]);
      return;
    }

    // 0. 如果点击的是当前已激活且正在展示的画板，直接保持不变，避免重复重载与闪烁
    if (activeWorkspaceRef.current?.id === id && switchingTargetIdRef.current === id) {
      return;
    }

    localStorage.setItem("mimo_last_active_id", id);
    switchingTargetIdRef.current = id;

    // 1. 如果有未完成的保存定时器，清除定时器，避免切换画板后异步串台保存
    const hadPendingSave = saveTimerRef.current !== null || maxSaveTimerRef.current !== null;
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (maxSaveTimerRef.current) {
      window.clearTimeout(maxSaveTimerRef.current);
      maxSaveTimerRef.current = null;
    }

    // 2. 如果前一个画板确实有尚未持久化的修改，利用当前闭包快照隔离保存前一个画板，绝对不读取全局 mutable ref 造成数据混淆
    if (hadPendingSave && activeWorkspaceRef.current && activeWorkspaceRef.current.id !== id) {
      const prevWs = activeWorkspaceRef.current;
      let body: Record<string, unknown>;
      if (prevWs.type === "audiobook") {
        body = {
          name: prevWs.name,
          activeChapterId: prevWs.activeChapterId,
          novelText: prevWs.novelText,
          characterHints: prevWs.characterHints,
          characters: prevWs.characters,
          segments: prevWs.segments,
          products: prevWs.products,
          chapters: prevWs.chapters,
          phase: prevWs.phase,
          baseUpdatedAt: prevWs.updatedAt
        };
      } else {
        const prevNodes = nodesRef.current.map(stripNodeCallbacks);
        const prevEdges = edgesRef.current;
        body = {
          name: prevWs.name,
          nodes: prevNodes,
          edges: prevEdges,
          stashItems: prevWs.stashItems ?? []
          , baseUpdatedAt: prevWs.updatedAt
        };
      }
      void sendWorkspaceSnapshot(prevWs.id, body).catch((err) => {
        setSaveError(err instanceof Error ? err.message : "切换画板前保存失败，请勿关闭程序。");
        console.warn("切换画板前保存失败:", err);
      });
    }

    // 3. 清理撤销/重做栈与中间缓存，彻底阻断不同画板的历史栈污染
    nodeDataCache.current.clear();
    edgeDataCache.current.clear();
    undoStackRef.current = [];
    redoStackRef.current = [];
    lastRecordedRef.current = "";

    try {
      const response = await fetch(`/api/workspaces/${id}`);
      if (!response.ok) {
        if (response.status === 404) {
          if (switchingTargetIdRef.current === id) {
            setActiveWorkspace(null);
            setNodes([]);
            setEdges([]);
          }
          return;
        }
        console.warn(`加载画板失败：HTTP ${response.status}`);
        return;
      }
      const workspace = (await response.json()) as WorkspacePayload;

      // 4. 严格校验：确保当前用户最终想要的画板 ID 依然是本画板（防网络并发乱序）
      if (switchingTargetIdRef.current !== id) {
        return;
      }
      workspaceSaveQueue.current.seed(id, workspace.updatedAt);

      if (workspace.type === "board") {
        const boardNodes = workspace.nodes ?? [];
        const boardEdges = workspace.edges ?? [];
        const normalizedNodes = boardNodes.map((n) => ensureArtifactSeqIndexes(n, boardNodes, boardEdges));
        startTransition(() => {
          setActiveWorkspace(workspace);
          setNodes(normalizedNodes);
          setEdges(boardEdges);
        });
        lastSavedOrLoadedKeyRef.current = computeWorkspaceKey(workspace, normalizedNodes, boardEdges);
        window.setTimeout(() => {
          if (switchingTargetIdRef.current === id) {
            flowRef.current?.fitView({ padding: 0.25, duration: 0, minZoom: 0.005 });
          }
        }, 16);
      } else {
        startTransition(() => {
          setActiveWorkspace(workspace);
          setNodes([]);
          setEdges([]);
        });
        lastSavedOrLoadedKeyRef.current = computeWorkspaceKey(workspace, [], []);
      }
    } catch (err) {
      console.warn("加载画板异常:", err);
      if (switchingTargetIdRef.current === id) {
        setActiveWorkspace(null);
        setNodes([]);
        setEdges([]);
      }
    }
  }

  async function createWorkspace() {
    const initialNodes = !activeWorkspaceRef.current && nodesRef.current.length > 0 ? nodesRef.current : [];
    const initialEdges = !activeWorkspaceRef.current && edgesRef.current.length > 0 ? edgesRef.current : [];

    if (activeWorkspaceRef.current) {
      void saveWorkspace().catch(() => { });
      nodeDataCache.current.clear();
      edgeDataCache.current.clear();
      undoStackRef.current = [];
      redoStackRef.current = [];
      lastRecordedRef.current = "";
    }

    const name = `新画板 ${new Date().toLocaleString("zh-CN", { hour12: false })}`;
    const response = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, nodes: initialNodes, edges: initialEdges, stashItems: [] })
    });
    if (!response.ok) {
      throw new Error(`创建画板失败：HTTP ${response.status}`);
    }
    const workspace = (await response.json()) as WorkspacePayload;
    switchingTargetIdRef.current = workspace.id;
    try {
      const strippedNew = stripHeavyDataForCache(workspace);
      localStorage.setItem("mimo_cached_active_workspace", JSON.stringify(strippedNew || workspace));
      localStorage.setItem("mimo_last_active_id", workspace.id);
    } catch { }
    setActiveWorkspace(workspace);
    setNodes(initialNodes);
    setEdges(initialEdges);
    lastSavedOrLoadedKeyRef.current = computeWorkspaceKey(workspace, initialNodes, initialEdges);
    setWorkspaces((items) => [
      {
        id: workspace.id,
        type: "board",
        name: workspace.name,
        nodeCount: initialNodes.length,
        edgeCount: initialEdges.length,
        stashCount: 0,
        updatedAt: workspace.updatedAt,
        createdAt: workspace.createdAt
      },
      ...items.filter((w) => w.id !== workspace.id)
    ]);
    if (initialNodes.length > 0) {
      window.setTimeout(() => {
        flowRef.current?.fitView({ padding: 0.25, duration: 400 });
      }, 60);
    }
  }

  async function createSmartWorkspace(formData: FormData) {
    if (!supportsMimoWorkflow(apiProviderRef.current, providerOptionsRef.current.customProtocol)) throw new Error(MIMO_WORKFLOW_NOTICE);
    const response = await fetch("/api/workspaces/smart", {
      method: "POST",
      headers: getApiHeaders(false),
      body: formData
    });
    const workspace = (await response.json()) as WorkspacePayload & { error?: string };
    if (!response.ok) {
      throw new Error(workspace.error || `智能画板生成失败：HTTP ${response.status}`);
    }
    await loadWorkspaceList(workspace.id);
  }

  async function saveWorkspace(
    overrideNodes?: StudioNode[],
    overrideEdges?: StudioEdge[],
    overrideWorkspace?: WorkspacePayload
  ) {
    if (overrideNodes) nodesRef.current = overrideNodes;
    if (overrideEdges) edgesRef.current = overrideEdges;
    if (overrideWorkspace) activeWorkspaceRef.current = overrideWorkspace;

    const currentWorkspace = overrideWorkspace || activeWorkspaceRef.current;
    if (!currentWorkspace) {
      return;
    }

    // 关键安全防线：若当前正在切换画板（目标画板 ID 与当前画板不一致），绝对禁止执行旧画板的延迟保存
    if (switchingTargetIdRef.current && switchingTargetIdRef.current !== currentWorkspace.id) {
      return;
    }

    setIsSaving(true);
    try {
      let body: Record<string, unknown>;
      let cleanNodes: StudioNode[] = [];
      let cleanEdges: StudioEdge[] = [];
      if (currentWorkspace.type === "audiobook") {
        body = {
          name: currentWorkspace.name,
          activeChapterId: currentWorkspace.activeChapterId,
          novelText: currentWorkspace.novelText,
          characterHints: currentWorkspace.characterHints,
          characters: currentWorkspace.characters,
          segments: currentWorkspace.segments,
          products: currentWorkspace.products,
          chapters: currentWorkspace.chapters,
          phase: currentWorkspace.phase,
          baseUpdatedAt: currentWorkspace.updatedAt
        };
      } else {
        cleanNodes = (overrideNodes || nodesRef.current).map(stripNodeCallbacks);
        cleanEdges = overrideEdges || edgesRef.current;
        body = {
          name: currentWorkspace.name,
          nodes: cleanNodes,
          edges: cleanEdges,
          stashItems: currentWorkspace.stashItems ?? []
          , baseUpdatedAt: currentWorkspace.updatedAt
        };
      }

      const saved = await sendWorkspaceSnapshot(currentWorkspace.id, body);
      setSaveError("");
      if (activeWorkspaceRef.current?.id === saved.id) activeWorkspaceRef.current = { ...activeWorkspaceRef.current, updatedAt: saved.updatedAt };

      // 再次校验并发锁：若在保存网络请求期间，用户已切换到了其他画板，绝不污染全局活动画板与本地缓存
      if (switchingTargetIdRef.current && switchingTargetIdRef.current !== currentWorkspace.id) {
        return;
      }

      setActiveWorkspace((current) => {
        if (!current || current.id !== saved.id) return current;
        return {
          ...current,
          updatedAt: saved.updatedAt
        };
      });

      lastSavedOrLoadedKeyRef.current = computeWorkspaceKey(
        currentWorkspace,
        cleanNodes,
        cleanEdges
      );

      setWorkspaces((items) =>
        items.map((item) =>
          item.id === saved.id
            ? {
              ...item,
              name: currentWorkspace.name,
              nodeCount: currentWorkspace.type === "board" ? cleanNodes.length : 0,
              edgeCount: currentWorkspace.type === "board" ? cleanEdges.length : 0,
              stashCount: currentWorkspace.type === "board" ? currentWorkspace.stashItems?.length ?? 0 : 0,
              updatedAt: saved.updatedAt
            }
            : item
        )
      );
      try {
        if (currentWorkspace.type === "board") {
          const cachedWs: WorkspacePayload = {
            ...currentWorkspace,
            nodes: cleanNodes,
            edges: cleanEdges,
            updatedAt: saved.updatedAt
          };
          const stripped = stripHeavyDataForCache(cachedWs);
          localStorage.setItem("mimo_cached_active_workspace", JSON.stringify(stripped || cachedWs));
        } else {
          localStorage.setItem("mimo_cached_active_workspace", JSON.stringify(currentWorkspace));
        }
        localStorage.setItem("mimo_last_active_id", currentWorkspace.id);
      } catch { }
    } catch (saveError) {
      console.error("[saveWorkspace] 保存失败:", saveError);
      setSaveError(saveError instanceof Error ? saveError.message : "保存失败，请勿关闭程序。");
    } finally {
      setIsSaving(workspaceSaveQueue.current.hasPending(currentWorkspace.id));
    }
  }

  async function handleWindowDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingJson(false);

    const files = Array.from(e.dataTransfer.files).filter((f) => f.name.toLowerCase().endsWith(".json"));
    if (files.length === 0) return;

    for (const file of files) {
      try {
        const text = await file.text();
        const rawData = JSON.parse(text);
        const res = await fetch("/api/workspaces/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(rawData)
        });
        if (res.ok) {
          const imported = await res.json();
          await loadWorkspaceList();
          if (imported.id) {
            await loadWorkspace(imported.id);
          }
        } else {
          alert(`导入 ${file.name} 失败：格式不正确。`);
        }
      } catch (err) {
        alert(`打开/导入 ${file.name} 失败：` + (err instanceof Error ? err.message : String(err)));
      }
    }
  }


  const handleCustomNodesChange = useCallback(
    (changes: NodeChange<StudioNode>[]) => {
      const isPositionChange = changes.some((c) => c.type === "position" && c.position);
      if (!isPositionChange) {
        onNodesChange(changes);
        return;
      }

      const currentNodes = nodesRef.current;
      const snapThreshold = 8;

      const updatedChanges = changes.map((change) => {
        if (change.type === "position" && change.position) {
          const draggingNode = currentNodes.find((n) => n.id === change.id);
          if (!draggingNode) return change;

          const getNodeWidth = (n: StudioNode) =>
            n.measured?.width ?? (n.type === "batchVoiceClone" || n.type === "integratedStudio" || n.type === "gameVocal" ? 660 : n.type === "batchArtifact" ? 440 : n.type === "voiceDesign" ? 420 : n.type === "voiceClone" ? 370 : 330);
          const getNodeHeight = (n: StudioNode) => n.measured?.height ?? 220;

          const nodeWidth = getNodeWidth(draggingNode);
          const nodeHeight = getNodeHeight(draggingNode);

          let posX = change.position.x;
          let posY = change.position.y;

          const dragLeft = posX;
          const dragCenter = posX + nodeWidth / 2;
          const dragRight = posX + nodeWidth;

          const dragTop = posY;
          const dragMiddle = posY + nodeHeight / 2;
          const dragBottom = posY + nodeHeight;

          const otherNodes = currentNodes.filter(
            (n) => n.id !== change.id && !n.selected && Math.abs(n.position.x - posX) < 800 && Math.abs(n.position.y - posY) < 600
          );

          let snappedX = false;
          let snappedY = false;

          for (const other of otherNodes) {
            const oWidth = getNodeWidth(other);
            const oHeight = getNodeHeight(other);

            const oLeft = other.position.x;
            const oCenter = other.position.x + oWidth / 2;
            const oRight = other.position.x + oWidth;

            const oTop = other.position.y;
            const oMiddle = other.position.y + oHeight / 2;
            const oBottom = other.position.y + oHeight;

            if (!snappedX) {
              if (Math.abs(dragLeft - oLeft) < snapThreshold) {
                posX = oLeft;
                snappedX = true;
              } else if (Math.abs(dragCenter - oCenter) < snapThreshold) {
                posX = oCenter - nodeWidth / 2;
                snappedX = true;
              } else if (Math.abs(dragRight - oRight) < snapThreshold) {
                posX = oRight - nodeWidth;
                snappedX = true;
              }
            }

            if (!snappedY) {
              if (Math.abs(dragTop - oTop) < snapThreshold) {
                posY = oTop;
                snappedY = true;
              } else if (Math.abs(dragMiddle - oMiddle) < snapThreshold) {
                posY = oMiddle - nodeHeight / 2;
                snappedY = true;
              } else if (Math.abs(dragBottom - oBottom) < snapThreshold) {
                posY = oBottom - nodeHeight;
                snappedY = true;
              }
            }
          }

          return {
            ...change,
            position: { x: posX, y: posY }
          };
        }
        return change;
      });

      onNodesChange(updatedChanges);
    },
    [onNodesChange]
  );

  const onNodeDragStop = useCallback(() => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      void saveWorkspace();
    }, 200);
  }, []);

  const onConnect = useCallback(
    (connection: Connection) => {
      const currentNodes = nodesRef.current;
      const sourceNode = currentNodes.find((n) => n.id === connection.source);
      const targetNode = currentNodes.find((n) => n.id === connection.target);
      const strokeColor = (sourceNode?.type && NODE_COLOR_MAP[sourceNode.type]) || "#0a84ff";

      setEdges((items) =>
        addEdge(
          {
            ...connection,
            type: "deletable",
            animated: true,
            style: { stroke: strokeColor, strokeWidth: 2 }
          },
          items
        )
      );

      if (sourceNode && targetNode && sourceNode.type === "referenceAudio") {
        const sourceTitle = sourceNode.data.title;
        if (
          sourceTitle &&
          (targetNode.type === "voiceClone" || targetNode.type === "voiceDesign" || targetNode.type === "batchVoiceClone" || targetNode.type === "gameVocal") &&
          (targetNode.data.title === "音频克隆" || targetNode.data.title === "音色创造" || targetNode.data.title === "批量音频克隆" || targetNode.data.title === "游戏语气词生成")
        ) {
          patchNode(targetNode.id, { title: `${sourceTitle}_语气词` });
        }
      }
    },
    [setEdges, patchNode]
  );

  const onConnectEnd = useCallback(
    (event: unknown, connectionState: FinalConnectionState) => {
      if (!connectionState.isValid && connectionState.fromNode) {
        const e = event as MouseEvent | TouchEvent;
        const clientX = "clientX" in e ? e.clientX : (e as TouchEvent).touches?.[0]?.clientX ?? 0;
        const clientY = "clientY" in e ? e.clientY : (e as TouchEvent).touches?.[0]?.clientY ?? 0;
        const point = flowRef.current?.screenToFlowPosition({ x: clientX, y: clientY }) ?? { x: clientX, y: clientY };

        window.setTimeout(() => {
          setMenu({
            x: clientX,
            y: clientY,
            flowX: point.x,
            flowY: point.y,
            sourceNodeId: connectionState.fromNode.id,
            sourceHandleId: connectionState.fromHandle?.id ?? null,
            sourceHandleType: (connectionState.fromHandle?.type as "source" | "target" | undefined) ?? "source"
          });
        }, 30);
      }
    },
    [flowRef]
  );

  // 全局捕获阶段监听右键拖动与长按：由于 ReactFlow 的 panOnDrag 会在底层阻止事件冒泡，
  // 必须在 window 的 capture 阶段捕获鼠标位移与按住时长，确保拖动画板时绝不误弹出右键菜单
  useEffect(() => {
    const handlePointerDownCapture = (event: globalThis.MouseEvent) => {
      if (event.button === 2) {
        if (flowWrapRef.current && event.target && !flowWrapRef.current.contains(event.target as unknown as globalThis.Node)) {
          return;
        }
        const viewport = flowRef.current?.getViewport();
        rightDragRef.current = {
          startX: event.clientX,
          startY: event.clientY,
          startTime: Date.now(),
          startViewportX: viewport?.x ?? 0,
          startViewportY: viewport?.y ?? 0,
          moved: false
        };
      }
    };

    const handlePointerMoveCapture = (event: globalThis.MouseEvent) => {
      if (!rightDragRef.current) return;
      const dx = Math.abs(event.clientX - rightDragRef.current.startX);
      const dy = Math.abs(event.clientY - rightDragRef.current.startY);
      if (dx > 4 || dy > 4) {
        rightDragRef.current.moved = true;
      }
    };

    const handlePointerUpCapture = (event: globalThis.MouseEvent) => {
      if (event.button === 2 && rightDragRef.current) {
        const dx = Math.abs(event.clientX - rightDragRef.current.startX);
        const dy = Math.abs(event.clientY - rightDragRef.current.startY);
        const elapsed = Date.now() - rightDragRef.current.startTime;
        if (dx > 4 || dy > 4 || elapsed > 350) {
          rightDragRef.current.moved = true;
        }
      }
    };

    window.addEventListener("pointerdown", handlePointerDownCapture as (e: globalThis.PointerEvent) => void, true);
    window.addEventListener("pointermove", handlePointerMoveCapture as (e: globalThis.PointerEvent) => void, true);
    window.addEventListener("pointerup", handlePointerUpCapture as (e: globalThis.PointerEvent) => void, true);
    window.addEventListener("mousedown", handlePointerDownCapture, true);
    window.addEventListener("mousemove", handlePointerMoveCapture, true);
    window.addEventListener("mouseup", handlePointerUpCapture, true);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDownCapture as (e: globalThis.PointerEvent) => void, true);
      window.removeEventListener("pointermove", handlePointerMoveCapture as (e: globalThis.PointerEvent) => void, true);
      window.removeEventListener("pointerup", handlePointerUpCapture as (e: globalThis.PointerEvent) => void, true);
      window.removeEventListener("mousedown", handlePointerDownCapture, true);
      window.removeEventListener("mousemove", handlePointerMoveCapture, true);
      window.removeEventListener("mouseup", handlePointerUpCapture, true);
    };
  }, []);

  function handleFlowMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (event.button === 2) {
      const viewport = flowRef.current?.getViewport();
      rightDragRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        startTime: Date.now(),
        startViewportX: viewport?.x ?? 0,
        startViewportY: viewport?.y ?? 0,
        moved: false
      };
    }
  }

  function handleFlowMouseMove(event: MouseEvent<HTMLDivElement>) {
    if (!rightDragRef.current) return;
    const dx = Math.abs(event.clientX - rightDragRef.current.startX);
    const dy = Math.abs(event.clientY - rightDragRef.current.startY);
    if (dx > 4 || dy > 4) {
      rightDragRef.current.moved = true;
    }
  }

  function openContextMenu(event: MouseEvent) {
    event.preventDefault();

    const drag = rightDragRef.current;
    rightDragRef.current = null;

    if (drag) {
      const elapsed = Date.now() - drag.startTime;
      const dist = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
      const currentViewport = flowRef.current?.getViewport();
      const viewportMoved = Boolean(
        currentViewport &&
        (Math.abs(currentViewport.x - drag.startViewportX) > 2 ||
          Math.abs(currentViewport.y - drag.startViewportY) > 2)
      );

      // 只要满足以下任一条件，即判定为拖动平移或长按，坚决不弹出右键菜单：
      // 1. 鼠标位移距离超过 4px
      // 2. 画板 Viewport 实际发生了位移 (ReactFlow panOnDrag)
      // 3. 标记为已移动 (moved)
      // 4. 按住时间超过 350ms (长按，非快速单击)
      if (drag.moved || dist > 4 || viewportMoved || elapsed > 350) {
        return;
      }
    }

    // 若在输入框、文本框等控件上右键，不弹出新建节点菜单
    const target = event.target as HTMLElement | null;
    if (target && (target.closest("input, textarea, select, button, a") || target.closest(".nodrag"))) {
      return;
    }

    const point = flowRef.current?.screenToFlowPosition({ x: event.clientX, y: event.clientY }) ?? { x: 80, y: 80 };
    setMenu({ x: event.clientX, y: event.clientY, flowX: point.x, flowY: point.y });
  }

  function addNode(type: StudioNodeType) {
    if (!menu) {
      return;
    }

    const newNodeId = createId(type);
    const node: StudioNode = {
      id: newNodeId,
      type,
      position: { x: menu.flowX, y: menu.flowY },
      data: getNodeDefaultData(type)
    };

    let newEdge: StudioEdge | null = null;
    if (menu.sourceNodeId) {
      const sourceId = menu.sourceNodeId;
      const handleId = menu.sourceHandleId || undefined;
      const handleType = menu.sourceHandleType || "source";

      let targetHandleId: string | undefined;
      if (type === "voiceClone" || type === "batchVoiceClone" || type === "gameVocal") {
        if (handleId === "instruction" || handleId === "style") {
          targetHandleId = "instruction";
        } else if (handleId === "text") {
          targetHandleId = "text";
        } else {
          targetHandleId = "voice";
        }
      } else if (type === "voiceDesign") {
        if (handleId === "instruction" || handleId === "style") {
          targetHandleId = "instruction";
        } else {
          targetHandleId = "text";
        }
      } else if (type === "audioMerge") {
        targetHandleId = "audio";
      } else if (type === "artifact") {
        targetHandleId = "artifact";
      }

      if (handleType === "source") {
        const sourceNode = nodesRef.current.find((n) => n.id === sourceId);
        const strokeColor = (sourceNode?.type && NODE_COLOR_MAP[sourceNode.type]) || "#0a84ff";
        newEdge = {
          id: createId("edge"),
          source: sourceId,
          sourceHandle: handleId,
          target: newNodeId,
          targetHandle: targetHandleId,
          type: "deletable",
          animated: true,
          style: { stroke: strokeColor, strokeWidth: 2 }
        };
      } else {
        const strokeColor = NODE_COLOR_MAP[type] || "#0a84ff";
        newEdge = {
          id: createId("edge"),
          source: newNodeId,
          sourceHandle: "audio",
          target: sourceId,
          targetHandle: handleId,
          type: "deletable",
          animated: true,
          style: { stroke: strokeColor, strokeWidth: 2 }
        };
      }
    }

    setNodes((items) => [...items, node]);
    if (newEdge) {
      setEdges((items) => [...items, newEdge!]);
    }
    setMenu(null);
  }

  function copySelection() {
    const selectedNodes = nodes.filter((node) => node.selected);
    if (selectedNodes.length === 0) return;
    const selectedIds = new Set(selectedNodes.map((node) => node.id));
    clipboardRef.current = {
      nodes: selectedNodes.map(stripNodeCallbacks),
      edges: edges.filter((edge) => selectedIds.has(edge.source) && selectedIds.has(edge.target))
    };
  }

  function cutSelection() {
    copySelection();
    const selectedIds = new Set(nodes.filter((node) => node.selected).map((node) => node.id));
    if (selectedIds.size === 0) return;
    setNodes((items) => items.filter((node) => !selectedIds.has(node.id)));
    setEdges((items) => items.filter((edge) => !selectedIds.has(edge.source) && !selectedIds.has(edge.target)));
  }

  function pasteSelection() {
    const clipboard = clipboardRef.current;
    if (!clipboard?.nodes.length) return;
    const idMap = new Map(clipboard.nodes.map((node) => [node.id, createId(node.type)]));
    const pastedNodes = clipboard.nodes.map((node) => ({
      ...stripNodeCallbacks(node),
      id: idMap.get(node.id)!,
      position: { x: node.position.x + 40, y: node.position.y + 40 },
      selected: true
    }));
    const pastedEdges = clipboard.edges.map((edge) => ({
      ...edge,
      id: createId("edge"),
      source: idMap.get(edge.source)!,
      target: idMap.get(edge.target)!,
      selected: false
    }));
    setNodes((items) => [...items.map((node) => ({ ...node, selected: false })), ...pastedNodes]);
    setEdges((items) => [...items, ...pastedEdges]);
    clipboardRef.current = { ...clipboard, nodes: pastedNodes.map(stripNodeCallbacks), edges: pastedEdges };
  }

  const handleUndo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    isUndoingRef.current = true;

    const currentSnapshot = {
      nodes: nodesRef.current.map(stripNodeCallbacks),
      edges: edgesRef.current
    };
    redoStackRef.current.push(currentSnapshot);

    const previousSnapshot = undoStackRef.current.pop()!;
    lastRecordedRef.current = JSON.stringify(previousSnapshot);

    setNodes(previousSnapshot.nodes);
    setEdges(previousSnapshot.edges);

    setTimeout(() => {
      isUndoingRef.current = false;
    }, 100);
  }, [setNodes, setEdges]);

  const handleRedo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    isUndoingRef.current = true;

    const currentSnapshot = {
      nodes: nodesRef.current.map(stripNodeCallbacks),
      edges: edgesRef.current
    };
    undoStackRef.current.push(currentSnapshot);

    const nextSnapshot = redoStackRef.current.pop()!;
    lastRecordedRef.current = JSON.stringify(nextSnapshot);

    setNodes(nextSnapshot.nodes);
    setEdges(nextSnapshot.edges);

    setTimeout(() => {
      isUndoingRef.current = false;
    }, 100);
  }, [setNodes, setEdges]);

  useEffect(() => {
    if (!activeWorkspace || activeWorkspace.type !== "board") return;
    if (isUndoingRef.current || nodes.some(node => node.dragging)) return;

    const timer = setTimeout(() => {
      const cleanNodes = nodes.map(stripNodeCallbacks);
      const snapshotStr = JSON.stringify({ nodes: cleanNodes, edges });
      if (snapshotStr !== lastRecordedRef.current) {
        if (lastRecordedRef.current) {
          undoStackRef.current.push(JSON.parse(lastRecordedRef.current));
          if (undoStackRef.current.length > 20) undoStackRef.current.shift();
          redoStackRef.current = [];
        }
        lastRecordedRef.current = snapshotStr;
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [nodes, edges, activeWorkspace]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) return;
      if (!event.ctrlKey && !event.metaKey) return;
      const key = event.key.toLowerCase();
      if (key === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if (key === "y") {
        event.preventDefault();
        handleRedo();
      } else if (key === "c") {
        event.preventDefault();
        copySelection();
      } else if (key === "x") {
        event.preventDefault();
        cutSelection();
      } else if (key === "v") {
        event.preventDefault();
        pasteSelection();
      } else if (key === "f") {
        event.preventDefault();
        setShowNodeSearchModal(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [nodes, edges, handleUndo, handleRedo]);

  async function downloadStashZip() {
    if (!activeWorkspace || activeWorkspace.type !== "board") return;
    const files = activeWorkspace.stashItems.map(item => ({
      name: getArtifactDownloadFileName(item.sourceNodeName || item.fileName, item.fileName, activeWorkspace.name),
      source: item.audioDataUrl
    }));
    await stashZipExport.download(files, `${sanitizeFileName(activeWorkspace.name)}-${formatDateForFile(new Date())}.zip`);
  }

  return (
    <main className="studio-shell" onClick={() => setMenu(null)}>
      {isDraggingJson && (
        <div className="json-drop-overlay">
          <FileDown size={48} />
          <h3>释放以导入 JSON 画板文件</h3>
          <p>支持拖放任意 JSON 画板文件直接解析并打开工作台</p>
        </div>
      )}
      <StudioTopbar {...{
        themeConfig,
        topbarCollapsed,
        topbarHoverTimerRef,
        showApiKeyModal,
        setTopbarCollapsed,
        apiKey,
        serverApiKeyConfigured,
        openApiKeyModal,
        setShowAppearanceModal,
        setShowStoragePathModal,
      }} />
      <ZipExportProgress progress={stashZipExport.progress} onCancel={stashZipExport.cancel} />
      {saveError ? <div className="workspace-save-notice" role="alert">{saveError} 当前编辑仍保留在界面，请勿关闭程序。
        <button type="button" onClick={exportUnsavedBackup}>导出未保存备份</button>
        <button type="button" onClick={() => void saveWorkspace()}>重试保存</button>
      </div> : isSaving ? <div className="workspace-save-notice" role="status">正在保存画板…</div> : null}

      {isSettingsLoaded && !apiKey && !serverApiKeyConfigured && showDefaultKeyWarning ? (
        <section className="api-warning">
          <AlertTriangle size={18} />
          <span>尚未配置 API Key，无法生成音频。请点击右上角 API Key 区域配置您的服务密钥。</span>
          <button className="api-warning-close" type="button" onClick={() => setShowDefaultKeyWarning(false)}>
            <X size={16} />
          </button>
        </section>
      ) : null}

      <ApiSettingsDialog {...{
        showApiKeyModal,
        handleBackdropMouseDown,
        handleBackdropClick,
        closeApiKeyModal,
        apiProviderInput,
        setApiProviderInput,
        setApiKeyInput,
        setProviderOptionsInput,
        setApiEndpointInput,
        providerOptionsInput,
        apiEndpointInput,
        serverApiKeyConfigured,
        apiKeyInput,
        settingsError,
        saveApiKey,
      }} />
      <AppearanceSettingsDialog {...{
        showAppearanceModal,
        handleBackdropMouseDown,
        handleBackdropClick,
        setShowAppearanceModal,
        themeConfig,
        isLight,
        updateNodePalette: (nodePalette: string) => setThemeConfig(prev => ({ ...prev, nodePalette })),
        updateBrandTitle,
        updateAutoHideTopbar,
        updateMode,
        resetLightPreset,
        updateLightThemePreset,
        setShowLightCustomColors,
        showLightCustomColors,
        updateLightColor,
        resetDarkPreset,
        updateDarkThemePreset,
        setShowDarkCustomColors,
        showDarkCustomColors,
        updateDarkColor,
        resetTheme,
      }} />

      <StorageSettingsDialog {...{
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
      }} />

      <AppleConfirmDialog {...{ appleConfirmState, handleBackdropMouseDown, handleBackdropClick, handleAppleConfirmClose }} />

      <section
        className={`studio-layout ${isResizingSidebar ? "is-resizing-active" : ""}`}
        style={{ gridTemplateColumns: sidebarCollapsed ? "50px 1fr" : `${sidebarWidth}px 12px 1fr` }}
      >
        <WorkspaceSidebar {...{
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
        }} />

        {!sidebarCollapsed && (
          <div
            className={`sidebar-resizer ${isResizingSidebar ? "is-resizing" : ""}`}
            onMouseDown={handleSidebarResizeStart}
            onDoubleClick={handleSidebarResetWidth}
            title="按住左右拖拽调节侧边栏宽度 (双击重置为 280px)"
          >
            <div className="sidebar-resizer-line" />
          </div>
        )}

        {activeWorkspace?.type === "audiobook" ? (
          <AudiobookConsole
            mimoWorkflowSupported={supportsMimoWorkflow(apiProvider, providerOptions.customProtocol)}
            workspace={activeWorkspace}
            apiKey={apiKey}
            apiEndpoint={apiEndpoint}
            onPatch={patchAudiobook}
            onAddChapter={addAudiobookChapter}
            onActivateChapter={(chapterId) => void activateAudiobookChapter(chapterId)}
            onCreateCharacter={createAudiobookCharacter}
            onAnalyze={analyzeAudiobookCharacters}
            onGenerateVoice={(charId) => void generateCharacterVoice(charId)}
            onDeleteVoice={(charId) => void deleteCharacterVoice(charId)}
            onAutoAnnotate={autoAnnotateAudiobook}
            onUpdateSegment={(segId, patch) => void updateAudiobookSegment(segId, patch)}
            onSaveWorkspace={saveWorkspace}
            onGenerate={generateAudiobookAudio}
            onRetryProduct={retryAudiobookProduct}
          />
        ) : (
          <BoardCanvas {...{
            activeWorkspace,
            patchWorkspaceName,
            saveWorkspace,
            tidyWorkspaceNodes,
            selectedNodesCount,
            setShowNodeSearchModal,
            flowWrapRef,
            handleFlowMouseDown,
            handleFlowMouseMove,
            openContextMenu,
            hydratedNodes,
            hydratedEdges,
            nodeTypes,
            edgeTypes,
            flowRef,
            handleCustomNodesChange,
            onEdgesChange,
            onConnect,
            onConnectEnd,
            onNodeDragStop,
            canvasMotion,
            isLight,
            nodeColors,
            menu,
            addNode,
            handleUndo,
            handleRedo,
            undoStackRef,
            redoStackRef,
            setMenu,
          }} />
        )}
      </section>
      {boardDialog ? (
        <BoardCreateDialog
          mimoWorkflowSupported={supportsMimoWorkflow(apiProvider, providerOptions.customProtocol)}
          mode={boardDialog}
          onClose={() => setBoardDialog(null)}
          onCreateBlank={() => {
            setBoardDialog(null);
            void createWorkspace();
          }}
          onCreateSmart={createSmartWorkspace}
          onCreateAudiobook={async (data) => {
            await createAudiobookWorkspace(data);
          }}
          onImportFile={(file) => {
            setBoardDialog(null);
            void importWorkspaceFile(file);
          }}
          onUseTemplate={async (templateId) => {
            setBoardDialog(null);
            const res = await fetch(`/api/templates/${templateId}/use`, { method: "POST" });
            const ws = (await res.json()) as WorkspacePayload & { error?: string };
            if (!res.ok) {
              alert(ws.error || "使用模板失败");
              return;
            }
            await loadWorkspaceList(ws.id);
          }}
          onSwitchMode={setBoardDialog}
        />
      ) : null}
      {saveAsTargetWorkspace ? (
        <SaveAsModal
          workspace={saveAsTargetWorkspace}
          onClose={() => setSaveAsTargetWorkspace(null)}
          onConfirm={(newName) => duplicateWorkspaceById(saveAsTargetWorkspace.id, newName)}
        />
      ) : null}
      {saveAsTemplateWorkspace ? (
        <SaveAsTemplateModal
          workspace={saveAsTemplateWorkspace}
          onClose={() => setSaveAsTemplateWorkspace(null)}
          onConfirm={(name, description) => saveWorkspaceAsTemplate(name, description)}
        />
      ) : null}
      {showExportModal ? (
        <ExportWorkspaceModal
          workspaces={workspaces}
          activeWorkspace={activeWorkspace}
          initialSelectedIds={selectedWorkspaceIds}
          initialTargetId={exportInitialTargetId}
          onClose={() => {
            setShowExportModal(false);
            setExportInitialTargetId(undefined);
          }}
          onSaveActiveWorkspace={saveWorkspace}
          onShowToast={showToast}
        />
      ) : null}
      {showNodeSearchModal && (
        <NodeSearchModal
          activeWorkspace={activeWorkspace}
          workspaces={workspaces}
          onClose={() => setShowNodeSearchModal(false)}
          onSelectNode={handleSelectSearchNode}
        />
      )}
      {appToast && (
        <div className="global-app-toast" onClick={(e) => e.stopPropagation()}>
          <CheckCircle2 size={18} style={{ color: "#10b981", flexShrink: 0 }} />
          <span className="global-app-toast-text">{appToast.text}</span>
          {appToast.actionText && appToast.onAction && (
            <button
              type="button"
              className="global-app-toast-btn"
              onClick={() => {
                appToast.onAction?.();
                setAppToast(null);
              }}
            >
              {appToast.actionText}
            </button>
          )}
          <button
            type="button"
            className="global-app-toast-close"
            onClick={() => setAppToast(null)}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </main>
  );
}
