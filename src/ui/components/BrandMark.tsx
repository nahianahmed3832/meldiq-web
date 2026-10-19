import { useId } from "react";
import { BRAND } from "../../app/brand";

/**
 * The Meldiq mark: two strokes melding into an "M" on the deep-green glossy tile the app has always used, with the same
 * mint gradients and top-left shine (so it sits in the existing design system). A provisional mark made for the web
 * rebrand; replace the path when the final logo exists (public/meldiq.svg holds the same drawing).
 */
export function BrandMark({ size = 40, tile = true, title = BRAND.name }: { size?: number; tile?: boolean; title?: string }) {
  const id = useId().replace(/:/g, "");
  const g = (n: string) => `${id}-${n}`;
  return (
    <svg width={size} height={size} viewBox="0 0 108 108" role="img" aria-label={title} style={{ borderRadius: size * 0.26, flexShrink: 0, display: "block" }}>
      <defs>
        <radialGradient id={g("tile")} cx="54" cy="46" r="78" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0F3A2E" />
          <stop offset="0.5" stopColor="#0A231C" />
          <stop offset="1" stopColor="#040A08" />
        </radialGradient>
        <radialGradient id={g("glow")} cx="54" cy="56" r="40" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3EE0A0" stopOpacity="0.28" />
          <stop offset="1" stopColor="#3EE0A0" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={g("left")} x1="28" y1="78" x2="58" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#138F66" />
          <stop offset="0.55" stopColor="#63E3AE" />
          <stop offset="1" stopColor="#D2FCE6" />
        </linearGradient>
        <linearGradient id={g("right")} x1="80" y1="78" x2="50" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#22B47C" />
          <stop offset="0.55" stopColor="#7FF0BF" />
          <stop offset="1" stopColor="#D8FFEC" />
        </linearGradient>
        <radialGradient id={g("dot")} cx="54" cy="50" r="7" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#F4FFF9" />
          <stop offset="0.5" stopColor="#9DF5CD" />
          <stop offset="1" stopColor="#35C487" />
        </radialGradient>
      </defs>
      {tile && <rect x="0" y="0" width="108" height="108" fill={`url(#${g("tile")})`} />}
      <circle cx="54" cy="56" r="40" fill={`url(#${g("glow")})`} />
      <path d="M31 77 V43 Q31 31 42 37 L54 57" stroke={`url(#${g("left")})`} strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M77 77 V43 Q77 31 66 37 L54 57" stroke={`url(#${g("right")})`} strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" fill="none" strokeOpacity="0.92" />
      <circle cx="54" cy="57" r="6.2" fill={`url(#${g("dot")})`} />
      <circle cx="52.4" cy="55.2" r="1.7" fill="#FFFFFF" fillOpacity="0.55" />
    </svg>
  );
}
