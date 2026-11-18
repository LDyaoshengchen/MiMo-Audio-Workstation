import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

export type StyledSelectOption = { value: string; label: string; disabled?: boolean; group?: string };

export function StyledSelect({
  id,
  value,
  options,
  onValueChange,
  ariaLabel,
  title,
  disabled = false,
  className = "",
  triggerClassName = "",
  placeholder = "选择…",
}: {
  id?: string;
  value: string;
  options: StyledSelectOption[];
  onValueChange: (value: string) => void;
  ariaLabel?: string;
  title?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  placeholder?: string;
}) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const selectedIndex = options.findIndex(option => option.value === value);
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  function updateMenuPosition() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect || typeof window === "undefined") return;
    const margin = 8;
    const width = Math.min(rect.width, Math.max(120, window.innerWidth - margin * 2));
    const left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin));
    const desiredHeight = Math.min(260, Math.max(40, options.length * 32 + 8));
    const below = Math.max(0, window.innerHeight - rect.bottom - margin - 4);
    const above = Math.max(0, rect.top - margin - 4);
    const openAbove = below < Math.min(desiredHeight, 150) && above > below;
    const maxHeight = Math.max(0, Math.min(desiredHeight, openAbove ? above : below));
    setMenuStyle({
      position: "fixed",
      left,
      width,
      maxHeight,
      zIndex: 11020,
      ...(openAbove ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
    });
  }

  function showMenu(index = selectedIndex >= 0 ? selectedIndex : 0) {
    updateMenuPosition();
    setActiveIndex(Math.max(0, Math.min(index, options.length - 1)));
    setOpen(true);
  }

  function choose(option: StyledSelectOption) {
    if (option.disabled) return;
    onValueChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function moveActive(direction: number) {
    if (!options.length) return;
    setActiveIndex(current => {
      let next = current;
      for (let count = 0; count < options.length; count += 1) {
        next = (next + direction + options.length) % options.length;
        if (!options[next].disabled) return next;
      }
      return current;
    });
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) showMenu(selectedIndex >= 0 ? selectedIndex : event.key === "ArrowDown" ? 0 : options.length - 1);
      else moveActive(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Home" && open) {
      event.preventDefault(); setActiveIndex(0);
    } else if (event.key === "End" && open) {
      event.preventDefault(); setActiveIndex(options.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!open) showMenu();
      else if (options[activeIndex]) choose(options[activeIndex]);
    } else if (event.key === "Escape" && open) {
      event.preventDefault(); setOpen(false);
    } else if (event.key === "Tab" && open) {
      setOpen(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    let frame = 0;
    const schedulePosition = () => {
      if (frame) return;
      if (typeof window.requestAnimationFrame !== "function") {
        updateMenuPosition();
        return;
      }
      frame = window.requestAnimationFrame(() => { frame = 0; updateMenuPosition(); });
    };
    const dismissOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    window.addEventListener("resize", schedulePosition);
    document.addEventListener("scroll", schedulePosition, true);
    document.addEventListener("pointerdown", dismissOutside, true);
    return () => {
      if (frame && typeof window.cancelAnimationFrame === "function") window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedulePosition);
      document.removeEventListener("scroll", schedulePosition, true);
      document.removeEventListener("pointerdown", dismissOutside, true);
    };
  }, [open, options.length]);

  return <div ref={rootRef} className={`styled-select${className ? ` ${className}` : ""}`}>
    <button
      ref={triggerRef}
      id={id}
      type="button"
      className={`styled-select-trigger${triggerClassName ? ` ${triggerClassName}` : ""}`}
      role="combobox"
      aria-label={ariaLabel}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={listboxId}
      aria-activedescendant={open ? `${listboxId}-option-${activeIndex}` : undefined}
      disabled={disabled}
      title={title}
      onClick={() => open ? setOpen(false) : showMenu()}
      onKeyDown={onTriggerKeyDown}
    >
      <span>{selectedOption?.label ?? placeholder}</span>
      <ChevronDown size={14} aria-hidden="true" className={open ? "is-open" : ""} />
    </button>
    {open && createPortal(<div ref={menuRef} id={listboxId} className="styled-select-menu" role="listbox" aria-label={ariaLabel} style={menuStyle} onClick={event => event.stopPropagation()}>
      {options.map((option, index) => <div key={option.value}>
        {option.group && (index === 0 || options[index - 1]?.group !== option.group) && <div className="styled-select-group-label">{option.group}</div>}
        <div
          id={`${listboxId}-option-${index}`}
          className="styled-select-option"
          role="option"
          aria-selected={option.value === value}
          aria-disabled={option.disabled || undefined}
          data-active={index === activeIndex || undefined}
          data-selected={option.value === value || undefined}
          onMouseEnter={() => setActiveIndex(index)}
          onMouseDown={event => event.preventDefault()}
          onClick={() => choose(option)}
        >
          <span>{option.label}</span>
          {option.value === value && <Check size={14} aria-hidden="true" />}
        </div>
      </div>)}
    </div>, document.body)}
  </div>;
}
