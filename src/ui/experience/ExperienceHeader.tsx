import type { ReactNode } from "react";

/** A consistent heading and nearby actions for the entry and continuation screens. */
export function ExperienceHeader({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
  return (
    <header className="experience-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="experience-heading-actions">{actions}</div>}
    </header>
  );
}
