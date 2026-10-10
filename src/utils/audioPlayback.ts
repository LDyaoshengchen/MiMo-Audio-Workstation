let activeAudio: HTMLAudioElement | null = null;

/** Shared by the canvas player and the stash player: only one clip plays at a time. */
export function activateAudio(audio: HTMLAudioElement) {
  if (activeAudio && activeAudio !== audio) activeAudio.pause();
  activeAudio = audio;
}

export function releaseAudio(audio: HTMLAudioElement) {
  if (activeAudio === audio) activeAudio = null;
}

export function formatAudioTime(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0:00";
  return `${Math.floor(value / 60)}:${Math.floor(value % 60).toString().padStart(2, "0")}`;
}
