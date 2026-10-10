import { useCallback, useEffect, useRef, type RefObject } from "react";
import { createFrameWheelZoom, isCanvasWheelTarget, type ZoomViewport } from "./frameWheelZoom";

export function useSmoothCanvasZoom(rootRef: RefObject<HTMLDivElement | null>, flowRef: RefObject<{
  getViewport: () => ZoomViewport; setViewport: (viewport: ZoomViewport, options: { duration: number }) => Promise<boolean>;
} | null>, boardId?: string) {
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detail = useCallback((_event: unknown, viewport: ZoomViewport) => {
    const root = rootRef.current;
    const overview = viewport.zoom < 0.35;
    if (root && root.classList.contains("is-canvas-overview") !== overview) root.classList.toggle("is-canvas-overview", overview);
  }, [rootRef]);
  const begin = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    const root = rootRef.current;
    if (root && !root.classList.contains("is-viewport-moving")) root.classList.add("is-viewport-moving");
  }, [rootRef]);
  const end = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => rootRef.current?.classList.remove("is-viewport-moving"), 180);
  }, [rootRef]);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (flowRef.current) detail(null, flowRef.current.getViewport());
    const zoom = createFrameWheelZoom({
      read: () => flowRef.current?.getViewport() || { x: 0, y: 0, zoom: 1 },
      write: viewport => { if (flowRef.current) void flowRef.current.setViewport(viewport, { duration: 0 }); },
      point: (x, y) => { const bounds = root.getBoundingClientRect(); return { x: x - bounds.left, y: y - bounds.top }; },
      requestFrame: callback => window.requestAnimationFrame(callback),
      cancelFrame: id => window.cancelAnimationFrame(id),
      minZoom: 0.005, maxZoom: 30, isMac: /Mac/i.test(navigator.platform),
    });
    const wheel = (event: WheelEvent) => {
      if (!flowRef.current || event.defaultPrevented || !isCanvasWheelTarget(event.target) || event.deltaY === 0) return;
      event.preventDefault();
      // Capture phase prevents the built-in pinch wheel handler applying a second transform.
      event.stopPropagation();
      begin(); zoom.push(event); end();
    };
    root.addEventListener("wheel", wheel, { passive: false, capture: true });
    return () => {
      root.removeEventListener("wheel", wheel, true); zoom.dispose();
      if (idleTimer.current) clearTimeout(idleTimer.current);
      root.classList.remove("is-viewport-moving", "is-canvas-overview");
    };
  }, [boardId, rootRef, flowRef, begin, end, detail]);
  return { begin, end, detail };
}
