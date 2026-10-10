

export function splitScriptInput(script: string): string[] {
  return script
    .split(/\n?\s*----\s*\n?/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function formatDateForFile(date: Date): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

export function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function formatTime(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "0:00";
  }

  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
