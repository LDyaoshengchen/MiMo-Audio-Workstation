import type { RefObject, Dispatch, SetStateAction } from "react";
import type { ProviderOptions } from "../utils/providerConfig";
import type { WorkspacePayload, AudiobookWorkspacePayload, AudiobookCharacter, AudiobookChapter, AudiobookSegment, AudiobookProduct } from "../types/studio";
import { supportsMimoWorkflow, MIMO_WORKFLOW_NOTICE } from "../utils/providerSupport";

export interface AudiobookActionsContext {
  apiProviderRef: RefObject<string>;
  providerOptionsRef: RefObject<ProviderOptions>;
  getApiHeaders: (isJson?: boolean, extraHeaders?: Record<string, string>) => Record<string, string>;
  loadWorkspaceList: (preferredId?: string) => Promise<void>;
  setActiveWorkspace: Dispatch<SetStateAction<WorkspacePayload | null>>;
  activeWorkspace: WorkspacePayload | null;
}

// Read controller dependencies on invocation, never during render initialization.
export function createAudiobookActions(getContext: () => AudiobookActionsContext) {
  async function createAudiobookWorkspace(data: { novelText: string; characterHints: string; name?: string }) {
    const { apiProviderRef, providerOptionsRef, getApiHeaders, loadWorkspaceList } = getContext();
    if (!supportsMimoWorkflow(apiProviderRef.current, providerOptionsRef.current.customProtocol)) throw new Error(MIMO_WORKFLOW_NOTICE);
    const response = await fetch("/api/audiobook", {
      method: "POST",
      headers: getApiHeaders(true),
      body: JSON.stringify(data)
    });
    const workspace = (await response.json()) as AudiobookWorkspacePayload & { error?: string };
    if (!response.ok) {
      throw new Error(workspace.error || "创建有声书失败");
    }
    await loadWorkspaceList(workspace.id);
  }

  function patchAudiobook(patch: Partial<AudiobookWorkspacePayload>) {
    const { setActiveWorkspace } = getContext();
    setActiveWorkspace((workspace) => {
      if (!workspace || workspace.type !== "audiobook") return workspace;
      return { ...workspace, ...patch } as AudiobookWorkspacePayload;
    });
  }

  async function addAudiobookChapter(data: { title: string; novelText: string; characterHints: string }) {
    const { activeWorkspace, getApiHeaders, setActiveWorkspace } = getContext();
    if (!activeWorkspace || activeWorkspace.type !== "audiobook") throw new Error("工作区状态异常");
    const workspaceId = activeWorkspace.id;
    const response = await fetch(`/api/audiobook/${workspaceId}/chapters`, {
      method: "POST",
      headers: getApiHeaders(true),
      body: JSON.stringify(data)
    });
    const result = (await response.json()) as { workspace?: AudiobookWorkspacePayload; error?: string };
    if (!response.ok || !result.workspace) {
      throw new Error(result.error || "新增章节失败");
    }
    setActiveWorkspace(result.workspace);
  }

  async function activateAudiobookChapter(chapterId: string) {
    const { activeWorkspace, getApiHeaders, setActiveWorkspace } = getContext();
    if (!activeWorkspace || activeWorkspace.type !== "audiobook") return;
    const workspaceId = activeWorkspace.id;
    const response = await fetch(`/api/audiobook/${workspaceId}/chapters/${chapterId}/activate`, {
      method: "POST",
      headers: getApiHeaders(false)
    });
    const result = (await response.json()) as { workspace?: AudiobookWorkspacePayload; error?: string };
    if (!response.ok || !result.workspace) {
      throw new Error(result.error || "切换章节失败");
    }
    setActiveWorkspace(result.workspace);
  }

  async function createAudiobookCharacter(formData: FormData) {
    const { activeWorkspace, getApiHeaders, setActiveWorkspace } = getContext();
    if (!activeWorkspace || activeWorkspace.type !== "audiobook") throw new Error("工作区状态异常");
    const workspaceId = activeWorkspace.id;
    const response = await fetch(`/api/audiobook/${workspaceId}/characters`, {
      method: "POST",
      headers: getApiHeaders(false),
      body: formData
    });
    const result = (await response.json()) as { characters?: AudiobookCharacter[]; chapter?: AudiobookChapter; error?: string };
    if (!response.ok) {
      throw new Error(result.error || "创建音色角色失败");
    }
    setActiveWorkspace((workspace) => {
      if (!workspace || workspace.type !== "audiobook" || workspace.id !== workspaceId) return workspace;
      return { ...workspace, characters: result.characters ?? workspace.characters };
    });
  }

  async function analyzeAudiobookCharacters() {
    const { activeWorkspace, getApiHeaders, setActiveWorkspace } = getContext();
    if (!activeWorkspace || activeWorkspace.type !== "audiobook") throw new Error("工作区状态异常");
    const workspaceId = activeWorkspace.id;
    const response = await fetch(`/api/audiobook/${workspaceId}/characters/analyze`, {
      method: "POST",
      headers: getApiHeaders(false)
    });
    const result = (await response.json()) as { characters?: AudiobookCharacter[]; chapter?: AudiobookChapter; error?: string };
    if (!response.ok) {
      throw new Error(result.error || "角色分析失败");
    }
    setActiveWorkspace((workspace) => {
      if (!workspace || workspace.type !== "audiobook" || workspace.id !== workspaceId) return workspace;
      if (!result.chapter) {
        return { ...workspace, characters: result.characters ?? [] };
      }
      return {
        ...workspace,
        characters: result.characters ?? workspace.characters,
        chapters: workspace.chapters.map((chapter) => (chapter.id === result.chapter!.id ? result.chapter! : chapter)),
        activeChapterId: result.chapter.id,
        novelText: result.chapter.novelText,
        characterHints: result.chapter.characterHints,
        segments: result.chapter.segments,
        products: result.chapter.products,
        phase: result.chapter.phase
      };
    });
  }

  async function generateCharacterVoice(charId: string) {
    const { activeWorkspace, setActiveWorkspace, getApiHeaders } = getContext();
    if (!activeWorkspace || activeWorkspace.type !== "audiobook") return;
    const workspaceId = activeWorkspace.id;
    setActiveWorkspace((workspace) => {
      if (!workspace || workspace.type !== "audiobook" || workspace.id !== workspaceId) return workspace;
      return {
        ...workspace,
        characters: workspace.characters.map((c) =>
          c.id === charId ? { ...c, voiceStatus: "generating" as AudiobookCharacter["voiceStatus"], voiceError: undefined } : c
        )
      };
    });
    const response = await fetch(`/api/audiobook/${workspaceId}/characters/${charId}/voice`, {
      method: "POST",
      headers: getApiHeaders(false)
    });
    const result = (await response.json()) as { character?: AudiobookCharacter; error?: string };
    if (!response.ok) {
      setActiveWorkspace((workspace) => {
        if (!workspace || workspace.type !== "audiobook" || workspace.id !== workspaceId) return workspace;
        return {
          ...workspace,
          characters: workspace.characters.map((c) =>
            c.id === charId ? { ...c, voiceStatus: "error" as AudiobookCharacter["voiceStatus"], voiceError: result.error || "生成失败" } : c
          )
        };
      });
      return;
    }
    setActiveWorkspace((workspace) => {
      if (!workspace || workspace.type !== "audiobook" || workspace.id !== workspaceId) return workspace;
      return {
        ...workspace,
        characters: workspace.characters.map((c) => (c.id === charId ? result.character! : c))
      };
    });
  }

  async function deleteCharacterVoice(charId: string) {
    const { activeWorkspace, getApiHeaders, setActiveWorkspace } = getContext();
    if (!activeWorkspace || activeWorkspace.type !== "audiobook") return;
    const workspaceId = activeWorkspace.id;
    const response = await fetch(`/api/audiobook/${workspaceId}/characters/${charId}/voice`, {
      method: "DELETE",
      headers: getApiHeaders(false)
    });
    const result = (await response.json()) as { character?: AudiobookCharacter; error?: string };
    if (!response.ok) {
      throw new Error(result.error || "删除音色失败");
    }
    setActiveWorkspace((workspace) => {
      if (!workspace || workspace.type !== "audiobook" || workspace.id !== workspaceId) return workspace;
      return {
        ...workspace,
        characters: workspace.characters.map((c) => (c.id === charId ? result.character! : c))
      };
    });
  }

  async function autoAnnotateAudiobook() {
    const { activeWorkspace, getApiHeaders, setActiveWorkspace } = getContext();
    if (!activeWorkspace || activeWorkspace.type !== "audiobook") throw new Error("工作区状态异常");
    const workspaceId = activeWorkspace.id;
    const response = await fetch(`/api/audiobook/${workspaceId}/annotate`, {
      method: "POST",
      headers: getApiHeaders(false)
    });
    const result = (await response.json()) as { segments?: AudiobookSegment[]; chapter?: AudiobookChapter; error?: string };
    if (!response.ok) {
      throw new Error(result.error || "自动标注失败");
    }
    setActiveWorkspace((workspace) => {
      if (!workspace || workspace.type !== "audiobook" || workspace.id !== workspaceId) return workspace;
      if (result.chapter) {
        return {
          ...workspace,
          chapters: workspace.chapters.map((chapter) => (chapter.id === result.chapter!.id ? result.chapter! : chapter)),
          activeChapterId: result.chapter.id,
          segments: result.chapter.segments,
          products: result.chapter.products,
          phase: result.chapter.phase
        };
      }
      return { ...workspace, segments: result.segments ?? [], phase: "annotation" };
    });
  }

  async function updateAudiobookSegment(segId: string, patch: { characterId: string | null; characterName: string; emotion: string }) {
    const { activeWorkspace, getApiHeaders, setActiveWorkspace } = getContext();
    if (!activeWorkspace || activeWorkspace.type !== "audiobook") return;
    const response = await fetch(`/api/audiobook/${activeWorkspace.id}/segments/${segId}`, {
      method: "PUT",
      headers: getApiHeaders(true),
      body: JSON.stringify(patch)
    });
    const result = (await response.json()) as { segment?: AudiobookSegment; error?: string };
    if (!response.ok) {
      throw new Error(result.error || "标注失败");
    }
    setActiveWorkspace((workspace) => {
      if (!workspace || workspace.type !== "audiobook" || workspace.id !== activeWorkspace.id) return workspace;
      return {
        ...workspace,
        segments: workspace.segments.map((s) => (s.id === segId ? result.segment! : s)),
        chapters: workspace.chapters.map((chapter) =>
          chapter.id === workspace.activeChapterId
            ? { ...chapter, segments: chapter.segments.map((s) => (s.id === segId ? result.segment! : s)) }
            : chapter
        )
      };
    });
  }

  async function generateAudiobookAudio() {
    const { activeWorkspace, setActiveWorkspace, getApiHeaders } = getContext();
    if (!activeWorkspace || activeWorkspace.type !== "audiobook") throw new Error("工作区状态异常");
    const workspaceId = activeWorkspace.id;
    setActiveWorkspace((workspace) => {
      if (!workspace || workspace.type !== "audiobook" || workspace.id !== workspaceId) return workspace;
      return {
        ...workspace,
        phase: "generation",
        chapters: workspace.chapters.map((chapter) =>
          chapter.id === workspace.activeChapterId ? { ...chapter, phase: "generation" } : chapter
        )
      };
    });
    const response = await fetch(`/api/audiobook/${workspaceId}/generate`, {
      method: "POST",
      headers: getApiHeaders(false)
    });
    const result = (await response.json()) as { products?: AudiobookProduct[]; error?: string };
    if (!response.ok) {
      throw new Error(result.error || "生成失败");
    }
    setActiveWorkspace((workspace) => {
      if (!workspace || workspace.type !== "audiobook" || workspace.id !== workspaceId) return workspace;
      return {
        ...workspace,
        products: result.products ?? [],
        chapters: workspace.chapters.map((chapter) =>
          chapter.id === workspace.activeChapterId ? { ...chapter, products: result.products ?? [] } : chapter
        )
      };
    });
    await pollAudiobookGeneration(workspaceId);
  }

  async function retryAudiobookProduct(productId: string) {
    const { activeWorkspace, setActiveWorkspace, getApiHeaders } = getContext();
    if (!activeWorkspace || activeWorkspace.type !== "audiobook") return;
    const workspaceId = activeWorkspace.id;
    setActiveWorkspace((workspace) => {
      if (!workspace || workspace.type !== "audiobook" || workspace.id !== workspaceId) return workspace;
      return {
        ...workspace,
        products: workspace.products.map((product) =>
          product.id === productId
            ? { ...product, status: "generating" as AudiobookProduct["status"], audioDataUrl: null, error: undefined, elapsedMs: undefined }
            : product
        ),
        chapters: workspace.chapters.map((chapter) =>
          chapter.id === workspace.activeChapterId
            ? {
              ...chapter,
              products: chapter.products.map((product) =>
                product.id === productId
                  ? { ...product, status: "generating" as AudiobookProduct["status"], audioDataUrl: null, error: undefined, elapsedMs: undefined }
                  : product
              )
            }
            : chapter
        )
      };
    });

    const response = await fetch(`/api/audiobook/${workspaceId}/products/${productId}/retry`, {
      method: "POST",
      headers: getApiHeaders(false)
    });
    const result = (await response.json()) as { product?: AudiobookProduct; error?: string };
    if (result.product) {
      setActiveWorkspace((workspace) => {
        if (!workspace || workspace.type !== "audiobook" || workspace.id !== workspaceId) return workspace;
        return {
          ...workspace,
          products: workspace.products.map((product) => (product.id === productId ? result.product! : product)),
          chapters: workspace.chapters.map((chapter) =>
            chapter.id === workspace.activeChapterId
              ? { ...chapter, products: chapter.products.map((product) => (product.id === productId ? result.product! : product)) }
              : chapter
          )
        };
      });
    }
    if (!response.ok && !result.product) {
      throw new Error(result.error || "重试生成失败");
    }
  }

  async function pollAudiobookGeneration(workspaceId: string) {
    const { setActiveWorkspace } = getContext();
    for (let attempt = 0; attempt < 240; attempt++) {
      await wait(1500);
      const response = await fetch(`/api/workspaces/${workspaceId}`);
      if (!response.ok) {
        throw new Error(`刷新有声书生成进度失败：HTTP ${response.status}`);
      }

      const workspace = (await response.json()) as WorkspacePayload;
      if (workspace.type !== "audiobook") {
        throw new Error("工作区类型异常");
      }

      setActiveWorkspace((current) => {
        if (!current || current.type !== "audiobook" || current.id !== workspaceId) return current;
        return workspace;
      });

      if (!workspace.products.some((product) => product.status === "pending" || product.status === "generating")) {
        return;
      }
    }

    throw new Error("有声书生成仍在进行中，请稍后刷新查看结果。");
  }

  function wait(ms: number) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  return { createAudiobookWorkspace, patchAudiobook, addAudiobookChapter, activateAudiobookChapter, createAudiobookCharacter, analyzeAudiobookCharacters, generateCharacterVoice, deleteCharacterVoice, autoAnnotateAudiobook, updateAudiobookSegment, generateAudiobookAudio, retryAudiobookProduct, pollAudiobookGeneration, wait };
}
