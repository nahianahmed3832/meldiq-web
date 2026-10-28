/** Meldling's illustrated poses (brand/meldling/, rendered by scripts/render-brand-assets.mjs into public/meldling/). */
export type MeldlingPose = "hello" | "gaming" | "all-set" | "loading" | "waving" | "confused" | "love";

interface MeldlingArtProps {
  pose: MeldlingPose;
  /** Rendered width in CSS pixels. */
  size?: number;
}

/**
 * Meldling in an empty or status screen (the owner's mascot set, 2026-10-29): decorative, so screen readers skip it;
 * the screen's own heading says what's going on.
 */
export function MeldlingArt({ pose, size = 160 }: MeldlingArtProps) {
  return <img className={`meldling-art pose-${pose}`} src={`/meldling/${pose}.webp`} width={size} alt="" aria-hidden="true" draggable={false} loading="lazy" />;
}
