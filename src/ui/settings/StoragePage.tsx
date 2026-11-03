import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { HardDrive } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { bytes } from "../format";
interface StorageState {
  usage: number | null;
  quota: number | null;
  persisted: boolean | null;
}
/**
 * What this browser keeps (android StorageScreen). Since API 0.57.0 messages, files and settings are on Meldiq's servers
 * (docs/SERVER_MESSAGES.md), so there's nothing to keep safe here or to back up. This browser keeps its sign-in and,
 * since 2026-10-30 (the owner), an encrypted snapshot of the last view so reloads open at once (sync/snapshot.ts).
 */
export function StoragePage() {
  useLocaleRender();
  const l10n = useLocalization();
  const [state, setState] = useState<StorageState>({ usage: null, quota: null, persisted: null });
  const supported = typeof navigator !== "undefined" && !!navigator.storage;
  const load = useCallback(async () => {
    if (!supported) return;
    const [estimate, persisted] = await Promise.all([navigator.storage.estimate().catch(() => null), navigator.storage.persisted?.().catch(() => null) ?? null]);
    setState({ usage: estimate?.usage ?? null, quota: estimate?.quota ?? null, persisted });
  }, [supported]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <>
      <h1>{l10n("settings.settings_storage")}</h1>
      <div className="card">
        <div className="setting">
          <HardDrive size={18} className="faint" />
          <div className="lines">
            <strong>
              <Localized k="settings.interface.used_on_this_computer_0804e6f" />
            </strong>
            <small>
              {!supported
                ? uiText("settings.interface.this_browser_doesn_t_report_how_much_it_stores_7f82f98")
                : state.usage === null
                  ? l10n("common.common_checking")
                  : uiText("messaging.interface.value0_value1_82032eb", {
                      value0: bytes(state.usage),
                      value1: state.quota ? uiText("settings.interface.of_the_browser_allows_this_site_1a988ac", { value0: bytes(state.quota) }) : "",
                    })}
            </small>
          </div>
        </div>
      </div>
      <p className="faint" style={{ margin: 0, fontSize: 12.5 }}>
        <Localized k="settings.interface.your_messages_files_and_settings_are_kept_on_meldiq_s_servers_thi_b5c7d7f" />
      </p>
    </>
  );
}
