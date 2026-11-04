import { CircleAlert, LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";

/** A truthful asynchronous state shared by shell-level surfaces. Domain owners supply retry behavior. */
export function StatePanel({ title, description, loading = false, error = false, children }: { title: string; description?: string; loading?: boolean; error?: boolean; children?: ReactNode }) {
  return (
    <section className="state-panel" role={error ? "alert" : "status"} aria-busy={loading || undefined}>
      {(loading || error) && (
        <span className="state-panel-icon" aria-hidden="true">
          {loading ? <LoaderCircle className="state-spinner" size={24} /> : <CircleAlert size={24} />}
        </span>
      )}
      <strong>{title}</strong>
      {description && <p className="muted">{description}</p>}
      {children && <div className="state-panel-actions">{children}</div>}
    </section>
  );
}
