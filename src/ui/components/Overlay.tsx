import { ArrowLeft, Check, ChevronRight, X } from "lucide-react";
import { PHONE_LAYOUT, visibleViewport } from "../../application/viewport";
import { ROUTE_EVENT } from "../../application/router";
import { type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode, type RefObject, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
// Portalled children aren't DOM descendants of their parent dialog. Only the top trap answers Tab.
const focusTraps: HTMLElement[] = [];

/** Keeps Tab inside [ref] and returns focus to where it was when the overlay closes. */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean, cycle = false): void {
  useEffect(() => {
    if (!active) return;
    const before = document.activeElement as HTMLElement | null;
    const el = ref.current;
    if (!el) return;
    focusTraps.push(el);
    const items = () => [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((item) => item.tabIndex >= 0 && item.getClientRects().length && !item.closest("[inert]"));
    const first = items().find((item) => item.hasAttribute("data-autofocus")) ?? items()[0] ?? el;
    first?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || focusTraps.at(-1) !== el) return;
      // Desktop menus own Tab dismissal even when portalled out of a parent dialog.
      const focused = document.activeElement as HTMLElement | null;
      if (!el.contains(focused) && focused?.closest(".menu")) return;
      const list = items();
      if (!list.length) return e.preventDefault();
      if (cycle) {
        // Safari can skip buttons in native Tab order. Context sheets explicitly expose every action.
        e.preventDefault();
        const index = list.indexOf(focused!);
        const next = index < 0 ? (e.shiftKey ? list.length - 1 : 0) : (index + (e.shiftKey ? -1 : 1) + list.length) % list.length;
        list[next].focus();
      } else {
        const [first, last] = [list[0], list[list.length - 1]];
        if (e.shiftKey && (focused === first || !el.contains(focused))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (focused === last || !el.contains(focused))) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      const top = focusTraps.at(-1) === el;
      const index = focusTraps.lastIndexOf(el);
      if (index >= 0) focusTraps.splice(index, 1);
      if (top && before?.isConnected) before.focus({ preventScroll: true });
    };
  }, [ref, active, cycle]);
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
  /** CSS variables for that look (a profile card's theme colours). */
  vars?: CSSProperties;
  /**
   * On wide screens, shown as a card beside this point (the left edge of what opened it) instead of centred, over a clear
   * backdrop: a profile from the member list (the reference's popover). Narrow screens keep the centred dialog.
   */
  near?: { x: number; y: number } | null;
}

/** Wider than this, a dialog with [near] is placed beside its anchor. */
const NEAR_MIN_WIDTH = 961;
const NEAR_GAP = 12;

