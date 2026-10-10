import { describe, expect, it, vi } from "vitest";
import { identityMemo, IntegratedNameIndex, pruneMap } from "../src/utils/boardPerformance";
import { getWindowLayout } from "../src/utils/windowedList";

describe("large board incremental calculations", () => {
  it.each([100, 300, 500])("does not rebuild artifact names during 60 drag updates on %i nodes", count => {
    const format = vi.fn((parent: string | undefined, row: string, seq: number) => `${parent}_${row}_${seq}`);
    const index = new IntegratedNameIndex(format);
    const nodes = Array.from({ length: count }, (_, i) => ({
      id: `node-${i}`, type: "integratedStudio", position: { x: i, y: 0 },
      data: { title: "战斗", batchRows: [{ id: `row-${i}`, title: `VO_${i}`, artifacts: [{ audioDataUrl: `/api/audio-cache/${i}.wav` }] }] },
    }));
    const first = index.update(nodes);
    expect(format).toHaveBeenCalledTimes(count);
    for (let step = 1; step <= 60; step++) {
      const dragged = nodes.map(node => ({ ...node, position: { x: step, y: step }, dragging: true }));
      expect(index.update(dragged)).toBe(first);
    }
    expect(format).toHaveBeenCalledTimes(count);
    const renamed = nodes.map((node, i) => i === 0 ? { ...node, data: { ...node.data, title: "首领" } } : node);
    expect(index.update(renamed).get(JSON.stringify(["node-0", "row-0", "/api/audio-cache/0.wav"]))).toBe("首领_VO_0_1");
    expect(format).toHaveBeenCalledTimes(count + 1);
    const removed = index.update(renamed.slice(1));
    expect(removed.size).toBe(count - 1);
    expect(index.update([]).size).toBe(0);
  });
  it("reuses data digests, invalidates immutable edits, and releases deleted cache entries", () => {
    const compute = vi.fn((data: { text: string }) => data.text);
    const digest = identityMemo(compute);
    const data = { text: "Hello" };
    for (let frame = 0; frame < 100; frame++) expect(digest(data)).toBe("Hello");
    expect(compute).toHaveBeenCalledTimes(1);
    expect(digest({ ...data, text: "New" })).toBe("New");
    expect(compute).toHaveBeenCalledTimes(2);
    const cache = new Map([["alive", data], ["deleted", data]]);
    pruneMap(cache, ["alive"]);
    expect([...cache.keys()]).toEqual(["alive"]);
    pruneMap(cache, []);
    expect(cache.size).toBe(0);
  });
});

describe("measured list windows", () => {
  it("handles changed heights, far-away pinned rows, empty and shortened lists", () => {
    const keys = Array.from({ length: 500 }, (_, i) => `row-${i}`);
    const layout = getWindowLayout(keys, new Map([["row-0", 600]]), 100, 600, 200, ["row-499"], 0);
    expect(layout.offsets[1]).toBe(600);
    expect(layout.indices).toEqual([1, 2, 499]);
    expect(layout.total).toBe(50500);
    expect(getWindowLayout(keys.slice(0, 3), new Map(), 100, 99999, 200, [], 0).indices).toEqual([1, 2]);
    expect(getWindowLayout([], new Map(), 100, 0, 200)).toEqual({ offsets: [0], total: 0, indices: [] });
  });
});
