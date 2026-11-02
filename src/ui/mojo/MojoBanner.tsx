import type { ReactNode } from "react";

interface MojoBannerProps {
  icon: ReactNode;
  title: string;
  line: string;
}

/**
 * A plan's banner in the app's own design (owner, 2026-10-30: the illustrated posters "should go with the UI design"):
 * an icon tile in the palette's accent, the name and one line, on the Meldiq Plus page's surface.
 */
export function MojoBanner({ icon, title, line }: MojoBannerProps) {
  return (
    <div className="mojo-banner">
      <span className="mojo-banner-icon" aria-hidden="true">
        {icon}
      </span>
      <div>
        <strong>{title}</strong>
        <span>{line}</span>
      </div>
    </div>
  );
}
