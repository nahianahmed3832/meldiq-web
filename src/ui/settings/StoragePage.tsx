import { HardDrive } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { bytes } from "../format";

interface StorageState {
  usage: number | null;
  quota: number | null;
  persisted: boolean | null;
}

/**
 * What this browser keeps (android StorageScreen). Since API 0.57.0 only its sign-in: messages, files and settings are
 * on Meldiq's servers (docs/SERVER_MESSAGES.md), so there's nothing to keep safe here or to back up.
 */
export function StoragePage() {
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
      <h1>Storage</h1>
      <div className="card">
        <div className="setting">
          <HardDrive size={18} className="faint" />
          <div className="lines">
            <strong>Used on this computer</strong>
            <small>
              {!supported
                ? "This browser doesn't report how much it stores."
                : state.usage === null
                  ? "Checking…"
                  : `${bytes(state.usage)}${state.quota ? ` of ${bytes(state.quota)} the browser allows this site` : ""}`}
            </small>
          </div>
        </div>
      </div>
      <p className="faint" style={{ margin: 0, fontSize: 12.5 }}>
        Your messages, files and settings are kept on Meldiq's servers, not on this computer: this browser keeps only what signs it in. Files you open are fetched each time and not kept.
      </p>
    </>
  );
}
