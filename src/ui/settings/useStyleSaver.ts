import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "../../api/client";
import type { ProfileStyle } from "../../api/schemas";
import type { Engine } from "../../sync/engine";
import { setProfileStyle, type ProfileStyleChange } from "../../sync/account";

type Key = keyof ProfileStyleChange & keyof ProfileStyle;

const same = (a: unknown, b: unknown): boolean => (Array.isArray(a) || Array.isArray(b) ? JSON.stringify(a ?? null) === JSON.stringify(b ?? null) : a === b);

interface StyleSaver {
  /** The style to draw: what the server has, with the picks still on their way over it. */
  style: ProfileStyle;
  save: (change: ProfileStyleChange) => void;
  error: string | null;
}

/**
 * Profile and name style picks (the owner, 2026-10-29: "need to click multiple time to select one"). A pick shows as
 * chosen at once and is saved in the background, one save after another so the last pick wins; it stays shown until
 * the server's profile says the same, and goes back if its save is refused. Nothing is disabled while a save runs.
 */
export function useStyleSaver(engine: Engine, server: ProfileStyle, onSaved: () => void): StyleSaver {
  const [pending, setPending] = useState<ProfileStyleChange>({});
  const [error, setError] = useState<string | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const latest = useRef(0);

  // A pick the server now reports is no longer pending.
  useEffect(() => {
    setPending((p) => {
      const left = Object.fromEntries(Object.entries(p).filter(([k, v]) => !same(server[k as Key], v)));
      return Object.keys(left).length === Object.keys(p).length ? p : left;
    });
  }, [server]);

  const save = useCallback(
    (change: ProfileStyleChange) => {
      const mine = ++latest.current;
      setError(null);
      setPending((p) => ({ ...p, ...change }));
      queue.current = queue.current.then(async () => {
        try {
          await setProfileStyle(engine, change);
        } catch (e) {
          setError(e instanceof ApiError ? e.message : "Couldn't save that. Try again.");
          // Only the newest pick is taken back; an older one was already replaced by a newer pick.
          setPending((p) => Object.fromEntries(Object.entries(p).filter(([k, v]) => !(k in change) || !same(v, change[k as Key]))));
        }
        if (mine === latest.current) onSaved();
      });
    },
    [engine, onSaved],
  );

  const style = useMemo(() => ({ ...server, ...pending }) as ProfileStyle, [server, pending]);
  return { style, save, error };
}
