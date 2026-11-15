import { text as uiText } from "../../i18n";
import type { MojoCatalog, PlanKey, PlusTerm } from "../../api/mojoSchemas";
import { videoTier, videoTierLabel } from "../../call/shareQuality";
import { formatCurrency, formatNumber } from "../../i18n/format";
/** Money in its currency's minor unit, as the person reads it ("$3.99"). */
export function money(amountMinor: number, currency: string): string {
  return formatCurrency(amountMinor / 100, currency);
}
/** File sizes in decimal units, as the server counts them (50 MB = 50,000,000 bytes; 2 GB). */
export function size(bytes: number): string {
  if (bytes === 1024 * 1000000) return uiText("files.interface.value0_mb_36c07a7", { value0: formatNumber(1024) });
  if (bytes >= 1000000000) return uiText("files.interface.value0_gb_02d50f1", { value0: formatNumber(+(bytes / 1000000000).toFixed(1)) });
  return uiText("files.interface.value0_mb_36c07a7", { value0: formatNumber(Math.round(bytes / 1000000)) });
}
export function planVideoLabel(plan: PlanKey): string {
  return uiText("billing.interface.up_to_value0_d22d804", { value0: videoTierLabel(videoTier(plan)) });
}
/** The price a plan shows: what's on sale at the payment provider, else its list price ("not on sale yet"). */
export function planPrice(
  catalog: MojoCatalog | null,
  key: PlanKey,
): {
  label: string;
  onSale: boolean;
} {
  if (key === "go")
    return {
      get label() {
        return uiText("billing.interface.discontinued_c095a14");
      },
      onSale: false,
    };
  if (key === "free") return { label: money(0, "USD"), onSale: true };
  const sale = catalog?.onSale[key] ?? null;
  if (sale) return { label: money(sale.amountMinor, sale.currency), onSale: true };
  const list = catalog?.plans.find((p) => p.key === key)?.listPriceMinor ?? 0;
  return { label: money(list, "USD"), onSale: false };
}
export function plusTermPrice(catalog: MojoCatalog | null, term: PlusTerm["key"]) {
  if (!catalog) return null;
  return term === "monthly" ? catalog.onSale.plus : (catalog.plusTerms.find((offer) => offer.key === term && offer.available) ?? null);
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
