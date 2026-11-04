import type { ReactNode } from "react";
import { useLocaleRender } from "../../i18n/Localized";

export function Card({ title, sub, children, actions }: { title: string; sub?: ReactNode; children?: ReactNode; actions?: ReactNode }) {
  useLocaleRender();
  return (
    <section className="card ws-card" aria-label={title}>
      <header className="ws-card-head">
        <div className="grow">
          <h3>{title}</h3>
          {sub && <p className="muted">{sub}</p>}
        </div>
        {actions}
      </header>
      {children}
    </section>
  );
}
export function ErrorLine({ text }: { text: string | null }) {
  return text ? (
    <div className="banner danger" role="alert">
      {text}
    </div>
  ) : null;
}
