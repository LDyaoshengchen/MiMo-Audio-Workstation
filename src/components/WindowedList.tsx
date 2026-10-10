import { Fragment, useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getWindowLayout } from "../utils/windowedList";
import { pruneMap } from "../utils/boardPerformance";

function MeasuredItem({ itemKey, onHeight, children, gap }: {
  itemKey: string; onHeight: (key: string, height: number) => void; children: ReactNode; gap: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = ref.current!;
    const measure = () => { if (element.offsetHeight > 0) onHeight(itemKey, element.offsetHeight); };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [itemKey, onHeight]);
  return <div ref={ref} data-window-key={itemKey} style={{ paddingBottom: gap, flexShrink: 0 }}>{children}</div>;
}

/** Measured CSS-pixel heights work under React Flow zoom. Only visible/heavy rows mount. */
export function WindowedList<T>({ items, itemKey, renderItem, className, estimatedHeight, gap = 0,
  pinnedKeys = [], followAppend = false, maxHeight, threshold = 12 }: {
  items: readonly T[]; itemKey: (item: T) => string; renderItem: (item: T, index: number) => ReactNode;
  className?: string; estimatedHeight: number; gap?: number; pinnedKeys?: readonly string[];
  followAppend?: boolean; maxHeight?: number; threshold?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const heights = useRef(new Map<string, number>());
  const previousCount = useRef(items.length);
  const [viewport, setViewport] = useState({ top: 0, height: maxHeight || 1400 });
  const [revision, setRevision] = useState(0);
  const [focused, setFocused] = useState<string | null>(null);
  const [playingKeys, setPlayingKeys] = useState<string[]>([]);
  const playing = useRef(new Map<HTMLMediaElement, string>());
  const keys = useMemo(() => items.map(itemKey), [items, itemKey]);
  const virtual = items.length > threshold;
  const layout = useMemo(() => getWindowLayout(keys, heights.current, estimatedHeight + gap,
    viewport.top, viewport.height, [...pinnedKeys, ...playingKeys, ...(focused ? [focused] : [])]),
  [keys, estimatedHeight, gap, viewport, pinnedKeys, playingKeys, focused, revision]);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const keysRef = useRef(keys);
  keysRef.current = keys;
  const anchorDelta = useRef(0);
  const onHeight = useCallback((key: string, height: number) => {
    const old = heights.current.get(key);
    if (old === height) return;
    const index = keysRef.current.indexOf(key);
    if (index >= 0 && ref.current && layoutRef.current.offsets[index + 1] <= ref.current.scrollTop) {
      // A pinned/overscanned row changing height above the viewport must not shift what the user is reading.
      anchorDelta.current += height - (old || estimatedHeight + gap);
    }
    heights.current.set(key, height);
    setRevision(value => value + 1);
  }, [estimatedHeight, gap]);
  useLayoutEffect(() => {
    if (!anchorDelta.current || !ref.current) return;
    ref.current.scrollTop += anchorDelta.current;
    anchorDelta.current = 0;
    const top = ref.current.scrollTop;
    setViewport(old => ({ ...old, top }));
  }, [revision]);
  useLayoutEffect(() => {
    pruneMap(heights.current, keys);
    const live = new Set(keys);
    for (const [media, key] of playing.current) if (!live.has(key)) playing.current.delete(media);
    setPlayingKeys(old => old.some(key => !live.has(key)) ? old.filter(key => live.has(key)) : old);
  }, [keys]);
  useLayoutEffect(() => {
    const element = ref.current!;
    const measure = () => setViewport(old => {
      const height = element.clientHeight || maxHeight || 1400;
      return old.height === height ? old : { ...old, height };
    });
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [maxHeight]);
  useLayoutEffect(() => {
    const element = ref.current!;
    if (followAppend && items.length > previousCount.current) {
      element.scrollTop = Math.max(0, layoutRef.current.total - element.clientHeight);
      setViewport(old => ({ ...old, top: element.scrollTop }));
    }
    previousCount.current = items.length;
  }, [items.length, followAppend]);
  useLayoutEffect(() => {
    const element = ref.current!;
    const maxTop = Math.max(0, layout.total - (element.clientHeight || viewport.height));
    if (viewport.top > maxTop) {
      element.scrollTop = maxTop;
      setViewport(old => ({ ...old, top: maxTop }));
    }
  }, [layout.total, viewport.top, viewport.height]);
  const mediaKey = (target: EventTarget) => {
    let element = (target as HTMLElement).closest<HTMLElement>("[data-window-key]");
    // Nested artifact lists must pin their outer pipeline row, not the artifact ID.
    while (element && element.parentElement !== ref.current) {
      element = element.parentElement?.closest<HTMLElement>("[data-window-key]") || null;
    }
    return element?.dataset.windowKey;
  };
  const indices = virtual ? layout.indices : keys.map((_, index) => index);
  let offset = 0;
  return <div ref={ref} className={className} data-windowed={virtual || undefined}
    style={{ gap: 0, ...(maxHeight ? { maxHeight, overflowY: "auto" } : {}), overflowAnchor: "none" }}
    onWheel={event => event.stopPropagation()}
    onScroll={event => { const top = event.currentTarget.scrollTop; setViewport(old => old.top === top ? old : { ...old, top }); }}
    onFocusCapture={event => setFocused(mediaKey(event.target) || null)}
    onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(null); }}
    onPlayCapture={event => {
      const key = mediaKey(event.target);
      if (key) { playing.current.set(event.target as HTMLMediaElement, key); setPlayingKeys([...new Set(playing.current.values())]); }
    }}
    onPauseCapture={event => { playing.current.delete(event.target as HTMLMediaElement); setPlayingKeys([...new Set(playing.current.values())]); }}
    onEndedCapture={event => { playing.current.delete(event.target as HTMLMediaElement); setPlayingKeys([...new Set(playing.current.values())]); }}>
    {indices.map(index => {
      const spacer = virtual ? layout.offsets[index] - offset : 0;
      offset = layout.offsets[index + 1];
      return <Fragment key={keys[index]}>
        {spacer > 0 && <div aria-hidden="true" style={{ height: spacer, flexShrink: 0 }} />}
        <MeasuredItem itemKey={keys[index]} gap={index === items.length - 1 ? 0 : gap} onHeight={onHeight}>
          {renderItem(items[index], index)}
        </MeasuredItem>
      </Fragment>;
    })}
    {virtual && layout.total > offset && <div aria-hidden="true" style={{ height: layout.total - offset, flexShrink: 0 }} />}
  </div>;
}
