import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { CloudOff, CloudUpload } from "lucide-react";
import { useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { AccountApi } from "../../auth/accountApi";
import { useAction, useLoad } from "../workspace/useLoad";
/**
 * Key backup (android Settings › Key backup, server docs/KEY_BACKUP.md): whether a new device can get the account's
 * keys with the password and an emailed code. This browser can turn it off; turning it on needs the keys themselves,
 * which only the phone keeps, so it happens there (or when a device is next set up).
 */
export function KeyBackupCard() {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const offered = useOrbit((s) => s.server?.features.includes("key-backup") ?? false);
  const accounts = new AccountApi(engine.api);
  const [version, setVersion] = useState(0);
  const status = useLoad(() => accounts.keyBackupStatus(), [engine, version]);
  const act = useAction();
  if (!offered) return null;
  const on = status.data?.exists ?? false;
  return (
    <div className="card" style={{ padding: 20, display: "grid", gap: 12 }}>
      <div className="row" style={{ gap: 10, alignItems: "flex-start" }}>
        {on ? <CloudUpload size={18} className="faint" style={{ marginTop: 2 }} /> : <CloudOff size={18} className="faint" style={{ marginTop: 2 }} />}
        <div className="grow" style={{ display: "grid", gap: 4 }}>
          <strong>
            <Localized k="settings.interface.key_backup_eb1d473" />
          </strong>
          <span className="muted" style={{ fontSize: 13 }}>
            <Localized k="settings.interface.your_keys_are_locked_with_your_password_before_they_leave_your_de_45d1975" />
          </span>
          <span style={{ fontSize: 13 }}>
            {!status.data
              ? l10n("common.common_checking")
              : on
                ? uiText("settings.interface.on_a_new_device_needs_your_password_and_a_code_sent_to_your_email_7baf52f")
                : uiText("settings.interface.off_a_new_device_needs_your_recovery_key_or_your_phone_turn_it_on_68f7d6d")}
          </span>
        </div>
      </div>
      {act.error && (
        <div className="banner danger" role="alert">
          {act.error}
        </div>
      )}
      {on && (
        <div className="row" style={{ gap: 8 }}>
          <button
            className="btn btn-secondary btn-sm"
            disabled={act.busy}
            onClick={() =>
              void act.act(async () => {
                await accounts.removeKeyBackup();
                setVersion((v) => v + 1);
              })
            }
          >
            {act.busy ? uiText("settings.interface.turning_off_c62412a") : uiText("settings.interface.turn_off_key_backup_5ee961e")}
          </button>
        </div>
      )}
    </div>
  );
}
