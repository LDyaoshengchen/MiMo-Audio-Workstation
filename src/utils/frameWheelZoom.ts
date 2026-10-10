export type ZoomViewport = { x: number; y: number; zoom: number };

export function zoomAtPoint(viewport: ZoomViewport, point: { x: number; y: number }, exponent: number,
  minZoom: number, maxZoom: number): ZoomViewport {
  const zoom = Math.min(maxZoom, Math.max(minZoom, viewport.zoom * 2 ** exponent));
  const ratio = zoom / viewport.zoom;
  return { x: point.x - (point.x - viewport.x) * ratio, y: point.y - (point.y - viewport.y) * ratio, zoom };
}

/** One viewport transform per frame, even when a mouse produces hundreds of wheel events. */
export function createFrameWheelZoom(options: {
  read: () => ZoomViewport; write: (viewport: ZoomViewport) => void;
  point: (clientX: number, clientY: number) => { x: number; y: number };
  requestFrame: (callback: FrameRequestCallback) => number; cancelFrame: (id: number) => void;
  minZoom: number; maxZoom: number; isMac?: boolean;
}) {
  let frame: number | null = null;
  let exponent = 0, clientX = 0, clientY = 0;
  return {
    push(event: Pick<WheelEvent, "deltaY" | "deltaMode" | "ctrlKey" | "clientX" | "clientY">) {
      if (!Number.isFinite(event.deltaY) || event.deltaY === 0) return;
      exponent += -event.deltaY * (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002)
        * (event.ctrlKey && options.isMac ? 10 : 1);
      clientX = event.clientX; clientY = event.clientY;
      if (frame !== null) return;
      frame = options.requestFrame(() => {
        frame = null;
        const delta = exponent; exponent = 0;
        const previous = options.read();
        const next = zoomAtPoint(previous, options.point(clientX, clientY), Math.max(-20, Math.min(20, delta)), options.minZoom, options.maxZoom);
        if (next.zoom !== previous.zoom) options.write(next);
      });
    },
    dispose() { if (frame !== null) options.cancelFrame(frame); frame = null; exponent = 0; },
  };
}

export function isCanvasWheelTarget(target: EventTarget | null) {
  return target instanceof Element && !target.closest(
    '.nowheel, .react-flow__minimap, .react-flow__controls, input, textarea, select, [contenteditable="true"], [role="dialog"]'
  );
}
