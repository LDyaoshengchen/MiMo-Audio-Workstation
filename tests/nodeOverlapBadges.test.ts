import { describe, expect, it } from "vitest";
import { getNodeOverlapBadges, type OverlapRect } from "../src/utils/nodeOverlapBadges";
const rect = (id: string, x = 0, y = 0, type = "clone"): OverlapRect => ({ id, x, y, type, width: 100, height: 100 });
describe("minimap same-type overlap counts", () => {
  it("labels two and three stacked cards once at their overlap center", () => {
    expect(getNodeOverlapBadges([rect("a"), rect("b")])).toEqual([{ ids: ["a", "b"], count: 2, x: 50, y: 50 }]);
    expect(getNodeOverlapBadges([rect("a"), rect("b", 10, 10), rect("c", 20, 20)])).toEqual([{ ids: ["a", "b", "c"], count: 3, x: 60, y: 60 }]);
  });
  it("ignores different types, touching edges, separated cards, and unmeasured cards", () => {
    expect(getNodeOverlapBadges([rect("a"), rect("b", 0, 0, "design"), rect("c", 100), { ...rect("d"), width: 0 }])).toEqual([]);
  });
  it("does not falsely report three when only adjacent pairs intersect", () => {
    const result = getNodeOverlapBadges([rect("a"), rect("b", 70), rect("c", 140)]);
    expect(result.map(b => b.count)).toEqual([2, 2]);
    expect(result.map(b => b.x)).toEqual([85, 155]);
  });
  it("removes counts when a node moves away and handles large identical stacks", () => {
    expect(getNodeOverlapBadges([rect("a"), rect("b", 200)])).toEqual([]);
    expect(getNodeOverlapBadges(Array.from({ length: 500 }, (_, i) => rect(String(i))))).toHaveLength(1);
    expect(getNodeOverlapBadges(Array.from({ length: 500 }, (_, i) => rect(String(i))))[0].count).toBe(500);
  });
});
