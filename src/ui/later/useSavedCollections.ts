import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiClient } from "../../api/client";
import { getSavedCollections, updateSavedCollection, type CollectionOp, type SavedCollection } from "../../sync/savedCollections";
import { localizedError } from "../../i18n/errors";
import { useT } from "../../i18n";

/** A successful mutation supplies the authoritative list; an older GET must not overwrite it. */
export function useSavedCollections(api: ApiClient, enabled: boolean, revision: unknown) {
  const t = useT();
  const [data, setData] = useState<SavedCollection[] | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [failure, setFailure] = useState<unknown>(null);
  const epoch = useRef({ value: 0 }).current;
  const alive = useRef(false);
  // Capabilities arrive after the cached shell. An unsupported placeholder is not a loaded collection list.
  useEffect(() => {
    setData(null);
  }, [api, enabled]);
  const reload = useCallback(() => {
    const request = ++epoch.value;
    setLoading(enabled);
    setFailure(null);
    if (!enabled) {
      setData([]);
      return;
    }
    void getSavedCollections(api)
      .then(
        (next) => {
          if (alive.current && request === epoch.value) setData(next);
        },
        (error: unknown) => {
          if (alive.current && request === epoch.value) setFailure(error);
        },
      )
      .finally(() => {
        if (alive.current && request === epoch.value) setLoading(false);
      });
  }, [api, enabled, epoch]);
  useEffect(() => {
    alive.current = true;
    reload();
    return () => {
      alive.current = false;
      epoch.value++;
    };
  }, [reload, revision, epoch]);
  const mutate = async (op: CollectionOp) => {
    epoch.value++;
    setLoading(false);
    const next = await updateSavedCollection(api, op);
    if (!alive.current) return;
    epoch.value++;
    setData(next);
    setFailure(null);
    setLoading(false);
  };
  return { data, loading, error: failure === null ? null : localizedError(failure, t), reload, mutate };
}
