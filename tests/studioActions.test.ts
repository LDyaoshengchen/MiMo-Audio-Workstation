// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSynthesisActions, type SynthesisActionsContext } from "../src/studio/synthesisActions";
import { createStorageActions, type StorageActionsContext } from "../src/studio/storageActions";
import { createAudiobookActions, type AudiobookActionsContext } from "../src/studio/audiobookActions";
import { normalizeProviderOptions } from "../src/utils/providerConfig";
import { createArtifactNode, ensureArtifactSeqIndexes, stripNodeCallbacks } from "../src/studio/graph";
import { getNodeDefaultData } from "../src/studio/config";
import { setAppleConfirmHandler, showAppleConfirm } from "../src/studio/confirmation";
import type { StudioNode } from "../src/types/studio";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); setAppleConfirmHandler(null); });

function synthesisContext(nodes: StudioNode[]): SynthesisActionsContext {
  const context: SynthesisActionsContext = {
    nodesRef: { current: nodes }, edgesRef: { current: [] },
    providerOptionsRef: { current: normalizeProviderOptions({ synthesisMode: "preset", voiceId: "alloy" }) },
    vocalAbortMapRef: { current: {} }, activeWorkspace: null,
    isAnyApiKeyReady: () => true,
    getApiHeaders: () => ({ "X-API-Provider": "openai", "X-API-Key": "test-key" }),
    saveWorkspace: vi.fn(async () => {}), setNodes: vi.fn(), setEdges: vi.fn(),
    patchNode: vi.fn((id, patch) => {
      context.nodesRef.current = context.nodesRef.current.map(node => node.id === id ? { ...node, data: { ...node.data, ...patch } } : node);
    }),
  };
  return context;
}

