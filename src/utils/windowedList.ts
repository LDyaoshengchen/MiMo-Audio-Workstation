export function getWindowLayout(keys: readonly string[], heights: ReadonlyMap<string, number>, estimate: number,
  scrollTop: number, viewportHeight: number, pinned: readonly string[] = [], overscan = 300) {
  const offsets = [0];
  for (const key of keys) offsets.push(offsets[offsets.length - 1] + (heights.get(key) || estimate));
  const total = offsets[offsets.length - 1];
  const top = Math.max(0, Math.min(scrollTop, Math.max(0, total - viewportHeight)) - overscan);
  const bottom = Math.min(total, top + viewportHeight + overscan * 2);
  const indices: number[] = [];
  const pinSet = new Set(pinned);
  for (let i = 0; i < keys.length; i++) {
    if ((offsets[i + 1] > top && offsets[i] < bottom) || pinSet.has(keys[i])) indices.push(i);
  }
  return { offsets, total, indices };
}
