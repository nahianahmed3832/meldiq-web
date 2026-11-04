import { X } from "lucide-react";
import { useT } from "../../i18n";
import { text as uiText } from "../../i18n";
import { Localized, useLocaleRender } from "../../i18n/Localized";
import { setPrefs, usePrefs, TEXT_SIZES, type TextSize } from "../../application/prefs";
import { Toggle } from "../components/Toggle";
import { LanguagePreferenceCard } from "../components/LanguagePicker";
import { AccessibilityCard } from "./AppearanceExtras";
const SIZE_KEY = { small: "ap_small", default: "ap_default", large: "ap_large" } as const satisfies Record<TextSize, string>;
export function AccessibilityPage() {
  const prefs = usePrefs();
  const t = useT();
  return (
    <>
      <h1>{t("settings.navigation.accessibility")}</h1>
      <div className="card">
        <div className="setting">
          <div className="lines">
            <strong>{t("ap_text_size")}</strong>
            <small>{t("ap_text_size_sub")}</small>
          </div>
          <div className="segmented" role="group" aria-label={t("ap_text_size")}>
            {TEXT_SIZES.map((ts) => (
              <button key={ts} aria-pressed={prefs.textSize === ts} onClick={() => setPrefs({ textSize: ts })}>
                {t(SIZE_KEY[ts])}
              </button>
            ))}
          </div>
        </div>
        <div className="setting">
          <div className="lines">
            <strong>{t("ap_animoji")}</strong>
            <small>{t("ap_animoji_sub")}</small>
          </div>
          <Toggle label={t("ap_animoji")} checked={prefs.animatedEmoji} onChange={(v) => setPrefs({ animatedEmoji: v })} />
        </div>
      </div>
      <AccessibilityCard />
    </>
  );
}
export function LanguagePage() {
  const t = useT();
  return (
    <>
      <h1>{t("common.language.label")}</h1>
      <LanguagePreferenceCard />
    </>
  );
}
export function ConversationPrivacy() {
  const prefs = usePrefs();
  const t = useT();
  return (
    <>
      <h2 className="settings-group">{t("settings.navigation.privacySignals")}</h2>
      <p className="hint">{t("settings.navigation.privacySignalsDescription")}</p>
      <div className="card">
        <div className="setting">
          <div className="lines">
            <strong>{t("nt_receipts")}</strong>
            <small>{t("nt_receipts_sub")}</small>
          </div>
          <Toggle label={t("nt_receipts")} checked={prefs.readReceipts} onChange={(v) => setPrefs({ readReceipts: v })} />
        </div>
        <div className="setting">
          <div className="lines">
            <strong>{t("nt_typing")}</strong>
            <small>{t("nt_typing_sub")}</small>
          </div>
          <Toggle label={t("nt_typing")} checked={prefs.typing} onChange={(v) => setPrefs({ typing: v })} />
        </div>
      </div>
    </>
  );
}
export function LinkSafetySettings() {
  useLocaleRender();
  const prefs = usePrefs();
  const t = useT();
  return (
    <>
      <h2 className="settings-group">{t("settings.navigation.privacyLinks")}</h2>
      <div className="card">
        <div className="setting">
          <div className="lines">
            <strong>{t("ap_links")}</strong>
            <small>{t("ap_links_sub")}</small>
          </div>
          <Toggle label={t("ap_links")} checked={prefs.askBeforeLinks} onChange={(v) => setPrefs({ askBeforeLinks: v })} />
        </div>
      </div>
      <h2 className="settings-group">
        <Localized k="settings.interface.trusted_sites_ce89700" />
      </h2>
      <div className="card" style={{ padding: 16 }}>
        {prefs.trustedSites.length === 0 ? (
          <p className="faint" style={{ margin: 0 }}>
            <Localized k="settings.interface.links_to_sites_you_trust_open_without_asking_you_haven_t_trusted_ec782f3" />
          </p>
        ) : (
          <ul className="trusted-list" aria-label={uiText("settings.interface.trusted_sites_ce89700")}>
            {prefs.trustedSites.map((h) => (
              <li key={h}>
                <span className="mono ellipsis">{h}</span>
                <button
                  className="icon-btn"
                  aria-label={uiText("settings.interface.stop_trusting_value0_40851f5", { value0: h })}
                  onClick={() => setPrefs({ trustedSites: prefs.trustedSites.filter((x) => x !== h) })}
                >
                  <X size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
