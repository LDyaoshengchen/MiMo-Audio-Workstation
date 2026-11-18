import { afterEach, expect, it, vi } from "vitest";
import { createSynthesisActions, type SynthesisActionsContext } from "../src/studio/synthesisActions";
import { WorkspaceTaskStore } from "../src/studio/workspaceTasks";
import { hasActiveNodeTasks } from "../src/studio/taskScope";
import { normalizeProviderOptions } from "../src/utils/providerConfig";
import type { BoardWorkspacePayload, StudioNode } from "../src/types/studio";
import { computeSmartDagLayout } from "../src/utils/layout";
import { getStudioNodeSize } from "../src/studio/artifactPlacement";

afterEach(() => vi.unstubAllGlobals());
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const node = (title: string, type: StudioNode["type"] = "voiceClone"): StudioNode => ({ id: "same-source", type, position: { x: 0, y: 0 }, data: { title, text: "Test only", instruction: "Clear" } });
const board = (id: string, nodes: StudioNode[] = [node(id)]): BoardWorkspacePayload => ({ id, type: "board", name: id, nodes, edges: [], stashItems: [], createdAt: "v0", updatedAt: "v0" });
const success = () => Response.json({ fileName: "qa.wav", audioDataUrl: "data:audio/wav;base64,AAAA", elapsedMs: 1 });

function harness(source = node("A")) {
  const store = new WorkspaceTaskStore();
  const database = new Map([["A", board("A", [source])], ["B", board("B")]]);
  let provider = "mimo", version = 0;
  const ctx: SynthesisActionsContext = {
    nodesRef: { current: [source] }, edgesRef: { current: [] }, activeWorkspace: database.get("A")!, activeWorkspaceRef: { current: database.get("A")! },
    workspaceTasks: store, providerOptionsRef: { current: normalizeProviderOptions({ synthesisMode: "preset", voiceId: "voice-A" }) },
    isAnyApiKeyReady: () => true, getApiHeaders: () => ({ "X-API-Provider": provider }), vocalAbortMapRef: { current: {} },
    setNodes: vi.fn(value => { ctx.nodesRef.current = typeof value === "function" ? value(ctx.nodesRef.current) : value; }),
    setEdges: vi.fn(value => { ctx.edgesRef.current = typeof value === "function" ? value(ctx.edgesRef.current) : value; }),
    patchNode: vi.fn((id, patch) => { ctx.nodesRef.current = ctx.nodesRef.current.map(item => item.id === id ? { ...item, data: { ...item.data, ...patch } } : item); }),
    saveWorkspace: vi.fn(async () => {}),
    saveTaskWorkspace: vi.fn(async workspace => {
      const saved = clone({ ...workspace, updatedAt: `v${++version}` }); database.set(workspace.id, saved); return { updatedAt: saved.updatedAt };
    }),
  };
  const requests: { init: RequestInit; release: (response: Response) => void }[] = [];
  vi.stubGlobal("fetch", vi.fn((_url, init) => new Promise<Response>(resolve => { requests.push({ init, release: resolve }); })));
  const switchTo = (id: string, stale = database.get(id)!) => {
    store.capture(ctx.activeWorkspaceRef!.current, ctx.nodesRef.current, ctx.edgesRef.current);
    const restored = store.restore(clone(stale)) as BoardWorkspacePayload;
    ctx.activeWorkspaceRef!.current = restored; ctx.activeWorkspace = restored;
    ctx.nodesRef.current = restored.nodes; ctx.edgesRef.current = restored.edges;
  };
  return { ctx, store, database, requests, switchTo, setProvider: (value: string) => { provider = value; }, actions: createSynthesisActions(() => ctx) };
}

