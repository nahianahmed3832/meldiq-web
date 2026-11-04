import { useLocaleRender } from "../../i18n/Localized";
import { Check, Languages, Search } from "lucide-react";
import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { usePrefs } from "../../application/prefs";
import { LANGUAGE_NAMES, LANGUAGES, useT, type LanguageChoice } from "../../i18n";
import { directionOf } from "../../i18n/languages";
import { chooseLanguage, useLanguageStatus } from "../../i18n/preferences";
import { Dialog } from "./Overlay";
const normalize = (value: string) => value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
export function matchingLanguages(query: string) {
  const text = normalize(query.trim());
  return LANGUAGES.filter((locale) => normalize(`${LANGUAGE_NAMES[locale]} ${locale}`).includes(text));
}
/** Native names, a searchable list and keyboard navigation, shared by onboarding and account preferences. */
export function LanguagePicker({ className = "" }: { className?: string }) {
  useLocaleRender();
  const { language } = usePrefs();
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={`lang-picker ${className}`.trim()} aria-label={t("common.language.label")} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        <Languages size={16} aria-hidden="true" />
        <span lang={language === "system" ? undefined : language} dir="auto">
          {language === "system" ? t("common.language.system") : LANGUAGE_NAMES[language]}
        </span>
      </button>
      {open && <LanguageDialog onClose={() => setOpen(false)} />}
    </>
  );
}
/** Also opened by a menu item after its parent menu closes, preserving Escape and focus behavior. */
export function LanguageDialog({ onClose }: { onClose: () => void }) {
  useLocaleRender();
  const { language } = usePrefs();
  const t = useT();
  const [query, setQuery] = useState("");
  const id = useId();
  const { status, requested } = useLanguageStatus();
  const busy = status === "loading";
  const results = useMemo(() => matchingLanguages(query), [query]);
  const options: LanguageChoice[] = query.trim() ? results : ["system", ...results];
  const select = async (choice: LanguageChoice) => {
    if (await chooseLanguage(choice)) {
      onClose();
    }
  };
  const move = (event: KeyboardEvent<HTMLElement>) => {
    if (event.currentTarget instanceof HTMLInputElement && ["Home", "End"].includes(event.key)) return;
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const list = document.getElementById(id);
    const buttons = [...(list?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? [])];
    if (!buttons.length) return;
    event.preventDefault();
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : event.key === "ArrowDown" ? (index + 1) % buttons.length : (index <= 0 ? buttons.length : index) - 1;
    buttons[next].focus();
  };
  const statusKey =
    status === "failed"
      ? "common.language.failed"
      : status === "loading"
        ? "common.language.loading"
        : status === "saved"
          ? "common.language.saved"
          : status === "syncing"
            ? "common.language.syncing"
            : "common.language.local";
  return (
    <Dialog title={t("common.language.label")} onClose={onClose} width="min(460px, calc(100vw - 24px))">
      <div className="language-dialog" aria-busy={busy}>
        <label className="language-search">
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">{t("common.language.search")}</span>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("common.language.search")} aria-controls={id} onKeyDown={move} data-autofocus />
        </label>
        <div id={id} role="listbox" aria-label={t("common.language.label")} className="language-list" onKeyDown={move}>
          {options.map((choice) => (
            <button type="button" role="option" key={choice} aria-selected={language === choice} disabled={busy} onClick={() => void select(choice)}>
              <span lang={choice === "system" ? undefined : choice} dir={choice === "system" ? "auto" : directionOf(choice)}>
                {choice === "system" ? t("common.language.system") : LANGUAGE_NAMES[choice]}
              </span>
              {language === choice && <Check size={17} aria-hidden="true" />}
              {busy && requested === choice && <span className="language-spinner" aria-hidden="true" />}
            </button>
          ))}
          {!options.length && <p className="muted">{t("common.language.noResults")}</p>}
        </div>
        <p className="muted language-state" role={status === "failed" ? "alert" : "status"}>
          {t(statusKey)}
        </p>
        <small className="muted">{t("common.language.note")}</small>
      </div>
    </Dialog>
  );
}
export function LanguagePreferenceCard() {
  useLocaleRender();
  const t = useT();
  return (
    <div className="card language-preference">
      <div>
        <p className="muted">{t("common.language.note")}</p>
      </div>
      <LanguagePicker />
    </div>
  );
}
