import { createContext, type ReactNode, useContext, useRef, useSyncExternalStore } from "react";
import type { AppState } from "../state/store";
import type { Engine } from "../sync/engine";

const EngineCtx = createContext<Engine | null>(null);

export function EngineProvider({ engine, children }: { engine: Engine; children: ReactNode }) {
  return <EngineCtx.Provider value={engine}>{children}</EngineCtx.Provider>;
}

export function useEngine(): Engine {
  const e = useContext(EngineCtx);
  if (!e) throw new Error("useEngine outside EngineProvider");
  return e;
}

/**
 * Subscribes to one slice of the app state. The component re-renders only when [select]'s result changes by [equal]
 * (reference equality by default; pass `shallowEqual` for selectors that build arrays or objects).
 */
export function useOrbit<T>(select: (s: AppState) => T, equal: (a: T, b: T) => boolean = Object.is): T {
  const engine = useEngine();
  const last = useRef<{ state: AppState; value: T } | null>(null);
  return useSyncExternalStore(engine.state.subscribe, () => {
    const s = engine.state.get();
    if (last.current && last.current.state === s) return last.current.value;
    const value = select(s);
    if (last.current && equal(last.current.value, value)) {
      last.current = { state: s, value: last.current.value };
      return last.current.value;
    }
    last.current = { state: s, value };
    return value;
  });
}

/** The server runs communities (channels, categories, roles as on Android): copy says "community", not "workspace". */
export function useCommunityServer(): boolean {
  return useOrbit((s) => s.server?.features.includes("community-channels") ?? false);
}

export function shallowEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => Object.is(x, b[i]));
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a as object);
    const kb = Object.keys(b as object);
    return ka.length === kb.length && ka.every((k) => Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return false;
}
