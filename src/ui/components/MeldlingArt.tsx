import { MELDLING_ASSETS } from "../../application/brand";

/** Presentation roles reuse the same canonical mascot as the logo. */
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
  return (
    <img
      className={`meldling-art pose-${pose}`}
      src={MELDLING_ASSETS.mark}
      srcSet={MELDLING_ASSETS.srcSet}
      sizes={`${size}px`}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      draggable={false}
      loading="lazy"
    />
  );
}
