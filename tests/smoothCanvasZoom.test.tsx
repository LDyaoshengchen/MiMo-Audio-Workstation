// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useSmoothCanvasZoom } from "../src/utils/useSmoothCanvasZoom";
import type { ZoomViewport } from "../src/utils/frameWheelZoom";

describe("canvas wheel binding and visual quality restoration", () => {
  let host: HTMLDivElement, root: Root;
  let viewport: ZoomViewport;
  let frames: FrameRequestCallback[];
  const write = vi.fn(async (next: ZoomViewport) => { viewport = next; return true; });
  function Harness({ board = "board-1" }) {
    const element = useRef<HTMLDivElement>(null);
    const flow = useRef({ getViewport: () => viewport, setViewport: write });
    const motion = useSmoothCanvasZoom(element, flow, board);
    return <div ref={element} className="flow-wrap">
      <div className="react-flow__pane" />
      <div className="nowheel"><textarea /></div>
      <button id="detail" onClick={() => motion.detail(null, viewport)}>detail</button>
    </div>;
  }
  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers(); frames = []; viewport = { x: 0, y: 0, zoom: 1 }; write.mockClear();
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(function (callback) {
      expect(this).toBe(window); frames.push(callback); return frames.length;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.useRealTimers(); });
  it("actually transforms the viewport once per frame, leaves internal scroll alone, and restores idle quality", async () => {
    await act(async () => root.render(<Harness />));
    const pane = host.querySelector(".react-flow__pane")!;
    for (let i = 0; i < 30; i++) {
      const event = new WheelEvent("wheel", { deltaY: -2, bubbles: true, cancelable: true, clientX: 300, clientY: 200 });
      pane.dispatchEvent(event); expect(event.defaultPrevented).toBe(true);
    }
    expect(host.firstElementChild?.classList.contains("is-viewport-moving")).toBe(true);
    expect(frames).toHaveLength(1);
    await act(async () => frames[0](0));
    expect(write).toHaveBeenCalledTimes(1); expect(viewport.zoom).toBeGreaterThan(1);
    const fieldWheel = new WheelEvent("wheel", { deltaY: 40, bubbles: true, cancelable: true });
    host.querySelector("textarea")!.dispatchEvent(fieldWheel);
    expect(fieldWheel.defaultPrevented).toBe(false); expect(frames).toHaveLength(1);
    await act(async () => vi.advanceTimersByTime(200));
    expect(host.firstElementChild?.classList.contains("is-viewport-moving")).toBe(false);
  });
  it("updates overview only across its threshold and clears pending work when the board changes", async () => {
    viewport.zoom = 0.2;
    await act(async () => root.render(<Harness />));
    expect(host.firstElementChild?.classList.contains("is-canvas-overview")).toBe(true);
    viewport.zoom = 0.6;
    await act(async () => (host.querySelector("#detail") as HTMLElement).click());
    expect(host.firstElementChild?.classList.contains("is-canvas-overview")).toBe(false);
    host.querySelector(".react-flow__pane")!.dispatchEvent(new WheelEvent("wheel", { deltaY: 20, bubbles: true, cancelable: true }));
    await act(async () => root.render(<Harness board="board-2" />));
    expect(window.cancelAnimationFrame).toHaveBeenCalledWith(1);
    expect(host.firstElementChild?.classList.contains("is-viewport-moving")).toBe(false);
  });
});
