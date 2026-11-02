import { useEffect, useState } from "react";
import { useEngine } from "../../application/orbit";
import type { AttachmentRef } from "../../protocol/payload";
import { openAttachment } from "../../sync/attachments";

/** An attachment decrypted into an object URL while [enabled] (revoked when no longer shown). */
export function useBlobUrl(r: AttachmentRef, enabled: boolean): { url: string | null; error: string | null; loading: boolean; retry: () => void } {
  const engine = useEngine();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ id: string; url: string | null; error: string | null; loading: boolean }>({ id: r.id, url: null, error: null, loading: enabled });
  useEffect(() => {
    if (!enabled) return;
    let url: string | null = null;
    let alive = true;
    setState({ id: r.id, url: null, error: null, loading: true });
    openAttachment(engine, r)
      .then((blob) => {
        if (!alive) return;
        url = URL.createObjectURL(blob);
        setState({ id: r.id, url, error: null, loading: false });
      })
      .catch((e: unknown) => alive && setState({ id: r.id, url: null, error: e instanceof Error ? e.message : "Couldn't open this file.", loading: false }));
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [engine, r, enabled, attempt]);
  return {
    url: enabled && state.id === r.id ? state.url : null,
    error: enabled && state.id === r.id ? state.error : null,
    loading: enabled && (state.id !== r.id || state.loading),
    retry: () => setAttempt((n) => n + 1),
  };
}
