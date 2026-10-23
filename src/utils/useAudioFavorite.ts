import { useCallback, useSyncExternalStore } from "react";
import { voiceFavoriteStatus } from "./voiceFavoriteStatus";

export function useAudioFavorite(source: string) {
  const subscribe = useCallback((listener: () => void) => voiceFavoriteStatus.subscribe(source, listener), [source]);
  const snapshot = useCallback(() => voiceFavoriteStatus.get(source), [source]);
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