export function Dialog({ title, onClose, children, footer, wide, width, header, subtitle, className, vars, near }: DialogProps) {
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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented && focusTraps.at(-1) === ref.current && !document.querySelector(".menu")) onClose();
    };
    document.addEventListener("keydown", onKey);
    window.addEventListener("popstate", onClose);
    window.addEventListener(ROUTE_EVENT, onClose);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("popstate", onClose);
      window.removeEventListener(ROUTE_EVENT, onClose);
    };
  }, [onClose]);
  return createPortal(
    <div className={`scrim${anchored ? " scrim-clear" : ""}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        className={`dialog${className ? ` ${className}` : ""}${anchored ? " dialog-near" : ""}`}
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-label={title}
        style={{
          ...vars,
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
  className?: string;
  icon?: ReactNode;
  /** Chosen: a leaf closes the whole menu first. Not called for an item with a [submenu]. */
  onSelect?: () => void;
  danger?: boolean;
  /** A choice among several (radio), or with [toggle] an on/off box that stays open after a click. */
  checked?: boolean;
  toggle?: boolean;
  disabled?: boolean;
  /** A second, quieter line under the label (the current setting, as Discord shows "All Messages"). */
  hint?: string;
  /** Opens beside the item on hover, click, Enter or the right arrow. */
  submenu?: MenuEntry[];
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
  return <MenuLevel anchor={anchor} entries={entries} onClose={onClose} onDone={onClose} align={align} label={label} point={point} beside={false} />;
}

/** Where a menu goes: at the pointer, beside its item (a submenu), or below its button, kept inside the window. */
function menuPosition(anchor: HTMLElement, el: HTMLElement | null, align: "start" | "end", point: { x: number; y: number } | null, beside: boolean) {
  const v = visibleViewport();
  const w = el?.offsetWidth ?? 240;
  const h = el?.offsetHeight ?? 200;
  const fit = (top: number) => Math.max(v.top + 8, Math.min(top, v.bottom - h - 8));
  const fitLeft = (left: number) => Math.max(v.left + 8, Math.min(left, v.right - w - 8));
  if (point) {
    return { top: fit(point.y + h > v.bottom - 8 ? point.y - h : point.y), left: fitLeft(point.x + w > v.right - 8 ? point.x - w : point.x) };
  }
  const r = anchor.getBoundingClientRect();
  if (beside) {
    // Beside the item, flipped to the left where the window ends; level with the item, moved up to fit.
    const left = fitLeft(r.right + 4 + w > v.right - 8 ? r.left - w - 4 : r.right + 4);
    return { top: fit(r.top - 6), left };
  }
  let left = align === "end" ? r.right - w : r.left;
  left = fitLeft(left);
  let top = r.bottom + 6;
  if (top + h > v.bottom - 8) top = r.top - h - 6;
  return { top: fit(top), left };
}

interface MenuLevelProps extends Required<Omit<MenuProps, "point">> {
  point: { x: number; y: number } | null;
  /** Closes every level (a leaf was chosen, or a click landed outside them all). */
  onDone: () => void;
  beside: boolean;
}

function MenuLevel({ anchor, entries, onClose, onDone, align, label, point, beside }: MenuLevelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [open, setOpen] = useState<{ index: number; el: HTMLElement } | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phone = window.matchMedia(PHONE_LAYOUT).matches;
  useFocusTrap(ref, phone && !open, true);
  useLayoutEffect(() => {
    const place = () => setPos(menuPosition(anchor, ref.current, align, point, beside));
    place();
    window.visualViewport?.addEventListener("resize", place);
    window.visualViewport?.addEventListener("scroll", place);
    return () => {
      window.visualViewport?.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("scroll", place);
    };
  }, [anchor, align, point, beside]);
  // Desktop popovers close on resize; phone sheets stay open when the keyboard resizes Chrome's window.
  useEffect(() => {
    if (beside) return;
    const close = () => onDone();
    const resize = () => {
      if (!phone || !window.matchMedia(PHONE_LAYOUT).matches) close();
    };
    window.addEventListener("resize", resize);
    window.addEventListener("popstate", close);
    window.addEventListener(ROUTE_EVENT, close);
    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("popstate", close);
      window.removeEventListener(ROUTE_EVENT, close);
    };
  }, [onDone, beside, phone]);
  useEffect(() => () => void (hoverTimer.current && clearTimeout(hoverTimer.current)), []);
  useEffect(() => {
    const items = () => [...(ref.current?.querySelectorAll<HTMLElement>(':scope > [role^="menuitem"]:not([disabled])') ?? [])];
    const onKey = (e: KeyboardEvent) => {
      // Only the level that has the focus answers (a submenu's keys aren't its parent's).
      if (!ref.current?.contains(document.activeElement)) return;
      const list = items();
      const i = list.indexOf(document.activeElement as HTMLElement);
      if (e.key === "Escape" || (beside && e.key === "ArrowLeft")) {
        e.preventDefault();
        onClose();
        anchor.focus();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        list[(i + 1) % list.length]?.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        list[(i - 1 + list.length) % list.length]?.focus();
      } else if (e.key === "Tab" && !phone) onDone();
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      // Clicks in this menu or one of its submenus (or on the button that opened it) keep it open.
      if (beside || t.closest?.(".menu") || anchor.contains(t)) return;
      onDone();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [anchor, onClose, onDone, beside, phone]);
  // The first item takes the focus once the menu is placed (a hidden element can't take it), so the keyboard and
  // Escape work at once however it was opened.
  const placed = pos !== null;
  useEffect(() => {
    if (!placed || ref.current?.contains(document.activeElement)) return;
    ref.current?.querySelector<HTMLElement>(':scope > [role^="menuitem"]:not([disabled])')?.focus();
  }, [placed]);
  const openSub = (index: number, el: HTMLElement) => setOpen((o) => (o?.index === index ? o : { index, el }));
  const sub = open ? entries[open.index] : null;
  return createPortal(
    <>
      {!beside && <div className="menu-scrim" aria-hidden="true" onPointerDown={() => onDone()} />}
      <div
        ref={ref}
        className={`menu${beside ? " menu-submenu" : ""}`}
        role="menu"
        tabIndex={-1}
        inert={phone && !!open}
        aria-label={label}
        style={pos ? { top: pos.top, left: pos.left } : { visibility: "hidden", top: 0, left: 0 }}
      >
        <div className="menu-phone-head">
          {beside && (
            <button className="icon-btn" aria-label="Back to previous menu" onClick={onClose}>
              <ArrowLeft size={20} />
            </button>
          )}
          <strong className="grow">{label}</strong>
          <button className="icon-btn" aria-label={`Close ${label} menu`} onClick={onDone}>
            <X size={20} />
          </button>
        </div>
        {entries.map((e, i) => {
          if (e === "separator") return <hr key={i} />;
          if ("heading" in e)
            return (
              <div key={i} className="menu-label">
                {e.heading}
              </div>
            );
          if ("custom" in e) return <div key={i}>{e.custom}</div>;
          const hasSub = !!e.submenu?.length;
          const role = e.toggle ? "menuitemcheckbox" : e.checked === undefined ? "menuitem" : "menuitemradio";
          return (
            <button
              key={i}
              role={role}
              aria-checked={e.checked}
              aria-haspopup={hasSub ? "menu" : undefined}
              aria-expanded={hasSub ? open?.index === i : undefined}
              className={[e.className, e.danger ? "danger" : "", hasSub && open?.index === i ? "open" : ""].filter(Boolean).join(" ") || undefined}
              disabled={e.disabled}
              onMouseEnter={(ev) => {
                const el = ev.currentTarget;
                if (hoverTimer.current) clearTimeout(hoverTimer.current);
                // A short pause, so moving the pointer down the list doesn't flash every submenu.
                hoverTimer.current = setTimeout(() => (hasSub ? openSub(i, el) : setOpen(null)), hasSub ? 120 : 200);
              }}
              onKeyDown={(ev) => {
                if (hasSub && (ev.key === "ArrowRight" || ev.key === "Enter" || ev.key === " ")) {
                  ev.preventDefault();
                  ev.stopPropagation();
                  openSub(i, ev.currentTarget);
                }
              }}
              onClick={(ev) => {
                if (hasSub) return openSub(i, ev.currentTarget);
                if (e.toggle) return e.onSelect?.();
                onDone();
                e.onSelect?.();
              }}
            >
              {e.icon}
              <span className="grow menu-text">
                <span>{e.label}</span>
                {e.hint && <small className="menu-hint">{e.hint}</small>}
              </span>
              {e.toggle && <span className="menu-box" aria-hidden="true" />}
              {!e.toggle && e.checked && <Check size={15} className="menu-check" aria-hidden="true" />}
              {hasSub && <ChevronRight size={15} className="menu-chevron" aria-hidden="true" />}
            </button>
          );
        })}
        {open && sub && sub !== "separator" && "submenu" in sub && sub.submenu && (
          <MenuLevel anchor={open.el} entries={sub.submenu} onClose={() => setOpen(null)} onDone={onDone} align="start" label={sub.label} point={null} beside />
        )}
      </div>
    </>,
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
 * The browser's own menu stays only in text fields, where paste, spelling suggestions and the like live (2026-10-28: the
 * owner wants no browser menu anywhere else in the app). Elsewhere a right-click opens Meldiq's menu, which offers what
 * the browser's did where it matters (a message's photo, link or selected text: chat/contextTarget.tsx), or none on
 * empty space. Developer tools stay reachable from the browser's own menus and shortcuts: nothing here blocks them.
 */
export function keepsNativeMenu(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el?.closest?.('input, textarea, select, [contenteditable="true"]');
}

/**
 * For the app's frame (the root element): a right-click that nothing in Meldiq answered shows no menu, as in a
 * desktop app, except where [keepsNativeMenu] keeps the browser's.
 */
export function quietContextMenu(e: ReactMouseEvent<HTMLElement>): void {
  if (!keepsNativeMenu(e.target)) e.preventDefault();
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
