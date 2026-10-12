import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SlidersHorizontal, X } from "lucide-react";
import { getRestartPlayback, setRestartPlayback } from "../../utils/playbackSettings";

export function PlaybackSettings() {
  const [open, setOpen] = useState(false);
  const [restart, setRestart] = useState(getRestartPlayback);
  const dialog = useRef<HTMLElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    close.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.stopPropagation(); setOpen(false); }
      if (event.key === "Tab") {
        const elements = Array.from(dialog.current?.querySelectorAll<HTMLElement>("button, input") || []);
        const first = elements[0], last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("keydown", key); previous?.focus(); };
  }, [open]);
  return <>
    <button type="button" title="设置音频播放起点" onClick={() => { setRestart(getRestartPlayback()); setOpen(true); }}><SlidersHorizontal size={16} />播放设置</button>
    {open && createPortal(<div className="studio-about-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section ref={dialog} className="studio-about-dialog studio-playback-dialog" role="dialog" aria-modal="true" aria-labelledby="playback-settings-title">
        <header><h3 id="playback-settings-title">播放设置</h3><button ref={close} type="button" aria-label="关闭播放设置" onClick={() => setOpen(false)}><X size={16} /></button></header>
        <label className="studio-playback-option"><input type="checkbox" checked={restart} onChange={event => { setRestart(event.target.checked); setRestartPlayback(event.target.checked); }} />每次从头播放</label>
        <p>不勾选：从暂停位置继续播放。<br />勾选：每次点击播放，都从音频开头开始。</p>
        <p>适用于所有节点及暂存音频；设置自动保存，下次播放生效。</p>
      </section>
    </div>, document.body)}
  </>;
}
