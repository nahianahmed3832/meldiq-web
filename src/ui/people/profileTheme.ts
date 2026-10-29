import type { CSSProperties } from "react";
import type { ProfileStyle } from "../../api/profileSchemas";

/**
 * Profile themes (API 0.65.0): one colour, or two for a gradient, that colour a person's profile card and its banner
 * when they have no banner picture. Servers before 0.65.0 only know one accent colour, which reads as a one-colour
 * theme. The presets are Meldiq's own pairs; the server only stores colours.
 */

export const THEME_PRESETS: { id: string; label: string; colors: [string, string] }[] = [
  { id: "sunset", label: "Sunset", colors: ["#ff7e5f", "#feb47b"] },
  { id: "ocean", label: "Ocean", colors: ["#2193b0", "#6dd5ed"] },
  { id: "grape", label: "Grape", colors: ["#8e2de2", "#4a00e0"] },
  { id: "mint", label: "Mint", colors: ["#43e97b", "#38f9d7"] },
  { id: "midnight", label: "Midnight", colors: ["#0f2027", "#2c5364"] },
  { id: "cherry", label: "Cherry", colors: ["#eb3349", "#f45c43"] },
  { id: "gold", label: "Gold", colors: ["#f7971e", "#ffd200"] },
  { id: "aurora", label: "Aurora", colors: ["#00c9ff", "#92fe9d"] },
  { id: "rose", label: "Rose", colors: ["#f472b6", "#fda4af"] },
  { id: "forest", label: "Forest", colors: ["#134e5e", "#71b280"] },
  { id: "neon", label: "Neon", colors: ["#fc00ff", "#00dbde"] },
  { id: "candy", label: "Candy", colors: ["#f9a8d4", "#a78bfa"] },
];

/** Someone's theme: their theme colours, else their accent (older servers and apps), else none. */
export function themeColorsOf(style: Pick<ProfileStyle, "accent" | "themeColors"> | null | undefined): string[] | null {
  if (style?.themeColors?.length) return style.themeColors;
  return style?.accent ? [style.accent] : null;
}

/** The CSS background for theme colours: a solid colour, or a gradient across two. */
export function themeBackground(colors: readonly string[]): string {
  return colors.length > 1 ? `linear-gradient(135deg, ${colors.join(", ")})` : colors[0];
}

/** Whether [colors] is exactly this preset (presets are stored as their colours, lower case). */
export const isPreset = (colors: readonly string[] | null, preset: readonly string[]): boolean => !!colors && colors.length === preset.length && colors.every((c, i) => c.toLowerCase() === preset[i]);

/** The card's tint (styles/settings-parity.css, .themed): its two colours as CSS variables; one colour is used twice. */
export function themeVars(colors: readonly string[] | null): CSSProperties | undefined {
  if (!colors?.length) return undefined;
  return { "--theme-a": colors[0], "--theme-b": colors[colors.length - 1] } as CSSProperties;
}
