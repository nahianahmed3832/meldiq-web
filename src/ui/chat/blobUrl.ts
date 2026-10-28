import { useEffect, useState } from "react";
import { useEngine } from "../../application/orbit";
import type { AttachmentRef } from "../../protocol/payload";
import { openAttachment } from "../../sync/attachments";

/** An attachment decrypted into an object URL while [enabled] (revoked when no longer shown). */
export function useBlobUrl(r: AttachmentRef, enabled: boolean): { url: string | null; error: string | null; loading: boolean } {
  const engine = useEngine();
  const [state, setState] = useState<{ url: string | null; error: string | null; loading: boolean }>({ url: null, error: null, loading: enabled });
  useEffect(() => {
    if (!enabled) return;
    let url: string | null = null;
    let alive = true;
    setState({ url: null, error: null, loading: true });
    openAttachment(engine, r)
      .then((blob) => {
        if (!alive) return;
        url = URL.createObjectURL(blob);
        setState({ url, error: null, loading: false });
      })
      .catch((e: unknown) => alive && setState({ url: null, error: e instanceof Error ? e.message : "Couldn't open this file.", loading: false }));
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [engine, r, enabled]);
  return state;
}