it.each(["voiceClone", "voiceDesign"] as const)("continues all %s requests on the original board, restores live progress and preserves intervening edits", async type => {
  const h = harness(node("A", type));
  const pending = type === "voiceClone" ? h.actions.runVoiceClone("same-source", 3) : h.actions.runVoiceDesign("same-source", 3);
  await vi.waitFor(() => expect(h.requests).toHaveLength(1));
  h.switchTo("B"); const otherNodes = clone(h.ctx.nodesRef.current);
  vi.mocked(h.ctx.setNodes).mockClear(); vi.mocked(h.ctx.setEdges).mockClear();
  h.requests[0].release(success());
  await vi.waitFor(() => expect(h.requests).toHaveLength(2));
  expect(h.ctx.nodesRef.current).toEqual(otherNodes);
  expect(h.ctx.setNodes).not.toHaveBeenCalled(); expect(h.ctx.setEdges).not.toHaveBeenCalled();
  expect(h.database.get("A")!.nodes.filter(item => item.type === "artifact")).toHaveLength(1);
  h.switchTo("A", board("A", [node("stale server copy", type)]));
  expect(h.ctx.nodesRef.current[0].data.isRunning).toBe(true);
  expect(h.ctx.nodesRef.current[0].data.generationProgress).toEqual({ completed: 1, total: 3 });
  h.ctx.nodesRef.current = [...h.ctx.nodesRef.current.map(item => item.id === "same-source" ? { ...item, position: { x: 123, y: 456 } } : item), { id: "comment", type: "comment", position: { x: 0, y: 0 }, data: { text: "Keep my edit" } }];
  h.switchTo("B"); h.requests[1].release(success());
  await vi.waitFor(() => expect(h.requests).toHaveLength(3));
  h.requests[2].release(success()); await pending;
  const saved = h.database.get("A")!;
  expect(saved.nodes.filter(item => item.type === "artifact")).toHaveLength(3);
  expect(saved.nodes[0].data.isRunning).toBe(false);
  expect(saved.nodes[0].position).toEqual({ x: 123, y: 456 });
  expect(saved.nodes.find(item => item.id === "comment")?.data.text).toBe("Keep my edit");
  expect(saved.edges).toHaveLength(3);
  expect(saved.edges.every(edge => saved.nodes.some(item => item.id === edge.source) && saved.nodes.some(item => item.id === edge.target))).toBe(true);
  expect(h.database.get("B")!.nodes).toEqual(board("B").nodes);
  expect(h.ctx.saveWorkspace).not.toHaveBeenCalled();
  expect(hasActiveNodeTasks("A")).toBe(false);
});

it("isolates simultaneous boards with reused node IDs and freezes each job's API settings", async () => {
  const h = harness(); const first = h.actions.runVoiceClone("same-source", 2);
  await vi.waitFor(() => expect(h.requests).toHaveLength(1));
  h.switchTo("B"); h.setProvider("openai");
  h.ctx.providerOptionsRef.current = normalizeProviderOptions({ synthesisMode: "preset", voiceId: "voice-B" });
  const second = h.actions.runVoiceClone("same-source");
  await vi.waitFor(() => expect(h.requests).toHaveLength(2));
  h.requests[0].release(success());
  await vi.waitFor(() => expect(h.requests).toHaveLength(3));
  expect(h.requests[2].init.headers).toMatchObject({ "X-API-Provider": "mimo" });
  expect((h.requests[2].init.body as FormData).get("voiceId")).toBe("voice-A");
  expect((h.requests[1].init.body as FormData).get("voiceId")).toBe("voice-B");
  h.requests[2].release(success()); await first;
  expect(h.ctx.nodesRef.current.filter(item => item.type === "artifact")).toHaveLength(0);
  h.requests[1].release(success()); await second;
  expect(h.database.get("A")!.nodes.filter(item => item.type === "artifact")).toHaveLength(2);
  expect(h.database.get("B")!.nodes.filter(item => item.type === "artifact")).toHaveLength(1);
  expect(h.ctx.nodesRef.current[0].data.isRunning).toBe(false);
});

