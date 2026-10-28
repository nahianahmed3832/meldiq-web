import { X } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import { useFocusTrap } from "../components/Overlay";

interface SettingsWindowProps {
  /** Names the window for screen readers ("Settings", or the community's settings). */
  label: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Settings and community settings as a floating window over the app (the owner's reference, 2026-10-28, as Discord and
 * Yapin' do): the conversation stays behind it, Esc or the close button returns to it. Phones show settings full screen
 * instead (Shell.tsx). A dialog opened inside takes Esc first.
 */
export function SettingsWindow({ label, onClose, children }: SettingsWindowProps) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, true);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || document.querySelector(".scrim, [role=menu]")) return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="settings-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className="settings-window" role="dialog" aria-modal="true" aria-label={label}>
        <button className="icon-btn settings-window-close" onClick={onClose} aria-label="Close settings" title="Close (Esc)">
          <X size={20} />
        </button>
        {children}
      </div>
    </div>
  );
}
