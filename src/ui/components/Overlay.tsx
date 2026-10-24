import { X } from "lucide-react";
import { type ReactNode, type RefObject, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select, [tabindex]:not([tabindex="-1"])';

/** Keeps Tab inside [ref] and returns focus to where it was when the overlay closes. */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const before = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const first = el?.querySelector<HTMLElement>("[data-autofocus]") ?? el?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !el) return;
      const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!items.length) return;
      const [a, b] = [items[0], items[items.length - 1]];
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        b.focus();
      } else if (!e.shiftKey && document.activeElement === b) {
        e.preventDefault();
        a.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      before?.focus?.();
    };
  }, [ref, active]);
}

interface DialogProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  /** A CSS width for dialogs wider than `wide` (e.g. a catalog grid); wins over `wide`. */
  width?: string;
  /** Replaces the title row (search). */
  header?: ReactNode;
}

export function Dialog({ title, onClose, children, footer, wide, width, header }: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, true);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className="dialog" role="dialog" aria-modal="true" aria-label={title} style={width ? { width } : wide ? { width: "min(680px, 100%)" } : undefined}>
        {header ?? (
          <div className="dialog-head">
            <h2>{title}</h2>
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        )}
        <div className="scroll" style={{ minHeight: 0 }}>
          {children}
        </div>
        {footer && <div className="dialog-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  checked?: boolean;
  disabled?: boolean;
}

export type MenuEntry = MenuItem | "separator" | { heading: string } | { custom: ReactNode };

interface MenuProps {
  anchor: HTMLElement;
  entries: MenuEntry[];
  onClose: () => void;
  align?: "start" | "end";
  label: string;
}

/** A popup menu: arrow keys move, Escape closes, focus returns to the button that opened it. */
export function Menu({ anchor, entries, onClose, align = "start", label }: MenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  useLayoutEffect(() => {
    const r = anchor.getBoundingClientRect();
    const el = ref.current;
    const w = el?.offsetWidth ?? 240;
    const h = el?.offsetHeight ?? 200;
    let left = align === "end" ? r.right - w : r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    let top = r.bottom + 6;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);
    setPos({ top, left });
  }, [anchor, align]);
  useEffect(() => {
    const items = () => [...(ref.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([disabled])') ?? [])];
    items()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      const list = items();
      const i = list.indexOf(document.activeElement as HTMLElement);
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        anchor.focus();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        list[(i + 1) % list.length]?.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        list[(i - 1 + list.length) % list.length]?.focus();
      } else if (e.key === "Tab") onClose();
    };
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node) && !anchor.contains(e.target as Node)) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [anchor, onClose]);
  return createPortal(
    <div ref={ref} className="menu" role="menu" aria-label={label} style={pos ? { top: pos.top, left: pos.left } : { visibility: "hidden", top: 0, left: 0 }}>
      {entries.map((e, i) => {
        if (e === "separator") return <hr key={i} />;
        if ("heading" in e)
          return (
            <div key={i} className="menu-label">
              {e.heading}
            </div>
          );
        if ("custom" in e) return <div key={i}>{e.custom}</div>;
        return (
          <button
            key={i}
            role={e.checked === undefined ? "menuitem" : "menuitemradio"}
            aria-checked={e.checked}
            className={e.danger ? "danger" : undefined}
            disabled={e.disabled}
            onClick={() => {
              onClose();
              e.onSelect();
            }}
          >
            {e.icon}
            <span className="grow">{e.label}</span>
          </button>
        );
      })}
    </div>,
    document.body,
  );
}

/** A button that opens a [Menu] below itself. */
export function useMenu(): { anchor: HTMLElement | null; open: (el: HTMLElement) => void; close: () => void } {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return { anchor, open: setAnchor, close: () => setAnchor(null) };
}
