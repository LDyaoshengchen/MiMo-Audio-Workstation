const STORAGE_KEY = "mimo_playback_restart_from_beginning";
let sessionValue = false;

export function getRestartPlayback(): boolean {
  try { const value = localStorage.getItem(STORAGE_KEY); return value === null ? sessionValue : value === "true"; }
  catch { return sessionValue; }
}

export function setRestartPlayback(enabled: boolean) {
  sessionValue = enabled;
  try { localStorage.setItem(STORAGE_KEY, String(enabled)); } catch { /* Keep usable for this session if storage is unavailable. */ }
}

/** Only call when starting playback, never when pausing or seeking. */
export function prepareAudioPlayback(audio: HTMLAudioElement): boolean {
  if (!getRestartPlayback()) return false;
  audio.currentTime = 0;
  return true;
}
