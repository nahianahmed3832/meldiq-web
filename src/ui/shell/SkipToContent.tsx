import { useT } from "../../i18n";

export function SkipToContent() {
  const t = useT();
  return (
    <button
      type="button"
      className="skip-to-content"
      onClick={() => {
        const target = [".settings-window .settings-page h1", ".body > .main h1", ".body > .main", ".sidebar h2", ".sidebar"]
          .flatMap((selector) => [...document.querySelectorAll<HTMLElement>(selector)])
          .find((element) => element.getClientRects().length > 0 && !element.closest("[inert]"));
        if (!target) return;
        target.tabIndex = -1;
        target.focus({ preventScroll: true });
      }}
    >
      {t("common.navigation.skipToContent")}
    </button>
  );
}
