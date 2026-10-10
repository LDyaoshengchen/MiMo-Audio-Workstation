import { useRef, useEffect } from "react";
import { useUpdateNodeInternals } from "@xyflow/react";

const pendingInternalUpdates = new Map<string, (id: string) => void>();

let updateInternalsRafId: number | null = null;

export function scheduleBatchNodeInternalsUpdate(id: string, updateFn: (id: string) => void) {
  pendingInternalUpdates.set(id, updateFn);
  if (updateInternalsRafId === null) {
    updateInternalsRafId = window.requestAnimationFrame(() => {
      updateInternalsRafId = null;
      const entries = Array.from(pendingInternalUpdates.entries());
      pendingInternalUpdates.clear();
      for (let i = 0; i < entries.length; i++) {
        const [nodeId, fn] = entries[i];
        fn(nodeId);
      }
    });
  }
}

export function useAutoUpdateNodeInternals(id: string, deps: unknown[] = []) {
  const updateNodeInternals = useUpdateNodeInternals();
  const lastHeightRef = useRef<number | null>(null);
  const isMountedRef = useRef(false);

  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }
    if (deps.length > 0) {
      scheduleBatchNodeInternalsUpdate(id, updateNodeInternals);
    }
  }, [id, updateNodeInternals, ...deps]);

  useEffect(() => {
    const el = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`);
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const currentHeight = Math.round(entry.contentRect.height);
        if (lastHeightRef.current === null) {
          lastHeightRef.current = currentHeight;
          return;
        }
        if (Math.abs(currentHeight - lastHeightRef.current) >= 2) {
          lastHeightRef.current = currentHeight;
          scheduleBatchNodeInternalsUpdate(id, updateNodeInternals);
        }
      }
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
    };
  }, [id, updateNodeInternals]);
}

export function getElementTopInNode(element: HTMLElement | null): number | null {
  if (!element) return null;
  const nodeEl = element.closest<HTMLElement>(".studio-node");
  if (!nodeEl) return null;
  let top = element.offsetHeight / 2;
  let current: HTMLElement | null = element;
  while (current && current !== nodeEl) {
    top += current.offsetTop;
    current = current.offsetParent as HTMLElement | null;
  }
  return Math.round(top);
}
