type Entry = { listeners: Set<() => void>; value: boolean; known: boolean; key?: Promise<string | undefined> };

export async function favoriteAudioKey(source: string): Promise<string | undefined> {
  if (/^\/api\/audio-cache\/[^?#]+$/.test(source)) return source;
  const encoded = source.match(/^data:audio\/[^;,]+;base64,([A-Za-z0-9+/=\s]+)$/)?.[1];
  if (!encoded || !globalThis.crypto?.subtle) return;
  try {
    const bytes = Uint8Array.from(atob(encoded.replace(/\s/g, "")), character => character.charCodeAt(0));
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    return `sha256:${Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("")}`;
  } catch { return; }
}

export class VoiceFavoriteStatusStore {
  private entries = new Map<string, Entry>();
  private pending = new Set<string>();
  private timer?: ReturnType<typeof setTimeout>;
  private generation = 0;
  private onFocus = () => this.refresh();

  get(source: string) { return this.entries.get(source)?.value || false; }
  subscribe(source: string, listener: () => void) {
    if (!source) return () => {};
    let entry = this.entries.get(source);
    if (!entry) { entry = { listeners: new Set(), value: false, known: false }; this.entries.set(source, entry); }
    entry.listeners.add(listener);
    if (!entry.known) this.schedule(source);
    if (typeof window !== "undefined") window.addEventListener("focus", this.onFocus);
    return () => {
      entry!.listeners.delete(listener);
      if (!entry!.listeners.size) { this.entries.delete(source); this.pending.delete(source); }
      if (!this.entries.size && typeof window !== "undefined") window.removeEventListener("focus", this.onFocus);
    };
  }
  refresh() {
    this.generation++;
    for (const [source, entry] of this.entries) { entry.known = false; this.schedule(source); }
  }
  private schedule(source: string) {
    this.pending.add(source);
    if (!this.timer) this.timer = setTimeout(() => { this.timer = undefined; void this.flush(); }, 20);
  }
  private async flush() {
    const generation = this.generation, sources = [...this.pending]; this.pending.clear();
    const groups = new Map<string, { source: string; entry: Entry }[]>();
    await Promise.all(sources.map(async source => {
      const entry = this.entries.get(source); if (!entry) return;
      entry.key ||= favoriteAudioKey(source);
      const key = await entry.key; if (!key || this.entries.get(source) !== entry) return;
      groups.set(key, [...(groups.get(key) || []), { source, entry }]);
    }));
    if (generation !== this.generation) return;
    const keys = [...groups.keys()];
    while (keys.length) {
      const batch: string[] = [];
      while (keys.length && batch.length < 32) {
        if (batch.length && encodeURIComponent(JSON.stringify([...batch, keys[0]])).length > 7000) break;
        batch.push(keys.shift()!);
      }
      try {
        const response = await fetch(`/api/voice-library/favorite-status?sources=${encodeURIComponent(JSON.stringify(batch))}`, { cache: "no-store" });
        if (!response.ok) continue;
        const result = await response.json();
        if (generation !== this.generation || !Array.isArray(result) || result.length !== batch.length || result.some(value => typeof value !== "boolean")) continue;
        batch.forEach((key, index) => {
          for (const { source, entry } of groups.get(key) || []) {
            if (this.entries.get(source) !== entry) continue;
            entry.known = true;
            if (entry.value !== result[index]) { entry.value = result[index]; entry.listeners.forEach(listener => listener()); }
          }
        });
      } catch { /* Keep the last known state; the next library operation/focus refresh retries. */ }
    }
  }
}

export const voiceFavoriteStatus = new VoiceFavoriteStatusStore();
