import { BRAND } from "../../app/brand";

/**
 * The Meldiq logo, from the one authoritative source (brand/meldiq-logo.webp, cropped and scaled by
 * scripts/render-brand-assets.ts). The navy ground is part of the logo, so it sits on any surface without a backing.
 */
export function BrandMark({ size = 40, title = BRAND.name }: { size?: number; title?: string }) {
  return (
    <img
      className="brand-mark"
      src="/meldiq-mark-128.png"
      srcSet="/meldiq-mark-128.png 128w, /meldiq-mark-256.png 256w"
      sizes={`${size}px`}
      width={size}
      height={size}
      alt={title}
      draggable={false}
      style={{ borderRadius: Math.round(size * 0.24) }}
    />
  );
}
