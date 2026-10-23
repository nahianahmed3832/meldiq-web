import { Languages } from "lucide-react";
import { setPrefs, usePrefs } from "../../application/prefs";
import { LANGUAGE_NAMES, LANGUAGES, type LanguageChoice, useT } from "../../i18n";

/** The interface language: the browser's, English, 简体中文 or বাংলা. On the sign-in screens and in Settings › Appearance. */
export function LanguagePicker({ className = "" }: { className?: string }) {
  const { language } = usePrefs();
  const t = useT();
  return (
    <label className={`lang-picker ${className}`.trim()}>
      <Languages size={15} aria-hidden="true" />
      <select aria-label={t("lang_label")} value={language} onChange={(e) => setPrefs({ language: e.target.value as LanguageChoice })}>
        <option value="system">{t("lang_system")}</option>
        {LANGUAGES.map((l) => (
          <option key={l} value={l} lang={l}>
            {LANGUAGE_NAMES[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