describe("extracted studio actions", () => {
  it("does not evaluate controller dependencies during initialization", () => {
    const read = vi.fn(() => { throw new Error("Controller is not initialized yet"); });
    expect(() => createSynthesisActions(read)).not.toThrow();
    expect(() => createStorageActions(read)).not.toThrow();
    expect(() => createAudiobookActions(read)).not.toThrow();
    expect(read).not.toHaveBeenCalled();
  });

  it("single clone preserves provider headers, WAV format, sequence and save", async () => {
    const clone: StudioNode = { id: "clone", type: "voiceClone", position: { x: 0, y: 0 }, data: { title: "VO_00085", text: "Hello" } };
    const context = synthesisContext([clone]);
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ fileName: "cached.wav", audioDataUrl: "/api/audio-cache/cached.wav", elapsedMs: 12 })));
    vi.stubGlobal("fetch", fetchMock);
    await createSynthesisActions(() => context).runVoiceClone("clone");
    const [url, request] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/tts/voiceclone");
    expect(request.headers).toMatchObject({ "X-API-Provider": "openai", "X-API-Key": "test-key" });
    expect((request.body as FormData).get("format")).toBe("wav");
    expect((request.body as FormData).get("voiceId")).toBe("alloy");
    expect(context.nodesRef.current.at(-1)?.data.title).toBe("VO_00085_01");
    expect(context.nodesRef.current[0].data.isRunning).toBe(false);
    expect(context.edgesRef.current).toHaveLength(1);
    expect(context.saveWorkspace).toHaveBeenCalledWith(context.nodesRef.current, context.edgesRef.current);
  });

  it("integrated single generation preserves existing artifacts and increments sequence", async () => {
    const node: StudioNode = { id: "integrated", type: "integratedStudio", position: { x: 0, y: 0 }, data: {
      title: "全能综合工作台", batchRows: [{ id: "row", title: "VO_tiegou", text: "Come here!", instruction: "Loud", artifacts: [
        { id: "old", seqIndex: 4, fileName: "old.wav", audioDataUrl: "/api/audio-cache/old.wav", elapsedMs: 1, createdAt: "2026-10-08" }
      ] }]
    } };
    const context = synthesisContext([node]);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ fileName: "new.wav", audioDataUrl: "/api/audio-cache/new.wav", elapsedMs: 2 }))));
    await createSynthesisActions(() => context).runIntegratedSingleRow("integrated", "row");
    const result = context.nodesRef.current[0].data;
    expect(result.batchRows?.[0].artifacts?.map(item => item.seqIndex)).toEqual([4, 5]);
    expect(result.singleRunningRowId).toBeUndefined();
    expect(context.saveWorkspace).toHaveBeenCalledWith(context.nodesRef.current);
  });

  it("missing key blocks vendor calls with the same node error", async () => {
    const context = synthesisContext([{ id: "clone", type: "voiceClone", position: { x: 0, y: 0 }, data: { title: "VO", text: "Hello" } }]);
    context.isAnyApiKeyReady = () => false;
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    await createSynthesisActions(() => context).runVoiceClone("clone");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(context.nodesRef.current[0].data.error).toContain("API Key 未配置");
  });

  it("storage actions use the input supplied at invocation, not factory creation", async () => {
    let input = "D:/first";
    const context: StorageActionsContext = { customPathInput: input, setStoragePathInfo: vi.fn(), setCustomPathInput: vi.fn(), loadWorkspaceList: vi.fn(async () => {}) };
    const actions = createStorageActions(() => ({ ...context, customPathInput: input }));
    input = "D:/latest";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ dataDir: input })));
    vi.stubGlobal("fetch", fetchMock); vi.stubGlobal("alert", vi.fn());
    await actions.saveCustomStoragePath();
    expect(JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)).toEqual({ targetDir: "D:/latest" });
    expect(context.loadWorkspaceList).toHaveBeenCalledOnce();
  });

  it("audiobook workflow guard remains before any HTTP call", async () => {
    const context: AudiobookActionsContext = {
      apiProviderRef: { current: "openai" }, providerOptionsRef: { current: normalizeProviderOptions() },
      getApiHeaders: vi.fn(), loadWorkspaceList: vi.fn(async () => {}), setActiveWorkspace: vi.fn(), activeWorkspace: null,
    };
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    await expect(createAudiobookActions(() => context).createAudiobookWorkspace({ novelText: "Novel", characterHints: "" })).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(context.getApiHeaders).not.toHaveBeenCalled();
  });
});

describe("shared graph and confirmation boundaries", () => {
  it("retains default node data and legacy naming cleanup", () => {
    expect(getNodeDefaultData("integratedStudio").batchRows).toBeDefined();
    const source: StudioNode = { id: "source", type: "voiceClone", position: { x: 0, y: 0 }, data: { title: "VO_00085" } };
    const artifact = createArtifactNode(source, { audioDataUrl: "/api/audio-cache/a.wav", fileName: "a.wav", elapsedMs: 1 });
    expect(artifact.data.title).toBe("VO_00085_01");
    const legacy = ensureArtifactSeqIndexes({ ...artifact, data: { ...artifact.data, title: "VO_00085_产物_01" } });
    expect(legacy.data.title).toBe("VO_00085_01");
    const saved = stripNodeCallbacks({ ...artifact, data: { ...artifact.data, onDelete: vi.fn(), stashedArtifactKeys: new Set(["transient"]) } });
    expect(saved.data.onDelete).toBeUndefined();
    expect(saved.data.stashedArtifactKeys).toBeUndefined();
  });

  it("confirmation uses the shared handler and resets to native fallback", async () => {
    const custom = vi.fn(async () => true);
    setAppleConfirmHandler(custom);
    await expect(showAppleConfirm({ title: "删除" })).resolves.toBe(true);
    expect(custom).toHaveBeenCalledWith({ title: "删除" });
    setAppleConfirmHandler(null);
    vi.spyOn(window, "confirm").mockReturnValue(false);
    await expect(showAppleConfirm({ title: "删除" })).resolves.toBe(false);
  });
});
