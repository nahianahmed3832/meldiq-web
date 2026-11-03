import { useSyncExternalStore, type ReactNode } from "react";
import { useLanguage } from "./index";
import { catalogVersion, subscribeCatalog, translate, translateRich, type MessageKey } from "./runtime";
import { formatNumber } from "./format";

/** No extra DOM element; a translated sentence keeps the original controls and inline content. */
export function Localized({ k, slots }: { k: MessageKey; slots?: readonly ReactNode[] }) {
  const language = useLanguage();
  useSyncExternalStore(subscribeCatalog, catalogVersion, () => 0);
  return slots
    ? translateRich(
        language,
        k,
        slots.map((slot) => (typeof slot === "number" ? formatNumber(slot, {}, language) : slot)),
      )
    : translate(language, k);
}

/** Subscribe components that render translated attributes or feature metadata. */
export function useLocaleRender(): void {
  useLanguage();
  useSyncExternalStore(subscribeCatalog, catalogVersion, () => 0);
}
