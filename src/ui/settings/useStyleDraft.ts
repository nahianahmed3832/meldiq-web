import { previewLegacyStyle } from "../../sync/collectibles";
import { useMemo, useRef, useState } from "react";
import type { ProfileStyle } from "../../api/schemas";
import { setProfileStyle, type ProfileStyleChange } from "../../sync/account";
import { myProfile } from "../../sync/profile";
import type { Engine } from "../../sync/engine";
import { ApiError } from "../../api/client";
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
export function useStyleDraft(engine: Engine, server: ProfileStyle, onSaved: () => void) {
  const [pending, setPending] = useState<ProfileStyleChange>({});
  const baseline = useRef<ProfileStyle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const undo = useRef<ProfileStyleChange[]>([]);
  const reset = () => {
    setPending({});
    baseline.current = null;
    undo.current = [];
    setError(null);
  };
  return {
    style: useMemo(() => previewLegacyStyle(server, pending), [server, pending]),
    error,
    busy,
    dirty: Object.keys(pending).length > 0,
    save: (change: ProfileStyleChange) => {
      if (busy) return;
      baseline.current ??= server;
      undo.current.push(pending);
      setPending({ ...pending, ...change });
      setError(null);
    },
    reset,
    undo: () => {
      const before = undo.current.pop();
      if (before) setPending(before);
    },
    apply: async () => {
      setBusy(true);
      setError(null);
      try {
        const me = engine.state.get().me;
        if (!me) throw new Error("Sign in again before saving.");
        const profile = await myProfile(engine);
        const latest = profile.profileStyle ?? server;
        for (const k of Object.keys(pending) as (keyof ProfileStyleChange & keyof ProfileStyle)[]) {
          if (baseline.current && !same(latest[k], baseline.current[k]) && !same(latest[k], pending[k]))
            throw new Error("Your look changed on another device. Reset your draft to load it, then apply your changes again.");
        }
        await setProfileStyle(engine, { ...pending, baseStyleRevision: profile.styleRevision });
        reset();
        onSaved();
      } catch (e) {
        setError(e instanceof ApiError || e instanceof Error ? e.message : "Couldn't save your look. Your draft is kept.");
      } finally {
        setBusy(false);
      }
    },
  };
}
