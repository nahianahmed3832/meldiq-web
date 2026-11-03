import { useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { useLanguage } from "./index";
import { directionOf } from "./languages";
import { catalogVersion, messagesFor, prepareLocale, subscribeCatalog } from "./runtime";
/** The exported shell has no private data. This provider is mounted inside the existing client-only root. */
export function LocalizationProvider({ children }: { children: ReactNode }) {
  const language = useLanguage();
  const version = useSyncExternalStore(subscribeCatalog, catalogVersion, () => 0);
  const messages = useMemo(() => {
    void version;
    return messagesFor(language);
  }, [language, version]);
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = directionOf(language);
    void prepareLocale(language).catch(() => undefined);
  }, [language]);
  return (
    <NextIntlClientProvider
      locale={language}
      messages={messages}
      onError={(error) => {
        // eslint-disable-next-line no-console -- Surface ICU errors in development without interpolation values.
        if (process.env.NODE_ENV !== "production") console.warn("[i18n]", error.code);
      }}
    >
      {children}
    </NextIntlClientProvider>
  );
}
