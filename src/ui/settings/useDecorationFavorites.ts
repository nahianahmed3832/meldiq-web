import { text as uiText } from "../../i18n";
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../../api/client";
import type { Engine } from "../../sync/engine";
import { decorationFavorites, setDecorationFavorite } from "../../sync/decorations";
interface DecorationFavorites {
  /** Null while loading, or when the server has no favourites (before API 0.65.0). */
  ids: ReadonlySet<string> | null;
  toggle: (id: string) => void;
  error: string | null;
}
/**
 * Starred decorations (API 0.65.0): a star shows as changed at once and goes back if the server refuses it (a 201st
 * favourite, or a decoration that's gone).
 */
export function useDecorationFavorites(engine: Engine, enabled: boolean): DecorationFavorites {
  const [ids, setIds] = useState<ReadonlySet<string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    decorationFavorites(engine).then(
      (list) => alive && setIds(new Set(list)),
      (e: unknown) =>
        alive &&
        setError(
          e instanceof ApiError ? uiText("settings.interface.favourites_couldn_t_be_loaded_value0_88e72af", { value0: e.message }) : uiText("settings.interface.favourites_couldn_t_be_loaded_f6858a0"),
        ),
    );
    return () => {
      alive = false;
    };
  }, [engine, enabled]);
  const flip = (set: ReadonlySet<string> | null, id: string, on: boolean): ReadonlySet<string> => {
    const next = new Set(set ?? []);
    if (on) next.add(id);
    else next.delete(id);
    return next;
  };
  const toggle = useCallback(
    (id: string) => {
      const on = !ids?.has(id);
      setError(null);
      setIds((s) => flip(s, id, on));
      setDecorationFavorite(engine, id, on).catch((e: unknown) => {
        setIds((s) => flip(s, id, !on));
        setError(e instanceof ApiError ? e.message : uiText("settings.interface.couldn_t_change_that_favourite_try_again_65e2ab3"));
      });
    },
    [engine, ids],
  );
  return { ids: enabled ? ids : null, toggle, error };
}