it("saves partial results and final error/running flags on an off-screen board", async () => {
  const h = harness(); const pending = h.actions.runVoiceClone("same-source", 3);
  await vi.waitFor(() => expect(h.requests).toHaveLength(1)); h.switchTo("B");
  h.requests[0].release(success()); await vi.waitFor(() => expect(h.requests).toHaveLength(2));
  h.requests[1].release(Response.json({ error: "模拟接口失败" }, { status: 500 })); await pending;
  expect(h.database.get("A")!.nodes[0].data).toMatchObject({ isRunning: false, error: "模拟接口失败", generationProgress: { completed: 1, total: 3 } });
  expect(h.database.get("A")!.nodes.filter(item => item.type === "artifact")).toHaveLength(1);
  expect(h.ctx.nodesRef.current[0].data.error).toBeUndefined(); expect(h.requests).toHaveLength(2);
});

it("persists integrated row results and clears its single-row busy flag while off-screen", async () => {
  const source = node("A", "integratedStudio"); source.data.batchRows = [{ id: "row", title: "Row", text: "Test", instruction: "Clear" }];
  const h = harness(source), pending = h.actions.runIntegratedSingleRow("same-source", "row");
  await vi.waitFor(() => expect(h.requests).toHaveLength(1)); h.switchTo("B");
  h.requests[0].release(success()); await pending;
  expect(h.database.get("A")!.nodes[0].data.batchRows?.[0].artifacts).toHaveLength(1);
  expect(h.database.get("A")!.nodes[0].data.singleRunningRowId).toBeUndefined();
  expect(h.ctx.nodesRef.current).toEqual(board("B").nodes);
});

it("retains a completed graph if background saving fails, rather than reloading stale server data", async () => {
  const h = harness(); vi.mocked(h.ctx.saveTaskWorkspace!).mockRejectedValue(new Error("disk unavailable"));
  const pending = h.actions.runVoiceClone("same-source");
  await vi.waitFor(() => expect(h.requests).toHaveLength(1)); h.switchTo("B");
  h.requests[0].release(success()); await pending;
  const restored = h.store.restore(h.database.get("A")!) as BoardWorkspacePayload;
  expect(restored.nodes.filter(item => item.type === "artifact")).toHaveLength(1);
  expect(restored.nodes[0].data.isRunning).toBe(false);
  expect(h.database.get("A")!.nodes).toHaveLength(1);
  vi.mocked(h.ctx.saveTaskWorkspace!).mockImplementation(async workspace => {
    h.database.set("A", clone({ ...workspace, updatedAt: "recovered" })); return { updatedAt: "recovered" };
  });
  await h.store.retry("A");
  expect(h.database.get("A")!.nodes.filter(item => item.type === "artifact")).toHaveLength(1);
  h.store.restore(h.database.get("A")!);
  expect(h.store.has("A")).toBe(false);
});

it("does not append orphan results or continue queued calls after deleting the source node", async () => {
  const h = harness(); const pending = h.actions.runVoiceClone("same-source", 3);
  await vi.waitFor(() => expect(h.requests).toHaveLength(1)); h.ctx.nodesRef.current = [];
  h.switchTo("B"); h.requests[0].release(success()); await pending;
  expect((h.store.restore(board("A")) as BoardWorkspacePayload).nodes).toEqual([]);
  expect(h.requests).toHaveLength(1); expect(h.ctx.nodesRef.current).toEqual(board("B").nodes);
});

it.each(["voiceStyle", "voiceDesign"] as const)("saves %s AI refinement and its final status on the original board", async type => {
  const h = harness(node("A", type));
  const pending = type === "voiceStyle" ? h.actions.optimizeVoiceStyle("same-source") : h.actions.optimizeVoiceDesign("same-source");
  await vi.waitFor(() => expect(h.requests).toHaveLength(1)); h.switchTo("B");
  h.requests[0].release(Response.json({ optimizedText: "Refined instruction" })); await pending;
  expect(h.database.get("A")!.nodes[0].data).toMatchObject({ [type === "voiceStyle" ? "text" : "instruction"]: "Refined instruction", isRunning: false });
  expect(h.ctx.nodesRef.current).toEqual(board("B").nodes);
});

