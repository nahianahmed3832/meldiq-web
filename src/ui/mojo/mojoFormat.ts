import type { MojoCatalog, PlanKey, ScreenPresetId } from "../../api/mojoSchemas";

/** Money in its currency's minor unit, as the person reads it ("$3.99"). */
export function money(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amountMinor / 100);
}

/** File sizes in decimal units, as the server counts them (50 MB = 50,000,000 bytes; 2 GB). */
export function size(bytes: number): string {
  if (bytes === 1024 * 1_000_000) return "1,024 MB";
  if (bytes >= 1_000_000_000) return `${+(bytes / 1_000_000_000).toFixed(1)} GB`;
  return `${Math.round(bytes / 1_000_000)} MB`;
}

/**
 * "Up to 1080p 60 fps" from a plan's single ceiling (2026-10-30 plans), or "1080p 60 fps or 2K 30 fps" from several (a
 * Spark level's, or an older server's plans).
 */
export function screenLabel(catalog: MojoCatalog | null, presets: readonly ScreenPresetId[]): string {
  if (!presets.length) return "Your own plan's";
  const label = (id: ScreenPresetId) => catalog?.screenPresets.find((p) => p.id === id)?.label ?? id;
  return presets.length === 1 ? `Up to ${label(presets[0]!)}` : presets.map(label).join(" or ");
}

/** The price a plan shows: what's on sale at the payment provider, else its list price ("not on sale yet"). */
export function planPrice(catalog: MojoCatalog | null, key: PlanKey): { label: string; onSale: boolean } {
  if (key === "go") return { label: "Discontinued", onSale: false };
  if (key === "free") return { label: money(0, "USD"), onSale: true };
  const sale = catalog?.onSale[key] ?? null;
  if (sale) return { label: money(sale.amountMinor, sale.currency), onSale: true };
  const list = catalog?.plans.find((p) => p.key === key)?.listPriceMinor ?? 0;
  return { label: money(list, "USD"), onSale: false };
}

/** Characters as people count them (grapheme clusters: an emoji with its skin tone or a flag is one), as the plans do. */
export function countChars(text: string): number {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    let n = 0;
    for (const _ of new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)) n++;
    return n;
  }
  return [...text].length;
}
