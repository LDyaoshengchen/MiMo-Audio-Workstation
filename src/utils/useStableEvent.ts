import { useCallback, useLayoutEffect, useRef } from "react";

/** Stable identity for memoized children, with the latest committed handler (no stale closures). */
export function useStableEvent<Args extends unknown[], Result>(handler: (...args: Args) => Result) {
  const latest = useRef(handler);
  useLayoutEffect(() => { latest.current = handler; });
  return useCallback((...args: Args) => latest.current(...args), []);
}
