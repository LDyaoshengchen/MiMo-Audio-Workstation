// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, useMemo, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { IntegratedPipelineRow, type IntegratedRowActions } from "../src/components/IntegratedPipelineRow";
import type { IntegratedArtifactContext } from "../src/components/IntegratedRowArtifactList";
import type { BatchVoiceCloneRow } from "../src/types/studioAudio";
import { useStableEvent } from "../src/utils/useStableEvent";

const playerRender = vi.hoisted(() => vi.fn());
vi.mock("../src/components/StudioAudioPlayer", () => ({
  // Intentionally NOT memoized: proves the row/list boundaries themselves skip player rendering.
  StudioAudioPlayer: ({ src }: { src: string }) => { playerRender(src); return <audio src={src} />; },
}));
const run = vi.fn();
const toggle = vi.fn();
const remove = vi.fn();
const initialRows: BatchVoiceCloneRow[] = Array.from({ length: 3 }, (_, index) => ({
  id: `row-${index}`, title: `VO_${index}`, text: "Hello", instruction: "Warm",
  refAudioUrl: `ref-${index}.wav`, artifacts: [{ id: `art-${index}`, fileName: "cache.wav",
    audioDataUrl: `output-${index}.wav`, elapsedMs: 100, createdAt: "2026-10-08T17:00:02" }],
}));
function Harness({ label = "first" }) {
  const [rows, setRows] = useState(initialRows);
  const [tick, setTick] = useState(0);
  const [includeBoard, setIncludeBoard] = useState(true);
  const [stashed, setStashed] = useState<ReadonlySet<string>>(new Set());
  const update = useStableEvent((rowId: string, field: keyof BatchVoiceCloneRow, value: string) => {
    setRows(previous => previous.map(row => row.id === rowId ? { ...row, [field]: value } : row));
  });
  const onRun = useStableEvent((rowId: string) => run(label, rowId));
  const actions = useMemo<IntegratedRowActions>(() => ({
    onDragOver: vi.fn(), onDrop: vi.fn(), onClearReference: vi.fn(), onUpload: vi.fn(),
    onStopRecording: vi.fn(), onStartRecording: vi.fn(), onUpdate: update,
    onPaste: vi.fn(), onRemove: vi.fn(), onRun,
  }), [update, onRun]);
  const context = useMemo<IntegratedArtifactContext>(() => ({
    nodeId: "node", nodeTitle: "全能综合工作台", workspaceName: "怪物",
    settings: { includeWorkspaceName: includeBoard, includeTime: false }, stashedKeys: stashed,
    onToggleStash: toggle, onDeleteArtifact: remove,
  }), [includeBoard, stashed]);
  return <>
    <button id="tick" onClick={() => setTick(tick + 1)}>无关更新 {tick}</button>
    <button id="edit" onClick={() => update("row-0", "text", "Edited")}>修改第一行</button>
    <button id="settings" onClick={() => setIncludeBoard(value => !value)}>命名设置</button>
    <button id="stash" onClick={() => setStashed(new Set([JSON.stringify(["cache.wav", "output-0.wav"])]))}>暂存状态</button>
    {rows.map((row, index) => <IntegratedPipelineRow key={row.id} row={row} index={index} canRemove
      isDragOver={false} isRecording={false} isGenerating={false} isBatchRunning={false}
      recordTimeStr="" actions={actions} artifactContext={context} />)}
  </>;
}

describe("split integrated components isolate unrelated updates", () => {
  let root: Root;
  let host: HTMLDivElement;
  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    playerRender.mockClear(); run.mockClear(); toggle.mockClear(); remove.mockClear();
    host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
  async function click(selector: string) { await act(async () => (host.querySelector(selector) as HTMLElement).click()); }
  it("does not rerender players for unrelated parent updates or row text edits", async () => {
    await act(async () => root.render(<Harness />));
    expect(playerRender).toHaveBeenCalledTimes(6);
    playerRender.mockClear();
    await click("#tick");
    expect(playerRender).not.toHaveBeenCalled();
    await click("#edit");
    expect((host.querySelector(".integrated-textarea:nth-of-type(2)") as HTMLTextAreaElement).value).toBe("Edited");
    // Only the edited row's reference player renders; its unchanged artifact list and both other rows skip.
    expect(playerRender.mock.calls).toEqual([["ref-0.wav"]]);
  });
  it("uses latest handlers and propagates settings, stash state, and delete actions", async () => {
    await act(async () => root.render(<Harness label="first" />));
    await act(async () => root.render(<Harness label="latest" />));
    await click(".batch-row-single-clone-btn");
    expect(run).toHaveBeenCalledWith("latest", "row-0");
    expect(host.querySelector("a[download]")?.getAttribute("download")).toBe("怪物_VO_0_01.wav");
    await click("#settings");
    expect(host.querySelector("a[download]")?.getAttribute("download")).toBe("VO_0_01.wav");
    await click("#stash");
    expect(host.querySelector(".batch-artifact-item-btn.stashed")?.textContent).toContain("已暂存");
    await click(".batch-artifact-item-btn.stashed");
    expect(toggle).toHaveBeenCalledWith(expect.objectContaining({ sourceNodeId: "node", sourceRowId: "row-0", sourceNodeName: "VO_0_01" }));
    await click('[title="删除此音频"]');
    expect(remove).toHaveBeenCalledWith("row-0", "art-0");
  });
});
