// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { WindowedList } from "../src/components/WindowedList";

describe("large lists mount only visible rows without interrupting interaction", () => {
  let root: Root;
  let host: HTMLDivElement;
  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
  const items = (count: number) => Array.from({ length: count }, (_, i) => ({ id: `item-${i}` }));
  const row = (item: { id: string }, index: number) => <div data-index={index}>
    <input aria-label={item.id} defaultValue={item.id} /><audio src={`${item.id}.wav`} />
  </div>;
  const key = (item: { id: string }) => item.id;
  async function scroll(top: number) {
    const list = host.firstElementChild as HTMLElement;
    await act(async () => { list.scrollTop = top; list.dispatchEvent(new Event("scroll", { bubbles: true })); });
  }
  it.each([100, 300, 500])("bounds DOM mounting and reaches the end of %i rows", async count => {
    await act(async () => root.render(<WindowedList items={items(count)} itemKey={key} renderItem={row} estimatedHeight={100} maxHeight={300} />));
    expect(host.querySelectorAll("input").length).toBeLessThanOrEqual(9);
    expect(host.querySelector('[data-index="0"]')).not.toBeNull();
    await scroll(count * 100);
    expect(host.querySelector(`[data-index="${count - 1}"]`)).not.toBeNull();
    expect(host.querySelector('[data-index="0"]')).toBeNull();
    expect(host.querySelectorAll("audio").length).toBeLessThanOrEqual(9);
  });
  it("keeps focused edits and playing audio mounted while scrolling", async () => {
    await act(async () => root.render(<WindowedList items={items(100)} itemKey={key} renderItem={row} estimatedHeight={100} maxHeight={300} />));
    const input = host.querySelector("input")!;
    await act(async () => input.focus());
    input.value = "unsaved input";
    await scroll(9000);
    expect(host.querySelector('[aria-label="item-0"]')).toBe(input);
    expect(input.value).toBe("unsaved input");
    await act(async () => input.blur());
    expect(host.querySelector('[data-index="0"]')).toBeNull();
    await scroll(0);
    const audio = host.querySelector("audio")!;
    await act(async () => audio.dispatchEvent(new Event("play")));
    await scroll(9000);
    expect(host.contains(audio)).toBe(true);
    await act(async () => audio.dispatchEvent(new Event("pause")));
    expect(host.contains(audio)).toBe(false);
  });
  it("retains external recording pins and follows only newly appended artifacts", async () => {
    const render = (count: number, pinned = ["item-0"]) => <WindowedList items={items(count)} itemKey={key} renderItem={row}
      estimatedHeight={100} maxHeight={300} pinnedKeys={pinned} followAppend />;
    await act(async () => root.render(render(100)));
    expect((host.firstElementChild as HTMLElement).scrollTop).toBe(0);
    await scroll(9000);
    expect(host.querySelector('[data-index="0"]')).not.toBeNull();
    await act(async () => root.render(render(100, [])));
    expect(host.querySelector('[data-index="0"]')).toBeNull();
    await act(async () => root.render(render(101, [])));
    expect(host.querySelector('[data-index="100"]')).not.toBeNull();
    await act(async () => root.render(render(2, [])));
    expect(host.querySelectorAll("input")).toHaveLength(2);
    expect((host.firstElementChild as HTMLElement).scrollTop).toBe(0);
  });
  it("pins the correct outer row when an inner list plays audio", async () => {
    const nested = (item: { id: string }, index: number) => <div data-index={index}>
      <WindowedList items={[{ id: `audio-${item.id}` }]} itemKey={key} renderItem={inner => <audio src={`${inner.id}.wav`} />}
        estimatedHeight={100} maxHeight={100} />
    </div>;
    await act(async () => root.render(<WindowedList items={items(100)} itemKey={key} renderItem={nested} estimatedHeight={100} maxHeight={300} />));
    const audio = host.querySelector("audio")!;
    await act(async () => audio.dispatchEvent(new Event("play")));
    await scroll(9000);
    expect(host.contains(audio)).toBe(true);
    await act(async () => audio.dispatchEvent(new Event("ended")));
    expect(host.contains(audio)).toBe(false);
  });
  it("uses unscaled element heights and preserves the scroll anchor when an earlier pinned row resizes", async () => {
    const observers = new Map<Element, () => void>();
    vi.stubGlobal("ResizeObserver", class {
      private elements: Element[] = [];
      constructor(private callback: () => void) {}
      observe(element: Element) { this.elements.push(element); observers.set(element, this.callback); }
      disconnect() { for (const element of this.elements) observers.delete(element); }
    });
    await act(async () => root.render(<WindowedList items={items(100)} itemKey={key} renderItem={row}
      estimatedHeight={100} maxHeight={300} pinnedKeys={["item-0"]} />));
    await scroll(2000);
    const pinned = host.querySelector('[data-window-key="item-0"]')!;
    Object.defineProperty(pinned, "offsetHeight", { value: 200, configurable: true });
    // A CSS transform may scale getBoundingClientRect(), but offsetHeight remains in local CSS pixels.
    await act(async () => observers.get(pinned)!());
    expect((host.firstElementChild as HTMLElement).scrollTop).toBe(2100);
    expect(host.querySelector('[data-index="20"]')).not.toBeNull();
  });
});
