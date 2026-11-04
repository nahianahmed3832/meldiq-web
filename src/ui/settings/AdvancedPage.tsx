import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { setPrefs, usePrefs } from "../../application/prefs";
import { Toggle } from "../components/Toggle";
/**
 * Settings › Advanced (2026-10-28): Builder mode adds Copy ID to the menus of communities, channels, messages and
 * people, for people building bots and tools; trusted sites open their links without asking (Appearance › Ask before
 * opening links), except links that look misleading, which always ask. Both are this browser's own.
 */
export function AdvancedPage() {
  useLocaleRender();
  const l10n = useLocalization();
  const prefs = usePrefs();
  return (
    <>
      <h1>{l10n("settings.settings_advanced")}</h1>
      <div className="card">
        <div className="setting">
          <div className="lines">
            <strong>
              <Localized k="settings.interface.builder_mode_63a2447" />
            </strong>
            <small>
              <Localized k="settings.interface.adds_copy_id_to_the_right_click_menus_of_communities_channels_mes_bafbdc8" />
            </small>
          </div>
          <Toggle label={uiText("settings.interface.builder_mode_63a2447")} checked={prefs.builderMode} onChange={(v) => setPrefs({ builderMode: v })} />
        </div>
      </div>
    </>
  );
}
