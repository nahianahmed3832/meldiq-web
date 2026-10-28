import { HardDrive, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { bytes } from "../format";

interface StorageState {
  usage: number | null;
  quota: number | null;
  persisted: boolean | null;
}

/**
 * What this browser keeps (android StorageScreen): this device's keys, its messages and session, all in the site's own
 * storage. Browsers may clear "best-effort" storage when the disk fills up, which would remove this device and need it set
 * up again; asking for persistent storage prevents that where the browser allows it. Nothing here is sent anywhere.
 */
export function StoragePage() {
  const [state, setState] = useState<StorageState>({ usage: null, quota: null, persisted: null });
  const [asking, setAsking] = useState(false);
  const [refused, setRefused] = useState(false);
  const supported = typeof navigator !== "undefined" && !!navigator.storage;

  const load = useCallback(async () => {
    if (!supported) return;
    const [estimate, persisted] = await Promise.all([navigator.storage.estimate().catch(() => null), navigator.storage.persisted?.().catch(() => null) ?? null]);
    setState({ usage: estimate?.usage ?? null, quota: estimate?.quota ?? null, persisted });
  }, [supported]);

  useEffect(() => {
    void load();
  }, [load]);

  const persist = async () => {
    setAsking(true);
    try {
      const granted = (await navigator.storage.persist?.()) ?? false;
      setRefused(!granted);
      await load();
    } finally {
      setAsking(false);
    }
  };

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
        <div className="setting">
          <ShieldCheck size={18} className="faint" />
          <div className="lines">
            <strong>Keep this browser's data</strong>
            <small>
              {state.persisted
                ? "Kept: the browser won't clear this device's keys and messages to free space."
                : "Not kept yet: if the disk fills up, the browser may clear this site's data, and this browser would need setting up again (sign in, then your recovery key or your phone's approval)."}
            </small>
            {refused && !state.persisted && <small style={{ color: "var(--warning)" }}>The browser said no. Some browsers only allow it for sites you visit often or have installed as an app.</small>}
          </div>
          {supported && !state.persisted && (
            <button className="btn btn-secondary btn-sm" disabled={asking} onClick={() => void persist()}>
              {asking ? "Asking…" : "Keep data"}
            </button>
          )}
        </div>
      </div>
      <p className="faint" style={{ margin: 0, fontSize: 12.5 }}>
        Files you open are decrypted in memory and not kept. Signing this browser out (Privacy &amp; security) removes everything here; your chats stay backed up on your server and come back when you
        sign in.
      </p>
    </>
  );
}
