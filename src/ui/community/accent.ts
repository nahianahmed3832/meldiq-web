import type { CSSProperties } from "react";

/**
 * A community's accent colour (API 0.44.0, meldiq docs/COMMUNITY_BRANDING.md), made safe to use: whatever colour was
 * picked, text in it stays readable on Meldiq's light and dark surfaces, and text on it is black or white, whichever
 * reads better. Only "#rrggbb" is accepted; anything else means Meldiq's own theme.
 */
const HEX = /^#[0-9a-f]{6}$/i;

/** Suggested accents (Meldiq's palette, bright enough for both themes), offered first in Community settings. */
export const ACCENT_PRESETS: { hex: string; name: string }[] = [
  { hex: "#22d3ee", name: "Cyan" },
  { hex: "#3b82f6", name: "Blue" },
  { hex: "#6366f1", name: "Indigo" },
  { hex: "#8b5cf6", name: "Violet" },
  { hex: "#ec4899", name: "Pink" },
  { hex: "#f43f5e", name: "Rose" },
  { hex: "#f97316", name: "Orange" },
  { hex: "#facc15", name: "Yellow" },
  { hex: "#22c55e", name: "Green" },
  { hex: "#14b8a6", name: "Teal" },
];

/** The surfaces accent text has to read on (tokens.css, Meldiq palette). */
const LIGHT_SURFACE = "#ffffff";
const DARK_SURFACE = "#10172b";
/** WCAG AA for normal text. */
const MIN_TEXT_CONTRAST = 4.5;

export function isAccent(v: unknown): v is string {
  return typeof v === "string" && HEX.test(v);
}

type Rgb = [number, number, number];

function rgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b]
    .map((c) =>
      Math.round(Math.min(255, Math.max(0, c)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/** WCAG relative luminance. */
export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function mix(a: string, b: string, t: number): string {
  const [x, y] = [rgb(a), rgb(b)];
  return toHex([0, 1, 2].map((i) => x[i] + (y[i] - x[i]) * t) as Rgb);
}

/** [hex] moved towards [toward] just enough to reach [min] contrast against [surface]. */
function readableAgainst(hex: string, surface: string, toward: string, min = MIN_TEXT_CONTRAST): string {
  for (let t = 0; t <= 1; t += 0.05) {
    const c = mix(hex, toward, t);
    if (contrast(c, surface) >= min) return c;
  }
  return toward;
}

/** Black or white, whichever reads better on [hex]. */
export function onAccent(hex: string): string {
  return contrast(hex, "#ffffff") >= contrast(hex, "#0b1020") ? "#ffffff" : "#0b1020";
}

export interface AccentColors {
  /** The colour as picked (a mid-tone nudged until its label reads): fills, bars, rings. */
  fill: string;
  /** Text and icons on [fill]. */
  on: string;
  /** Text in the accent on a light surface, and on a dark one. */
  textLight: string;
  textDark: string;
}

export function accentColors(hex: string): AccentColors {
  const picked = hex.toLowerCase();
  const on = onAccent(picked);
  // A mid-tone reads poorly with black and white alike: deepen (or lighten) it just enough for its label.
  const fill = readableAgainst(picked, on, on === "#ffffff" ? "#000000" : "#ffffff");
  return {
    fill,
    on,
    textLight: readableAgainst(fill, LIGHT_SURFACE, "#000000"),
    textDark: readableAgainst(fill, DARK_SURFACE, "#ffffff"),
  };
}

/** The class that turns a scoped accent's variables into colours (community.css .c-accent). */
export const ACCENT_CLASS = "c-accent";

/**
 * The CSS variables that scope a community's accent to one element and its children (never :root, so it can't leak
 * into another community or Meldiq's own theme); used with [ACCENT_CLASS]. Empty without an accent: the element keeps
 * Meldiq's colours. Plain colours only (no light-dark() or color-mix()), so older Safari shows them too.
 */
export function accentStyle(accent: string | null | undefined): CSSProperties {
  if (!isAccent(accent)) return {};
  const c = accentColors(accent);
  const [r, g, b] = rgb(c.fill);
  return {
    "--c-accent": c.fill,
    "--c-on-accent": c.on,
    "--c-accent-text-l": c.textLight,
    "--c-accent-text-d": c.textDark,
    "--c-accent-soft": `rgba(${r}, ${g}, ${b}, 0.18)`,
  } as CSSProperties;
}

/** A banner stand-in from the accent (a soft two-stop gradient), for communities without a banner image. */
export function accentBand(accent: string): string {
  return `linear-gradient(120deg, ${accent}, ${mix(accent, "#8b5cf6", 0.55)})`;
}
