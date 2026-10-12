import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal, X, RefreshCw, ExternalLink } from "lucide-react";
import packageMeta from "../../../package.json";
import { CompactMoreMenu } from "./CompactMoreMenu";

type UpdateResult = { status: "available" | "latest" | "error"; latestVersion?: string; message?: string };
type DesktopApi = {
  getAppInfo: () => Promise<{ version: string }>;
  checkForUpdates: () => Promise<UpdateResult>;
  showMoreMenu: () => Promise<void>;
  runMenuCommand: (command: string) => Promise<void>;
  openAppLink: (destination: "repository" | "release") => Promise<void>;
  editNative: (command: string) => Promise<void>;
  onMenuEvent: (callback: (command: string) => void) => () => void;
};
const desktop = () => (window as Window & { electronApi?: DesktopApi }).electronApi;
const REPOSITORY = "https://github.com/LDyaoshengchen/MiMo-Audio-Workstation";

export function StudioMoreMenu() {
  const [about, setAbout] = useState(false);
  const [menu, setMenu] = useState(false);
  const moreRef = useRef<HTMLButtonElement>(null);
  const editTarget = useRef<Element | null>(null);
  const [version, setVersion] = useState(packageMeta.version);
  const [result, setResult] = useState<UpdateResult | null>(null);
  const [checking, setChecking] = useState(false);
  const alive = useRef(true);
  const busy = useRef(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  async function check() {
    const api = desktop();
    if (!api?.checkForUpdates || busy.current) return;
    busy.current = true; setChecking(true);
    try {
      const next = await api.checkForUpdates();
      if (alive.current) setResult(previous => next.status === "error" && previous?.status === "available" ? { ...previous, message: next.message } : next);
    } catch { if (alive.current) setResult(previous => previous?.status === "available" ? { ...previous, message: "检测失败，请稍后重试" } : { status: "error", message: "检测失败，请稍后重试" }); }
    finally { busy.current = false; if (alive.current) setChecking(false); }
  }
  useEffect(() => {
    alive.current = true;
    const api = desktop();
    api?.getAppInfo?.().then(info => { if (alive.current) setVersion(info.version); }).catch(() => {});
    const off = api?.onMenuEvent?.(command => {
      if (command === "about") { setAbout(true); return; }
      const keys: Record<string, string> = { undo: "z", redo: "y", cut: "x", copy: "c", paste: "v", selectAll: "a" };
      if (!keys[command]) return;
      if (document.activeElement?.closest("input, textarea, [contenteditable='true']")) {
        void api.editNative(command).catch(() => {});
      } else {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: keys[command], ctrlKey: true, bubbles: true, cancelable: true }));
      }
    });
    // Silent at startup; manual checks remain available in About.
    const initial = window.setTimeout(() => { void check(); }, 2000);
    const periodic = window.setInterval(() => { void check(); }, 6 * 60 * 60 * 1000);
    return () => { alive.current = false; off?.(); window.clearTimeout(initial); window.clearInterval(periodic); };
  }, []);
  useEffect(() => {
    if (!about) return;
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.stopPropagation(); setAbout(false); }
      if (event.key === "Tab") {
        const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(".studio-about-dialog button:not(:disabled)"));
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); previous?.focus(); };
  }, [about]);
  function open(destination: "repository" | "release") {
    const api = desktop();
    if (api?.openAppLink) void api.openAppLink(destination).catch(() => setResult({ status: "error", message: "无法打开浏览器，请稍后重试" }));
    else window.open(destination === "repository" ? REPOSITORY : `${REPOSITORY}/releases/latest`, "_blank", "noopener,noreferrer");
  }
  function runCommand(command: string) {
    if (command === "about") { setAbout(true); return; }
    const keys: Record<string, string> = { undo: "z", redo: "y", cut: "x", copy: "c", paste: "v", selectAll: "a" };
    if (keys[command]) {
      if (editTarget.current?.closest("input, textarea, [contenteditable='true']")) {
        (editTarget.current as HTMLElement).focus();
        void desktop()?.editNative(command).catch(() => {});
      } else window.dispatchEvent(new KeyboardEvent("keydown", { key: keys[command], ctrlKey: true, bubbles: true, cancelable: true }));
    } else void desktop()?.runMenuCommand?.(command).catch(() => {});
  }
  return <>
    <button ref={moreRef} type="button" className="studio-more-button" title="更多：编辑、视图、窗口与关于" aria-haspopup="menu" aria-expanded={menu} aria-label={result?.status === "available" ? "更多，有新版本" : "更多"}
      onMouseDown={event => { editTarget.current = document.activeElement; event.preventDefault(); }}
      onClick={() => setMenu(previous => !previous)} onKeyDown={event => { if (event.key === "ArrowDown") { event.preventDefault(); editTarget.current = document.activeElement; setMenu(true); window.requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('.studio-compact-root button')?.focus()); } }}>
      <MoreHorizontal size={16} />更多{result?.status === "available" && <span className="studio-update-dot" aria-hidden="true" />}
    </button>
    {menu && moreRef.current && <CompactMoreMenu anchor={moreRef.current} onClose={() => setMenu(false)} onCommand={runCommand} />}
    {about && createPortal(<div className="studio-about-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setAbout(false); }}>
      <section className="studio-about-dialog" role="dialog" aria-modal="true" aria-labelledby="studio-about-title">
        <header><h3 id="studio-about-title">关于</h3><button ref={closeRef} type="button" aria-label="关闭关于" onClick={() => setAbout(false)}><X size={16} /></button></header>
        <h2>MiMo Audio Workstation</h2><p>音频设计、语音克隆与有声书工作站</p>
        <div className="studio-about-version">当前版本 <strong>v{version}</strong></div>
        <div role="status" className="studio-update-status">
          {checking ? "正在检测更新…" : result?.status === "available" ? `发现新版本 v${result.latestVersion}` : result?.status === "latest" ? "当前已是最新版本" : result?.message || (desktop()?.checkForUpdates ? "可手动检测更新" : "更新检测仅在桌面客户端可用")}
          {result?.status === "available" && result.message && <p>{result.message}</p>}
        </div>
        <div className="studio-about-actions">
          <button type="button" disabled={checking || !desktop()?.checkForUpdates} onClick={() => { void check(); }}><RefreshCw size={14} />检测更新</button>
          {result?.status === "available" && <button type="button" onClick={() => open("release")}><ExternalLink size={14} />前往下载</button>}
        </div>
        <button type="button" className="studio-repository-link" onClick={() => open("repository")}><ExternalLink size={14} />GitHub · MiMo-Audio-Workstation</button>
      </section>
    </div>, document.body)}
  </>;
}
