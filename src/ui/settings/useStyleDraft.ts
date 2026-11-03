import { text as uiText } from "../../i18n";
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
        if (!me) throw new Error(uiText("settings.interface.sign_in_again_before_saving_c8c5571"));
        const profile = await myProfile(engine);
        const latest = profile.profileStyle ?? server;
        for (const k of Object.keys(pending) as (keyof ProfileStyleChange & keyof ProfileStyle)[]) {
          if (baseline.current && !same(latest[k], baseline.current[k]) && !same(latest[k], pending[k]))
            throw new Error(uiText("settings.interface.your_look_changed_on_another_device_reset_your_draft_to_load_it_t_c051945"));
        }
        await setProfileStyle(engine, { ...pending, baseStyleRevision: profile.styleRevision });
        reset();
        onSaved();
      } catch (e) {
        setError(e instanceof ApiError || e instanceof Error ? e.message : uiText("settings.interface.couldn_t_save_your_look_your_draft_is_kept_8c4e4de"));
      } finally {
        setBusy(false);
      }
    },
  };
}
