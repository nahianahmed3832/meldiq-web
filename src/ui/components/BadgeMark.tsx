import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** Small identity marks: the icon stays in the name row; its meaning opens on hover or activation. */
export function BadgeMark({ name, description, className = "", children }: { name: string; description: string; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [at, setAt] = useState<{ left: number; top: number } | null>(null);
  const open = () => {
    if (at) return setAt(null);
    const box = ref.current?.getBoundingClientRect();
    if (box) setAt({ left: Math.max(12, Math.min(innerWidth - 272, box.left - 100)), top: box.bottom + 122 < innerHeight ? box.bottom + 8 : Math.max(12, box.top - 118) });
  };
  useEffect(() => {
    if (!at) return;
    const dismiss = (event: Event) => {
      if (event instanceof KeyboardEvent) {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        setAt(null);
        return;
      }
      if (!ref.current?.contains(event.target as Node)) setAt(null);
    };
    document.addEventListener("pointerdown", dismiss, true);
    document.addEventListener("keydown", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      document.removeEventListener("pointerdown", dismiss, true);
      document.removeEventListener("keydown", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [at]);
  return (
    <>
      <span
        ref={ref}
        className={`badge-mark ${className}`}
        title={name}
        role="img"
        aria-label={`${name}: ${description}`}
        tabIndex={0}
        onBlur={() => setAt(null)}
        onClick={(e) => {
          e.stopPropagation();
          open();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            open();
          }
        }}
      >
        {children}
      </span>
      {at &&
        createPortal(
          <div className="badge-detail" style={at} role="status">
            <strong>{name}</strong>
            <span>{description}</span>
          </div>,
          document.body,
        )}
    </>
  );
}