it("keeps stop flags separate for reused node IDs on different boards", async () => {
  const h = harness();
  const first = h.store.scope(h.ctx, () => h.ctx, "same-source")!;
  first.vocalAbortMapRef.current["same-source"] = false;
  h.switchTo("B");
  const second = h.store.scope(h.ctx, () => h.ctx, "same-source")!;
  second.vocalAbortMapRef.current["same-source"] = false;
  h.store.stopNode("B", "same-source");
  expect(second.vocalAbortMapRef.current["same-source"]).toBe(true);
  expect(first.vocalAbortMapRef.current["same-source"]).toBe(false);
  expect(first.activeWorkspace?.id).toBe("A");
  await first.finishTask(); await second.finishTask();
});

it.each(["voiceClone", "voiceDesign", "gameVocal"] as const)("%s follows mid-job tidy/drag, fills deleted slots and keeps the live layout in the background", async type => {
  const source = node("A", type);
  if (type === "gameVocal") Object.assign(source.data, { autoTrimTail: false, selectedVocals: Array.from({ length: 4 }, (_, i) => ({ id: `v${i}`, categoryId: "attack", categoryTitle: "攻击", subcategoryId: "hit", subcategoryLabel: "命中", text: "Ha!" })) });
  const h = harness(source);
  const pending = type === "voiceClone" ? h.actions.runVoiceClone(source.id, 4) : type === "voiceDesign" ? h.actions.runVoiceDesign(source.id, 4) : h.actions.runGameVocalClone(source.id);
  await vi.waitFor(() => expect(h.requests).toHaveLength(1));
  h.requests[0].release(success()); await vi.waitFor(() => expect(h.requests).toHaveLength(2));
  const initialResult = h.ctx.nodesRef.current.find(item => item.type === "artifact")!;
  const positions = computeSmartDagLayout(h.ctx.nodesRef.current.map(item => ({ id: item.id, type: item.type!, ...getStudioNodeSize(item), originalX: item.position.x, originalY: item.position.y, seqIndex: item.data.seqIndex })), h.ctx.edgesRef.current);
  h.ctx.nodesRef.current = h.ctx.nodesRef.current.map(item => ({ ...item, position: positions.get(item.id)! }));
  const tidySlot = positions.get(initialResult.id)!;
  h.ctx.nodesRef.current = h.ctx.nodesRef.current.filter(item => item.id !== initialResult.id);
  h.ctx.edgesRef.current = [];
  h.requests[1].release(success()); await vi.waitFor(() => expect(h.requests).toHaveLength(3));
  const second = h.ctx.nodesRef.current.find(item => item.type === "artifact")!;
  expect(second.position).toEqual(tidySlot); expect(second.data.seqIndex).toBe(2);
  h.ctx.nodesRef.current = h.ctx.nodesRef.current.map(item => item.id === source.id ? { ...item, position: { x: 2000, y: 900 } } : item);
  h.requests[2].release(success()); await vi.waitFor(() => expect(h.requests).toHaveLength(4));
  const third = h.ctx.nodesRef.current.find(item => item.data.seqIndex === 3)!;
  const liveSlot = { x: 2000 + getStudioNodeSize(source).width + 60, y: 900 };
  expect(third.position).toEqual(liveSlot);
  h.ctx.nodesRef.current = h.ctx.nodesRef.current.filter(item => item.type !== "artifact"); h.ctx.edgesRef.current = [];
  h.switchTo("B"); h.requests[3].release(success()); await pending;
  const saved = h.database.get("A")!, results = saved.nodes.filter(item => item.type === "artifact");
  expect(results).toHaveLength(1); expect(results[0].data.seqIndex).toBe(4); expect(results[0].position).toEqual(liveSlot);
  expect(saved.nodes.some(item => item.id === initialResult.id || item.id === second.id || item.id === third.id)).toBe(false);
  expect(saved.edges).toHaveLength(1); expect(saved.edges[0].target).toBe(results[0].id);
  expect(h.ctx.nodesRef.current).toEqual(board("B").nodes);
});

