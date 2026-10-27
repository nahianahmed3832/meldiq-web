import { X } from "lucide-react";
import { type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode, type RefObject, useEffect, useLayoutEffect, useRef, useState } from "react";
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
  /** A line under the title (the reference's dialog subtitles). */
  subtitle?: ReactNode;
  /** Extra class on the dialog (a card's own look). */
  className?: string;
  /**
   * On wide screens, shown as a card beside this point (the left edge of what opened it) instead of centred, over a clear
   * backdrop: a profile from the member list (the reference's popover). Narrow screens keep the centred dialog.
   */
  near?: { x: number; y: number } | null;
}

/** Wider than this, a dialog with [near] is placed beside its anchor. */
const NEAR_MIN_WIDTH = 961;
const NEAR_GAP = 12;

export function Dialog({ title, onClose, children, footer, wide, width, header, subtitle, className, near }: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [placed, setPlaced] = useState<{ top: number; left: number } | null>(null);
  const anchored = !!near && typeof window !== "undefined" && window.innerWidth >= NEAR_MIN_WIDTH;
  useLayoutEffect(() => {
    if (!anchored || !near || !ref.current) return;
    const { offsetWidth: w, offsetHeight: h } = ref.current;
    const left = Math.max(8, Math.min(near.x - w - NEAR_GAP, window.innerWidth - w - 8));
    const top = Math.max(8, Math.min(near.y - 24, window.innerHeight - h - 8));
    setPlaced({ top, left });
  }, [anchored, near]);
  useFocusTrap(ref, true);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(
    <div className={`scrim${anchored ? " scrim-clear" : ""}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        className={`dialog${className ? ` ${className}` : ""}${anchored ? " dialog-near" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          ...(width ? { width } : wide ? { width: "min(680px, 100%)" } : {}),
          ...(anchored ? (placed ? { position: "fixed", top: placed.top, left: placed.left } : { visibility: "hidden" }) : {}),
        }}
      >
        {header ?? (
          <div className="dialog-head">
            {subtitle ? (
              <div className="grow dialog-titles">
                <h2>{title}</h2>
                <p className="dialog-sub">{subtitle}</p>
              </div>
            ) : (
              <h2>{title}</h2>
            )}
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
  /** Opened at the pointer (a right-click): the menu's corner there, kept inside the window. */
  point?: { x: number; y: number } | null;
}

/** A popup menu: arrow keys move, Escape closes, focus returns to the button that opened it. */
export function Menu({ anchor, entries, onClose, align = "start", label, point = null }: MenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const w = el?.offsetWidth ?? 240;
    const h = el?.offsetHeight ?? 200;
    if (point) {
      // At the pointer, flipped to the left or upwards where it would leave the window.
      const left = point.x + w > window.innerWidth - 8 ? Math.max(8, point.x - w) : point.x;
      const top = point.y + h > window.innerHeight - 8 ? Math.max(8, point.y - h) : point.y;
      setPos({ top, left });
      return;
    }
    const r = anchor.getBoundingClientRect();
    let left = align === "end" ? r.right - w : r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    let top = r.bottom + 6;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);
    setPos({ top, left });
  }, [anchor, align, point]);
  // A menu belongs to where it was opened: leaving the page or resizing the window closes it.
  useEffect(() => {
    const close = () => onClose();
    window.addEventListener("resize", close);
    window.addEventListener("popstate", close);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("popstate", close);
    };
  }, [onClose]);
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

/**
 * A button that opens a [Menu] below itself; [openAt] opens it at the pointer instead (a right-click), and [point]
 * goes to the Menu.
 */
export function useMenu(): {
  anchor: HTMLElement | null;
  point: { x: number; y: number } | null;
  open: (el: HTMLElement) => void;
  openAt: (el: HTMLElement, e: { clientX: number; clientY: number } | null) => void;
  close: () => void;
} {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  return {
    anchor,
    point,
    open: (el) => {
      setPoint(null);
      setAnchor(el);
    },
    openAt: (el, e) => {
      // A keyboard-opened menu (no pointer, or the 0,0 that some browsers report) sits by the element instead.
      setPoint(e && (e.clientX || e.clientY) ? { x: e.clientX, y: e.clientY } : null);
      setAnchor(el);
    },
    close: () => setAnchor(null),
  };
}

/**
 * The browser's own menu stays where it's the expected one: text fields, links, media, and over selected text (copy).
 * Everywhere else on Meldiq's content a right-click opens Meldiq's menu. (Developer tools stay reachable: nothing here
 * tries to block them.)
 */
export function keepsNativeMenu(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (el?.closest?.('a[href], input, textarea, select, [contenteditable="true"], img, video, audio, canvas')) return true;
  const selected = typeof window !== "undefined" ? window.getSelection()?.toString() : "";
  return !!selected && !!el && !!window.getSelection()?.containsNode(el, true);
}

/**
 * Props that open [menu] on right-click (or a two-finger click) at the pointer, and on the keyboard's Menu key or
 * Shift+F10 by the element, unless the browser's menu is the right one there ([keepsNativeMenu]).
 */
export function contextMenuProps(open: (el: HTMLElement, e: { clientX: number; clientY: number } | null) => void) {
  return {
    onContextMenu: (e: ReactMouseEvent<HTMLElement>) => {
      if (keepsNativeMenu(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      open(e.currentTarget, e);
    },
    onKeyDown: (e: ReactKeyboardEvent<HTMLElement>) => {
      if ((e.key === "ContextMenu" || (e.key === "F10" && e.shiftKey)) && !keepsNativeMenu(e.target)) {
        e.preventDefault();
        open(e.currentTarget, null);
      }
    },
  };
}
