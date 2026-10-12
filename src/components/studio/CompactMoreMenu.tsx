import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight } from "lucide-react";

const groups = [
  { label: "编辑", items: [["撤销", "undo", "Ctrl+Z"], ["重做", "redo", "Ctrl+Y"], ["剪切", "cut", "Ctrl+X"], ["复制", "copy", "Ctrl+C"], ["粘贴", "paste", "Ctrl+V"], ["全选", "selectAll", "Ctrl+A"]] },
  { label: "视图", items: [["重新加载", "reload", "Ctrl+R"], ["强制重新加载", "forceReload", "Ctrl+Shift+R"], ["开发者工具", "devTools", "Ctrl+Shift+I"], ["重置缩放", "resetZoom", "Ctrl+0"], ["放大", "zoomIn", "Ctrl++"], ["缩小", "zoomOut", "Ctrl+-"], ["全屏", "fullscreen", "F11"]] },
  { label: "窗口", items: [["最小化", "minimize", "Ctrl+M"], ["最大化 / 还原", "maximize", ""], ["关闭", "close", "Ctrl+W"]] },
];

export function CompactMoreMenu({ anchor, onClose, onCommand }: {
  anchor: HTMLElement; onClose: () => void; onCommand: (command: string) => void;
}) {
  const [group, setGroup] = useState<number | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const rect = anchor.getBoundingClientRect();
  useEffect(() => {
    const pointer = (event: PointerEvent) => {
      if (!panel.current?.contains(event.target as Node) && !anchor.contains(event.target as Node)) onClose();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.stopPropagation(); onClose(); anchor.focus(); }
    };
    document.addEventListener("pointerdown", pointer);
    document.addEventListener("keydown", key);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("pointerdown", pointer); document.removeEventListener("keydown", key);
      window.removeEventListener("resize", onClose);
    };
  }, [anchor, onClose]);
  const choose = (command: string) => { onCommand(command); onClose(); };
  return createPortal(<div ref={panel} className="studio-compact-menu" style={{ top: Math.min(rect.bottom + 5, window.innerHeight - 230), right: Math.max(8, window.innerWidth - rect.right) }}
    onMouseDown={event => event.preventDefault()} onKeyDown={event => {
      const buttons = Array.from(panel.current?.querySelectorAll<HTMLButtonElement>("button") || []);
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault(); buttons[(index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length]?.focus();
      }
    }}>
    {group !== null && <div className="studio-compact-submenu" role="menu" aria-label={groups[group].label}>
      {groups[group].items.map(([label, command, shortcut]) => <button key={command} type="button" role="menuitem" onClick={() => choose(command)}><span>{label}</span><kbd>{shortcut}</kbd></button>)}
    </div>}
    <div className="studio-compact-root" role="menu" aria-label="更多">
      {groups.map(({ label }, index) => <button key={label} type="button" role="menuitem" aria-haspopup="menu" aria-expanded={group === index}
        onMouseEnter={() => setGroup(index)} onFocus={() => setGroup(index)} onClick={() => setGroup(index)}><span>{label}</span><ChevronRight size={12} /></button>)}
      <div className="studio-menu-separator" />
      <button type="button" role="menuitem" onMouseEnter={() => setGroup(null)} onFocus={() => setGroup(null)} onClick={() => choose("about")}>关于</button>
    </div>
  </div>, document.body);
}
