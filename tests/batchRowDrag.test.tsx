// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { BatchVoiceCloneNode } from "../src/components/nodes/BatchVoiceCloneNode";
import { BatchVoiceDesignNode } from "../src/components/nodes/BatchVoiceDesignNode";

vi.mock("../src/studio/nodeInternals", () => ({ useAutoUpdateNodeInternals: vi.fn() }));
vi.mock("@xyflow/react", () => ({ Handle: () => null, Position: { Left: "left", Right: "right" } }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(() => vi.clearAllMocks());

describe.each([BatchVoiceCloneNode, BatchVoiceDesignNode])("batch row editing and ordering", Component => {
  it("keeps text selection separate from handle-only sorting", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const patch = vi.fn();
    const rows = [0, 1].map(index => ({ id: `row-${index}`, title: `VO_000${index}`, instruction: "Warm", text: "Hello" }));
    const transfer = { setData: vi.fn(), getData: () => "0", effectAllowed: "", dropEffect: "" };
    const drag = async (element: Element, type: string) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, "dataTransfer", { value: transfer });
      await act(async () => element.dispatchEvent(event));
    };
    try {
      await act(async () => root.render(<Component {...({ id: "batch", data: { title: "Batch", batchRows: rows, onPatch: patch } } as any)} />));
      const cards = host.querySelectorAll<HTMLElement>(".batch-row-card");
      const input = cards[0].querySelector<HTMLInputElement>(".batch-row-title-input")!;
      expect(cards[0].draggable).toBe(false);
      expect(input.draggable).toBe(false);
      input.focus(); input.setSelectionRange(0, 4);
      expect(input.value.slice(input.selectionStart!, input.selectionEnd!)).toBe("VO_0");
      await drag(input, "dragstart");
      await drag(cards[1], "drop");
      expect(transfer.setData).not.toHaveBeenCalled();
      expect(patch).not.toHaveBeenCalled();
      expect(host.querySelector(".is-dragging")).toBeNull();
      const handle = cards[0].querySelector<HTMLElement>(".batch-row-drag-handle")!;
      expect(handle.draggable).toBe(true);
      await drag(handle, "dragstart");
      expect(host.querySelector(".is-dragging")).not.toBeNull();
      await drag(cards[1], "drop");
      expect(patch).toHaveBeenCalledWith("batch", { batchRows: [rows[1], rows[0]] });
      expect(host.querySelector(".is-dragging")).toBeNull();
    } finally {
      await act(async () => root.unmount()); host.remove();
    }
  });
});
