import { useEffect, useState } from "react";

/** Re-renders once when [at] (epoch ms) passes, e.g. when a timed mute ends; null: nothing to wait for. */
export function useTickAt(at: number | null): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (at === null) return;
    const t = setTimeout(() => setTick((n) => n + 1), Math.min(2_147_000_000, Math.max(250, at - Date.now() + 50)));
    return () => clearTimeout(t);
  }, [at]);
}
