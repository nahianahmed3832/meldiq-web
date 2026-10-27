/**
 * Vibes (Settings › Appearance › Colour themes, 2026-10-28): a gradient that tints the whole app, from Meldiq's presets
 * or two or three colours of your own, at the strength you choose. Drawn as one soft layer over the app (styles/
 * settings.css), so text keeps its contrast and every theme, light or dark, keeps working.
 */
export const VIBES: { id: string; label: string; colors: string[] }[] = [
  { id: "mint-wave", label: "Mint wave", colors: ["#6ee7b7", "#38bdf8"] },
  { id: "peach", label: "Peach", colors: ["#fdba74", "#fde68a"] },
  { id: "lavender", label: "Lavender", colors: ["#a5b4fc", "#c4b5fd"] },
  { id: "cotton", label: "Cotton candy", colors: ["#f9a8d4", "#fcd34d"] },
  { id: "tangerine", label: "Tangerine", colors: ["#fb923c", "#fbbf24"] },
  { id: "lilac", label: "Lilac", colors: ["#e879f9", "#93c5fd"] },
  { id: "seafoam", label: "Seafoam", colors: ["#67e8f9", "#86efac"] },
  { id: "sand", label: "Sand", colors: ["#d9c48a", "#a3b18a"] },
  { id: "coral", label: "Coral", colors: ["#fb7185", "#fb923c"] },
  { id: "sky-grape", label: "Sky grape", colors: ["#22d3ee", "#c084fc"] },
  { id: "jade", label: "Jade", colors: ["#10b981", "#0ea5e9"] },
  { id: "ruby", label: "Ruby", colors: ["#be123c", "#7f1d1d"] },
  { id: "indigo", label: "Indigo night", colors: ["#6366f1", "#7c3aed"] },
  { id: "rust", label: "Rust", colors: ["#c2410c", "#9a3412"] },
  { id: "dusk", label: "Dusk", colors: ["#8b5cf6", "#d946ef"] },
  { id: "lagoon", label: "Lagoon", colors: ["#06b6d4", "#3b82f6"] },
  { id: "sunset", label: "Sunset", colors: ["#f43f5e", "#f59e0b"] },
  { id: "aurora", label: "Aurora", colors: ["#2dd4bf", "#6366f1"] },
  { id: "neon", label: "Neon", colors: ["#e879f9", "#22d3ee"] },
  { id: "deep-sea", label: "Deep sea", colors: ["#1e40af", "#1e3a8a"] },
];

export const HEX = /^#[0-9a-f]{6}$/i;

/** The colours a vibe choice paints with, or null for none. */
export function vibeColors(vibe: string | null, custom: string[] | null): string[] | null {
  if (vibe === "custom") return custom && custom.length >= 2 && custom.length <= 3 && custom.every((c) => HEX.test(c)) ? custom : null;
  return VIBES.find((v) => v.id === vibe)?.colors ?? null;
}

/** Sets (or clears) the tint on the page: a gradient and a strength the stylesheet reads. */
export function applyVibe(root: HTMLElement, vibe: string | null, custom: string[] | null, strength: number): void {
  const colors = vibeColors(vibe, custom);
  if (!colors) {
    root.removeAttribute("data-vibe");
    root.style.removeProperty("--vibe");
    root.style.removeProperty("--vibe-strength");
    return;
  }
  root.setAttribute("data-vibe", "on");
  root.style.setProperty("--vibe", `linear-gradient(135deg, ${colors.join(", ")})`);
  root.style.setProperty("--vibe-strength", String(Math.max(0, Math.min(100, strength)) / 100));
}
