import { type DependencyList, useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../../api/client";

export interface Loaded<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

/** Loads [fn] when [deps] change (or on reload); ignores answers that arrive after a newer request started. */
export function useLoad<T>(fn: () => Promise<T>, deps: DependencyList): Loaded<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const gen = useRef(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the caller's deps decide when to load again
  const run = useCallback(fn, deps);
  useEffect(() => {
    const mine = ++gen.current;
    setLoading(true);
    run()
      .then((d) => {
        if (mine !== gen.current) return;
        setData(d);
        setError(null);
      })
      .catch((e: unknown) => {
        if (mine === gen.current) setError(e instanceof ApiError ? e.message : "Couldn't load this. Try again.");
      })
      .finally(() => {
        if (mine === gen.current) setLoading(false);
      });
  }, [run, tick]);
  return { data, error, loading, reload: useCallback(() => setTick((t) => t + 1), []) };
}

/** Runs one action at a time for a control: busy while it runs, its refusal as text. */
export function useAction(): { busy: boolean; error: string | null; clear: () => void; act: (fn: () => Promise<unknown>) => Promise<boolean> } {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const act = useCallback(async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      return true;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That didn't work. Try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, error, clear: useCallback(() => setError(null), []), act };
}
