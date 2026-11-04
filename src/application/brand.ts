/**
 * The product's name as people see it, in one place (Meldiq, formerly Orbit). Internal identifiers keep their old names
 * on purpose: storage keys, database names and protocol labels shared with the Android app must not change
 * (docs/MELDIQ_REBRAND.md › Kept on purpose).
 */
export const BRAND = {
  /** The product. */
  name: "Meldiq",
  mascot: "Meldling",
  /** This app: the browser client. */
  web: "Meldiq Web",
  /** The phone app, as people find it on their phone. */
  phoneApp: "Meldiq",
  /** The company behind it. */
  company: "GriipBuddy",
  /** Shown where people who knew the old name might look for it. */
  formerly: "Orbit",
} as const;

/** The owner's canonical teal/cream Meldling, generated from brand/meldling.png. */
export const MELDLING_ASSETS = {
  mark: "/meldling-128.png",
  srcSet: "/meldling-128.png 128w, /meldling-256.png 256w, /meldling-512.png 512w",
} as const;
