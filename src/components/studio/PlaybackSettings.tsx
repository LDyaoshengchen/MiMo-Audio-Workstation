import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Play, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { getRestartPlayback, setRestartPlayback } from "../../utils/playbackSettings";
import { useSettingsPopover } from "./useSettingsPopover";

export function PlaybackSettings() {
  const [open, setOpen] = useState(false);
  const [restart, setRestart] = useState(getRestartPlayback);
  const dialog = useRef<HTMLElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const trigger=useRef<HTMLButtonElement>(null);
  const popover=useSettingsPopover(open,trigger,dialog);
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
    <button ref={trigger} type="button" title="设置音频播放起点" onClick={() => { setRestart(getRestartPlayback()); setOpen(true); }}><SlidersHorizontal size={16} />播放设置</button>
    {open && createPortal(<div className={`studio-about-overlay${popover.overlayClass}`} onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section ref={dialog} className={`studio-about-dialog studio-playback-dialog${popover.panelClass}`} style={popover.style} role="dialog" aria-modal="true" aria-labelledby="playback-settings-title">
        <header><h3 id="playback-settings-title">播放设置</h3><button className="settings-close-button" ref={close} type="button" aria-label="关闭播放设置" title="关闭" onClick={() => setOpen(false)}><X size={18} /></button></header>
        <div className="studio-playback-options" role="group" aria-label="播放起点">
          <button type="button" aria-pressed={!restart} onClick={() => { setRestart(false); setRestartPlayback(false); }}><Play size={15} />从暂停处继续</button>
          <button type="button" aria-pressed={restart} onClick={() => { setRestart(true); setRestartPlayback(true); }}><RotateCcw size={15} />每次从头播放</button>
        </div>
        <p>{restart ? "每次点击播放，都从音频开头开始。" : "点击播放，从上次暂停的位置继续。"}</p>
        <p>适用于所有节点及暂存音频；设置自动保存，下次播放生效。</p>
      </section>
    </div>, document.body)}
  </>;
}
