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
        Your messages, files and settings are kept on Meldiq's servers. This browser keeps what signs it in and an encrypted copy of your lists and recent messages, so Meldiq opens at once; signing
        out erases it. Files you open are fetched each time and not kept.
      </p>
    </>
  );
}
