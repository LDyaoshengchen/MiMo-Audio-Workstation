/**
 * 画板布局与网格排版核心算法
 */

export interface NodePosition {
  x: number;
  y: number;
}

export interface GridItemPosition {
  index: number;
  col: number;
  row: number;
  x: number;
  y: number;
}

/**
 * 计算 3 列产物网格中每个子项的坐标
 */
export function calculateArtifactGrid(
  count: number,
  startX: number,
  startY: number,
  maxCols = 3,
  itemW = 340,
  itemH = 145,
  colGap = 60,
  rowGap = 60
): GridItemPosition[] {
  return Array.from({ length: count }, (_, idx) => {
    const col = idx % maxCols;
    const row = Math.floor(idx / maxCols);
    return {
      index: idx,
      col,
      row,
      x: startX + col * (itemW + colGap),
      y: startY + row * (itemH + rowGap)
    };
  });
}

/**
 * 计算分支换列规则：每 5 个分支或高度累计超过 MAX_COL_HEIGHT 时换列
 */
export function calculateBranchColumns(
  branchHeights: number[],
  maxBranchesPerCol = 5,
  maxColHeight = 2200,
  branchGap = 50
): number[] {
  let currentCol = 0;
  let currentBranchesInCol = 0;
  let currentHeightInCol = 0;
  const colAllocations: number[] = [];

  for (let i = 0; i < branchHeights.length; i++) {
    const h = branchHeights[i];
    const isFirstInCol = currentBranchesInCol === 0;

    if (!isFirstInCol) {
      if (currentBranchesInCol >= maxBranchesPerCol || (currentHeightInCol > 0 && currentHeightInCol + h > maxColHeight)) {
        currentCol++;
        currentBranchesInCol = 0;
        currentHeightInCol = 0;
      }
    }

    colAllocations.push(currentCol);
    currentBranchesInCol++;
    currentHeightInCol += h + branchGap;
  }

  return colAllocations;
}
