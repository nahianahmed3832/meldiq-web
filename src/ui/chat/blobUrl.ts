import { text as uiText } from "../../i18n";
import { useEffect, useState } from "react";
import { useEngine } from "../../application/orbit";
import type { AttachmentRef } from "../../protocol/payload";
import { type DownloadProgress, openAttachment } from "../../sync/attachments";
/** An attachment decrypted into an object URL while [enabled] (revoked when no longer shown). */
export function useBlobUrl(
  r: AttachmentRef,
  enabled: boolean,
  trackProgress = false,
): {
  url: string | null;
  error: string | null;
  loading: boolean;
  retry: () => void;
  progress: DownloadProgress | null;
} {
  const engine = useEngine();
  const [attempt, setAttempt] = useState(0);
  const [progress, setProgress] = useState<{ id: string; value: DownloadProgress } | null>(null);
  const [state, setState] = useState<{
    id: string;
    url: string | null;
    error: string | null;
    loading: boolean;
  }>({ id: r.id, url: null, error: null, loading: enabled });
  useEffect(() => {
    if (!enabled) return;
    let url: string | null = null;
    let alive = true;
    setState({ id: r.id, url: null, error: null, loading: true });
    if (trackProgress) setProgress(null);
    openAttachment(engine, r, trackProgress ? (value) => alive && setProgress({ id: r.id, value }) : undefined)
      .then((blob) => {
        if (!alive) return;
        url = URL.createObjectURL(blob);
        setState({ id: r.id, url, error: null, loading: false });
      })
      .catch((e: unknown) => alive && setState({ id: r.id, url: null, error: e instanceof Error ? e.message : uiText("messaging.interface.couldn_t_open_this_file_5ede4a7"), loading: false }));
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [engine, r, enabled, attempt, trackProgress]);
  return {
    url: enabled && state.id === r.id ? state.url : null,
    error: enabled && state.id === r.id ? state.error : null,
    loading: enabled && (state.id !== r.id || state.loading),
    progress: enabled && progress?.id === r.id ? progress.value : null,
    retry: () => setAttempt((n) => n + 1),
  };
}
