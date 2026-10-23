export type MigrationProgress = { phase: "scanning" | "copying" | "committing"; totalFiles: number; processedFiles: number; totalBytes: number; processedBytes: number };

export function createStorageMigrationStatus(now = Date.now) {
  let state = { running: false, phase: "idle" as string, startedAt: 0, updatedAt: 0, totalFiles: 0, processedFiles: 0, totalBytes: 0, processedBytes: 0, remainingSeconds: null as number | null, error: "" };
  return {
    start() { state = { running: true, phase: "scanning", startedAt: now(), updatedAt: now(), totalFiles: 0, processedFiles: 0, totalBytes: 0, processedBytes: 0, remainingSeconds: null, error: "" }; },
    update(progress: MigrationProgress) {
      const elapsed = (now() - state.startedAt) / 1000;
      const done = progress.processedBytes + progress.processedFiles * 65536;
      const total = progress.totalBytes + progress.totalFiles * 65536;
      const remainingSeconds = progress.phase === "copying" && done > 0 && elapsed > 0 ? Math.max(1, Math.ceil(elapsed * Math.max(0, total - done) / done)) : null;
      state = { ...state, ...progress, updatedAt: now(), remainingSeconds };
    },
    finish(error = "") { state = { ...state, running: false, phase: error ? "failed" : "completed", updatedAt: now(), remainingSeconds: error ? null : 0, error }; },
    snapshot() { return { ...state, remainingSeconds: state.running && state.remainingSeconds !== null ? Math.max(1, state.remainingSeconds - Math.floor((now() - state.updatedAt) / 1000)) : state.remainingSeconds }; },
  };
}
