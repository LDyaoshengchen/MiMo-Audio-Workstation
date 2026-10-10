export interface OverlapRect { id: string; type: string; x: number; y: number; width: number; height: number; }
export interface OverlapBadge { ids: string[]; x: number; y: number; count: number; }

/** Sweep real intersections, not connected groups: a chain of three is not a triple stack. */
export function getNodeOverlapBadges(rects: OverlapRect[]): OverlapBadge[] {
  const types = new Map<string, OverlapRect[]>();
  for (const rect of rects) {
    if (![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) || rect.width <= 0 || rect.height <= 0) continue;
    const group = types.get(rect.type) || []; group.push(rect); types.set(rect.type, group);
  }
  const regions = new Map<string, OverlapBadge & { area: number }>();
  for (const group of types.values()) {
    const events = group.flatMap(rect => [{ x: rect.x, rect, add: true }, { x: rect.x + rect.width, rect, add: false }]).sort((a, b) => a.x - b.x);
    const active = new Map<string, OverlapRect>();
    for (let i = 0; i < events.length;) {
      const x = events[i].x;
      while (i < events.length && events[i].x === x) { const e = events[i++]; if (e.add) active.set(e.rect.id, e.rect); else active.delete(e.rect.id); }
      const right = events[i]?.x;
      if (active.size < 2 || right === undefined || right <= x) continue;
      const ys = [...active.values()].flatMap(rect => [{ y: rect.y, id: rect.id, add: true }, { y: rect.y + rect.height, id: rect.id, add: false }]).sort((a, b) => a.y - b.y);
      const covering = new Set<string>();
      for (let j = 0; j < ys.length;) {
        const y = ys[j].y;
        while (j < ys.length && ys[j].y === y) { const e = ys[j++]; if (e.add) covering.add(e.id); else covering.delete(e.id); }
        const bottom = ys[j]?.y;
        if (covering.size < 2 || bottom === undefined || bottom <= y) continue;
        const ids = [...covering].sort(), key = JSON.stringify(ids), area = (right - x) * (bottom - y);
        if (area > (regions.get(key)?.area || 0)) regions.set(key, { ids, count: ids.length, x: (x + right) / 2, y: (y + bottom) / 2, area });
      }
    }
  }
  const badges = [...regions.values()].sort((a, b) => b.count - a.count || b.area - a.area);
  // A triple stack gets one "3", not surrounding redundant pair labels.
  const maximal: typeof badges = [];
  for (const badge of badges) if (!maximal.some(other => badge.ids.every(id => other.ids.includes(id)))) maximal.push(badge);
  return maximal.map(({ area: _area, ...badge }) => badge);
}
