import { useLanguage } from "../../i18n";
import { useEffect } from "react";
import { shallowEqual, useOrbit } from "../../application/orbit";
import { badgeText, paintFavicon, tabSignal, tabTitle, TAB_TITLE } from "../../application/tabBadge";

/** Keeps the tab's title and favicon in step with what's unread (application/tabBadge.ts); restores both on sign-out. */
export function TabIndicators() {
  const language = useLanguage();
  const signal = useOrbit(tabSignal, shallowEqual);
  useEffect(() => {
    document.title = tabTitle(signal);
    void paintFavicon(badgeText(signal));
  }, [signal, language]);
  useEffect(
    () => () => {
      document.title = TAB_TITLE;
      void paintFavicon(null);
    },
    [],
  );
  return null;
}
