import { X } from "lucide-react";
import { useEffect } from "react";
import { useEngine, useOrbit } from "../../application/orbit";

/** Short-lived messages: errors stay until dismissed or 10 s, information 5 s. */
export function Notices() {
  const engine = useEngine();
  const notices = useOrbit((s) => s.notices);
  useEffect(() => {
    const timers = notices.map((n) => setTimeout(() => engine.dismissNotice(n.id), n.kind === "error" ? 10_000 : 5_000));
    return () => timers.forEach(clearTimeout);
  }, [notices, engine]);
  if (!notices.length) return null;
  return (
    <div className="notices" role="status" aria-live="polite">
      {notices.map((n) => (
        <div key={n.id} className={`notice ${n.kind}`} role={n.kind === "error" ? "alert" : undefined}>
          <span className="grow">{n.text}</span>
          <button onClick={() => engine.dismissNotice(n.id)} aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
