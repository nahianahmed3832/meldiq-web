import { BRAND } from "../../application/brand";

/**
 * Meldling, Meldiq's mascot, from the one canonical asset (brand/meldling.png, cropped and scaled by
 * scripts/render-brand-assets.mjs). Its deep-teal square is part of the art, so it sits on any surface as a rounded
 * badge; the product is still named Meldiq, so the label stays the product's name.
 */
export function BrandMark({ size = 40, title = BRAND.name }: { size?: number; title?: string }) {
  return (
    <img
      className="brand-mark"
      src="/meldling-128.png"
      srcSet="/meldling-128.png 128w, /meldling-256.png 256w"
      sizes={`${size}px`}
      width={size}
      height={size}
      alt={title}
      draggable={false}
      style={{ borderRadius: Math.round(size * 0.24) }}
    />
  );
}
