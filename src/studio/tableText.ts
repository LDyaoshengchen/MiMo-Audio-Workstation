

export function parseTableText(text: string): string[][] {
  if (!text.trim()) return [];

  const isTabSeparated = text.includes("\t");

  if (isTabSeparated) {
    const grid: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentCell += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === '\t' && !inQuotes) {
        currentRow.push(currentCell.trim());
        currentCell = "";
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        currentRow.push(currentCell.trim());
        if (currentRow.some((cell) => cell.length > 0)) {
          grid.push(currentRow);
        }
        currentRow = [];
        currentCell = "";
      } else {
        currentCell += char;
      }
    }
    if (currentCell || currentRow.length > 0) {
      currentRow.push(currentCell.trim());
      if (currentRow.some((cell) => cell.length > 0)) {
        grid.push(currentRow);
      }
    }
    return grid;
  } else {
    const lines = text.split(/\r?\n/);
    const grid: string[][] = [];

    for (const line of lines) {
      if (!line.trim()) continue;
      if (line.includes(",")) {
        const cells: string[] = [];
        let cell = "";
        let inQ = false;
        for (let i = 0; i < line.length; i++) {
          const c = line[i];
          if (c === '"') {
            inQ = !inQ;
          } else if (c === ',' && !inQ) {
            cells.push(cell.trim());
            cell = "";
          } else {
            cell += c;
          }
        }
        cells.push(cell.trim());
        if (cells.some((c) => c.length > 0)) {
          grid.push(cells);
        }
      } else {
        grid.push([line.trim()]);
      }
    }
    return grid;
  }
}
