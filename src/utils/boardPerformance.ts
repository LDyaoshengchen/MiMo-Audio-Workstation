import { formatHierarchyName } from "./audioNaming";

export function identityMemo<T extends object, R>(compute: (value: T) => R) {
  const cache = new WeakMap<T, R>();
  return (value: T): R => {
    if (cache.has(value)) return cache.get(value)!;
    const result = compute(value);
    cache.set(value, result);
    return result;
  };
}

export function pruneMap<T>(cache: Map<string, T>, ids: Iterable<string>) {
  const live = new Set(ids);
  for (const id of cache.keys()) if (!live.has(id)) cache.delete(id);
}

type NameRow = { id: string; title: string; artifacts?: { audioDataUrl: string; seqIndex?: number }[] };
type NameNode = { id: string; type?: string; data: { title: string; batchRows?: NameRow[] } };

/** Positions, selection, and drag state do not invalidate artifact names. */
export class IntegratedNameIndex {
  private entries = new Map<string, { title: string; rows: NameRow[] | undefined; names: Map<string, string> }>();
  private result = new Map<string, string>();
  constructor(private format = formatHierarchyName) {}
  update(nodes: readonly NameNode[]) {
    const live = new Set<string>();
    let changed = false;
    for (const node of nodes) {
      if (node.type !== "integratedStudio") continue;
      live.add(node.id);
      const old = this.entries.get(node.id);
      const { title, batchRows: rows } = node.data;
      if (old?.title === title && old?.rows === rows) continue;
      const names = new Map<string, string>();
      for (const row of rows || []) {
        (row.artifacts || []).forEach((art, index) => {
          names.set(JSON.stringify([node.id, row.id, art.audioDataUrl]), this.format(title, row.title || "句段", art.seqIndex ?? index + 1));
        });
      }
      this.entries.set(node.id, { title, rows, names });
      changed = true;
    }
    for (const id of this.entries.keys()) {
      if (!live.has(id)) { this.entries.delete(id); changed = true; }
    }
    if (changed) {
      this.result = new Map();
      for (const entry of this.entries.values()) for (const [key, name] of entry.names) this.result.set(key, name);
    }
    return this.result;
  }
}
