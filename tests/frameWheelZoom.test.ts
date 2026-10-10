// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createFrameWheelZoom, isCanvasWheelTarget, zoomAtPoint } from "../src/utils/frameWheelZoom";

describe("frame-batched wheel zoom", () => {
  it("coalesces 500 wheel events into one transform, preserving their accumulated zoom", () => {
    const callbacks: FrameRequestCallback[] = [];
    const write = vi.fn();
    const zoom = createFrameWheelZoom({ read: () => ({ x: 50, y: 20, zoom: 1 }), write,
      point: (x, y) => ({ x, y }), minZoom: 0.005, maxZoom: 30,
      requestFrame: callback => { callbacks.push(callback); return callbacks.length; }, cancelFrame: vi.fn() });
    for (let i = 0; i < 500; i++) zoom.push({ deltaY: -1, deltaMode: 0, ctrlKey: false, clientX: 300, clientY: 200 });
    expect(callbacks).toHaveLength(1); expect(write).not.toHaveBeenCalled();
    callbacks[0](0);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0][0].zoom).toBeCloseTo(2);
    expect(write.mock.calls[0][0]).toEqual(expect.objectContaining({ x: expect.closeTo(-200), y: expect.closeTo(-160) }));
  });
  it("preserves the cursor's world position and clamps zoom at the existing limits", () => {
    const original = { x: -100, y: -200, zoom: 0.5 }, point = { x: 320, y: 250 };
    const next = zoomAtPoint(original, point, 3, 0.005, 30);
    expect((point.x - next.x) / next.zoom).toBe((point.x - original.x) / original.zoom);
    expect((point.y - next.y) / next.zoom).toBe((point.y - original.y) / original.zoom);
    expect(zoomAtPoint(original, point, 100, 0.005, 30).zoom).toBe(30);
    expect(zoomAtPoint(original, point, -100, 0.005, 30).zoom).toBe(0.005);
  });
  it("ignores horizontal-only wheel events and cancels pending work on unmount", () => {
    const requestFrame = vi.fn(() => 7), cancelFrame = vi.fn();
    const zoom = createFrameWheelZoom({ read: () => ({ x: 0, y: 0, zoom: 1 }), write: vi.fn(),
      point: (x, y) => ({ x, y }), minZoom: 0.005, maxZoom: 30, requestFrame, cancelFrame });
    zoom.push({ deltaY: 0, deltaMode: 0, ctrlKey: false, clientX: 0, clientY: 0 });
    expect(requestFrame).not.toHaveBeenCalled();
    zoom.push({ deltaY: 20, deltaMode: 1, ctrlKey: false, clientX: 0, clientY: 0 });
    zoom.dispose(); expect(cancelFrame).toHaveBeenCalledWith(7);
  });
  it("keeps fields, internal scroll lists, minimap, and dialogs out of canvas wheel zoom", () => {
    for (const html of ['<textarea></textarea>', '<input type="range" />', '<div class="nowheel"><span></span></div>',
      '<div class="react-flow__minimap"><span></span></div>', '<div role="dialog"><span></span></div>']) {
      const host = document.createElement("div"); host.innerHTML = html;
      expect(isCanvasWheelTarget(host.querySelector("span") || host.firstElementChild)).toBe(false);
    }
    const pane = document.createElement("div"); pane.className = "react-flow__pane";
    expect(isCanvasWheelTarget(pane)).toBe(true);
  });
});
