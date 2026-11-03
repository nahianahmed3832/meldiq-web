import { text as uiText } from "../i18n";
/**
 * Vibes (Settings › Appearance › Colour themes, 2026-10-28): a gradient that tints the whole app, from Meldiq's presets
 * or two or three colours of your own, at the strength you choose. Drawn as one soft layer over the app (styles/
 * settings.css), so text keeps its contrast and every theme, light or dark, keeps working.
 */
export const VIBES: {
  id: string;
  label: string;
  colors: string[];
}[] = [
  {
    id: "mint-wave",
    get label() {
      return uiText("workspace.interface.mint_wave_188b10c");
    },
    colors: ["#6ee7b7", "#38bdf8"],
  },
  {
    id: "peach",
    get label() {
      return uiText("workspace.interface.peach_2b1f3f0");
    },
    colors: ["#fdba74", "#fde68a"],
  },
  {
    id: "lavender",
    get label() {
      return uiText("workspace.interface.lavender_60707cf");
    },
    colors: ["#a5b4fc", "#c4b5fd"],
  },
  {
    id: "cotton",
    get label() {
      return uiText("workspace.interface.cotton_candy_a786adf");
    },
    colors: ["#f9a8d4", "#fcd34d"],
  },
  {
    id: "tangerine",
    get label() {
      return uiText("workspace.interface.tangerine_44a41bc");
    },
    colors: ["#fb923c", "#fbbf24"],
  },
  {
    id: "lilac",
    get label() {
      return uiText("workspace.interface.lilac_e3233c6");
    },
    colors: ["#e879f9", "#93c5fd"],
  },
  {
    id: "seafoam",
    get label() {
      return uiText("workspace.interface.seafoam_fb0e74e");
    },
    colors: ["#67e8f9", "#86efac"],
  },
  {
    id: "sand",
    get label() {
      return uiText("workspace.interface.sand_82855c1");
    },
    colors: ["#d9c48a", "#a3b18a"],
  },
  {
    id: "coral",
    get label() {
      return uiText("workspace.interface.coral_56ac628");
    },
    colors: ["#fb7185", "#fb923c"],
  },
  {
    id: "sky-grape",
    get label() {
      return uiText("workspace.interface.sky_grape_38024b3");
    },
    colors: ["#22d3ee", "#c084fc"],
  },
  {
    id: "jade",
    get label() {
      return uiText("workspace.interface.jade_9fbbe98");
    },
    colors: ["#10b981", "#0ea5e9"],
  },
  {
    id: "ruby",
    get label() {
      return uiText("workspace.interface.ruby_108040a");
    },
    colors: ["#be123c", "#7f1d1d"],
  },
  {
    id: "indigo",
    get label() {
      return uiText("workspace.interface.indigo_night_7cd5d7c");
    },
    colors: ["#6366f1", "#7c3aed"],
  },
  {
    id: "rust",
    get label() {
      return uiText("workspace.interface.rust_d9aa89f");
    },
    colors: ["#c2410c", "#9a3412"],
  },
  {
    id: "dusk",
    get label() {
      return uiText("workspace.interface.dusk_abd7160");
    },
    colors: ["#8b5cf6", "#d946ef"],
  },
  {
    id: "lagoon",
    get label() {
      return uiText("workspace.interface.lagoon_d24d90a");
    },
    colors: ["#06b6d4", "#3b82f6"],
  },
  {
    id: "sunset",
    get label() {
      return uiText("settings.interface.sunset_275dbda");
    },
    colors: ["#f43f5e", "#f59e0b"],
  },
  {
    id: "aurora",
    get label() {
      return uiText("settings.interface.aurora_e9de098");
    },
    colors: ["#2dd4bf", "#6366f1"],
  },
  {
    id: "neon",
    get label() {
      return uiText("settings.interface.neon_618484e");
    },
    colors: ["#e879f9", "#22d3ee"],
  },
  {
    id: "deep-sea",
    get label() {
      return uiText("workspace.interface.deep_sea_f0dd863");
    },
    colors: ["#1e40af", "#1e3a8a"],
  },
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
