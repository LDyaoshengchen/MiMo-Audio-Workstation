import { describe, it, expect } from "vitest";
import { calculateArtifactGrid, calculateBranchColumns } from "../src/utils/layout.js";

describe("Tidy & Pipeline Tree Layout Algorithm (生产算法真实测试)", () => {
  it("should arrange artifact grid in 3-column rows", () => {
    const maxCols = 3;
    const itemW = 340;
    const itemH = 145;
    const colGap = 60;
    const rowGap = 60;
    const startX = 400;
    const startY = 80;

    const positions = calculateArtifactGrid(7, startX, startY, maxCols, itemW, itemH, colGap, rowGap);

    // Row 0 (3 items)
    expect(positions[0]).toMatchObject({ x: 400, y: 80, col: 0, row: 0 });
    expect(positions[1]).toMatchObject({ x: 800, y: 80, col: 1, row: 0 });
    expect(positions[2]).toMatchObject({ x: 1200, y: 80, col: 2, row: 0 });

    // Row 1 (3 items)
    expect(positions[3]).toMatchObject({ x: 400, y: 285, col: 0, row: 1 });
    expect(positions[4]).toMatchObject({ x: 800, y: 285, col: 1, row: 1 });
    expect(positions[5]).toMatchObject({ x: 1200, y: 285, col: 2, row: 1 });

    // Row 2 (1 item)
    expect(positions[6]).toMatchObject({ x: 400, y: 490, col: 0, row: 2 });
  });

  it("should trigger column wrap after 5 workflow branches", () => {
    const branchHeights = Array(12).fill(200); // 12 equal small branches
    const columnAssignments = calculateBranchColumns(branchHeights, 5, 2200);

    // Branches 0~4 in Column 0
    expect(columnAssignments.slice(0, 5)).toEqual([0, 0, 0, 0, 0]);
    // Branches 5~9 in Column 1
    expect(columnAssignments.slice(5, 10)).toEqual([1, 1, 1, 1, 1]);
    // Branches 10~11 in Column 2
    expect(columnAssignments.slice(10, 12)).toEqual([2, 2]);
  });

  it("should trigger column wrap early when column height exceeds threshold", () => {
    const branchHeights = [1200, 1100, 500, 400]; // 1200 + 1100 = 2300 >= 2200 -> wraps at index 1
    const colAllocations = calculateBranchColumns(branchHeights, 5, 2200, 50);

    expect(colAllocations[0]).toBe(0);
    expect(colAllocations[1]).toBe(1);
    expect(colAllocations[2]).toBe(1);
    expect(colAllocations[3]).toBe(1);
  });
});