it.each(["batchVoiceClone", "batchVoiceDesign"] as const)("%s detects a deleted in-flight result card and creates only the new audio at its live position", async type => {
  const source = node("A", type); source.data.batchRows = [{ id: "row", title: "行", instruction: "Clear", text: "Test" }];
  const h = harness(source), pending = type === "batchVoiceClone" ? h.actions.runSingleRowBatchVoiceClone(source.id, "row") : h.actions.runSingleRowBatchVoiceDesign(source.id, "row");
  await vi.waitFor(() => expect(h.requests).toHaveLength(1));
  const deleted = h.ctx.nodesRef.current.find(item => item.type === "batchArtifact")!;
  h.ctx.nodesRef.current = h.ctx.nodesRef.current.filter(item => item.id !== deleted.id).map(item => ({ ...item, position: { x: 2100, y: 700 } })); h.ctx.edgesRef.current = [];
  h.switchTo("B"); h.requests[0].release(success()); await pending;
  const saved = h.database.get("A")!, result = saved.nodes.find(item => item.type === "batchArtifact")!;
  expect(result.id).not.toBe(deleted.id); expect(result.position).toEqual({ x: 2100 + getStudioNodeSize(source).width + 60, y: 700 });
  expect(result.data.batchArtifacts).toHaveLength(1); expect(saved.edges[0].target).toBe(result.id);
  expect(saved.nodes[0].data.singleRunningRowId).toBeUndefined(); expect(h.ctx.nodesRef.current).toEqual(board("B").nodes);
});

it.each(["batchVoiceClone", "batchVoiceDesign"] as const)("%s creates following rows from the current grid rather than the initial row ordinal", async type => {
  const source = node("A", type); source.data.batchRows = ["one", "two"].map(id => ({ id, title: id, text: "Test", instruction: "Clear" }));
  const h = harness(source), pending = type === "batchVoiceClone" ? h.actions.runBatchVoiceClone(source.id) : h.actions.runBatchVoiceDesign(source.id);
  await vi.waitFor(() => expect(h.requests).toHaveLength(1));
  const deleted = h.ctx.nodesRef.current.find(item => item.type === "batchArtifact")!;
  h.ctx.nodesRef.current = h.ctx.nodesRef.current.filter(item => item.id !== deleted.id).map(item => ({ ...item, position: { x: 1800, y: 600 } })); h.ctx.edgesRef.current = [];
  h.requests[0].release(success()); await vi.waitFor(() => expect(h.requests).toHaveLength(2));
  const results = h.ctx.nodesRef.current.filter(item => item.type === "batchArtifact"), x = 1800 + getStudioNodeSize(source).width + 60;
  expect(results.map(item => item.position)).toEqual([{ x, y: 600 }, { x: x + 500, y: 600 }]);
  expect(results[0].data.batchArtifacts).toHaveLength(1);
  h.ctx.nodesRef.current = h.ctx.nodesRef.current.filter(item => item.type !== "batchArtifact"); h.ctx.edgesRef.current = [];
  h.switchTo("B"); h.requests[1].release(success()); await pending;
  const saved = h.database.get("A")!, final = saved.nodes.filter(item => item.type === "batchArtifact");
  expect(final).toHaveLength(1); expect(final[0].position).toEqual({ x, y: 600 }); expect(final[0].data.batchArtifacts).toHaveLength(1);
  expect(saved.edges).toHaveLength(1); expect(saved.nodes[0].data.isRunning).toBe(false);
});
