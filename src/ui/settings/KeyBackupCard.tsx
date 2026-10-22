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
          <strong>Key backup</strong>
          <span className="muted" style={{ fontSize: 13 }}>
            Your keys are locked with your password before they leave your device. The server can't open them on its own, but it does see your password when you sign in, so your recovery key is still
            the strongest way back. Resetting a forgotten password turns the backup off.
          </span>
          <span style={{ fontSize: 13 }}>
            {!status.data
              ? "Checking…"
              : on
                ? "On: a new device needs your password and a code sent to your email."
                : "Off: a new device needs your recovery key or your phone. Turn it on in the phone app (Settings › Key backup)."}
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
            {act.busy ? "Turning off…" : "Turn off key backup"}
          </button>
        </div>
      )}
    </div>
  );
}
