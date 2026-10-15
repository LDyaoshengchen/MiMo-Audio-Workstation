// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { DeletableEdge } from "../src/components/canvas/DeletableEdge";

vi.mock("@xyflow/react", () => ({
  Position: { Right: "right", Left: "left" },
  useReactFlow: () => ({ screenToFlowPosition: (point: unknown) => point }),
  getBezierPath: () => ["M 0 0 L 300 200", 150, 100],
  BaseEdge: () => null,
  EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => children,
}));

it("keeps the disconnect button stationary and clickable across the SVG/portal boundary", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(() => callback(0), 16));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
  const host=document.createElement("div");document.body.append(host);const root=createRoot(host),remove=vi.fn();
  try {
    await act(async()=>root.render(<DeletableEdge {...({id:"edge-1",sourceX:0,sourceY:0,targetX:300,targetY:200,sourcePosition:"right",targetPosition:"left",data:{onDeleteEdge:remove}} as any)} />));
    const path=host.querySelector(".edge-hover-path")!;
    await act(async()=>path.dispatchEvent(new MouseEvent("mouseover",{bubbles:true,clientX:140,clientY:100})));
    const button=host.querySelector<HTMLButtonElement>(".edge-delete")!,position=button.style.transform;
    expect(button.classList.contains("nodrag")).toBe(true);
    await act(async()=>path.dispatchEvent(new MouseEvent("mouseout",{bubbles:true,relatedTarget:button})));
    await act(async()=>vi.advanceTimersByTime(100));
    expect(host.contains(button)).toBe(true);
    await act(async()=>button.dispatchEvent(new MouseEvent("mouseover",{bubbles:true,clientX:190,clientY:170})));
    await act(async()=>vi.advanceTimersByTime(200));
    expect(host.contains(button)).toBe(true);expect(button.style.transform).toBe(position);
    await act(async()=>{
      path.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,clientX:210,clientY:150}));
      path.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,clientX:250,clientY:180}));
    });
    expect(button.style.transform).toBe(position);
    await act(async()=>vi.advanceTimersByTime(16));
    expect(button.style.transform).not.toBe(position);
    const following=button.style.transform;
    await act(async()=>button.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,clientX:280,clientY:190})));
    await act(async()=>vi.advanceTimersByTime(16));
    expect(button.style.transform).not.toBe(following);
    const pressedPosition=button.style.transform;
    await act(async()=>button.dispatchEvent(new Event('pointerdown',{bubbles:true})));
    await act(async()=>button.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,clientX:100,clientY:50})));
    await act(async()=>vi.advanceTimersByTime(16));
    expect(button.style.transform).toBe(pressedPosition);
    await act(async()=>button.dispatchEvent(new Event('pointerup',{bubbles:true})));
    await act(async()=>button.click());expect(remove).toHaveBeenCalledExactlyOnceWith("edge-1");
    await act(async()=>button.dispatchEvent(new MouseEvent("mouseout",{bubbles:true})));
    await act(async()=>vi.advanceTimersByTime(200));
    expect(host.querySelector(".edge-delete")).toBeNull();
  } finally { await act(async()=>root.unmount());host.remove();vi.useRealTimers();vi.unstubAllGlobals(); }
});
