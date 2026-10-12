import type { AudioAsset } from "../types/studioAudio";

export const ROLE_AUDIO_MIME = "application/x-mimo-role-audio";
export const ROLE_AUDIO_DROPPED_EVENT = "mimo-role-audio-dropped";

export function readRoleAudioDrag(transfer: Pick<DataTransfer, "getData">): AudioAsset | null {
  try {
    const raw = transfer.getData(ROLE_AUDIO_MIME);
    if (!raw || raw.length > 11 * 1024 * 1024) return null;
    const audio = JSON.parse(raw) as AudioAsset;
    if (typeof audio.fileName !== "string" || !audio.fileName ||
      typeof audio.mimeType !== "string" || !audio.mimeType.startsWith("audio/") ||
      !Number.isFinite(audio.size) || audio.size < 0 || audio.size > 7.5 * 1024 * 1024 ||
      typeof audio.dataUrl !== "string" || !/^data:audio\/[\w.+-]+;base64,[A-Za-z0-9+/=]+$/.test(audio.dataUrl)) return null;
    return { fileName: audio.fileName, mimeType: audio.mimeType, size: audio.size, dataUrl: audio.dataUrl };
  } catch { return null; }
}
