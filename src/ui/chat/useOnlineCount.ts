import { useEffect, useState } from "react";
import { z } from "zod";
import { useEngine, useOrbit } from "../../application/orbit";

/** How often an open channel asks who is online (round 3; the server allows 60 a minute). */
export const ONLINE_REFRESH_MS = 60_000;
const zPresence = z.object({ online: z.number().int().min(0), members: z.number().int().min(0) });

/**
 * How many of a channel's members are online now (servers with conversation-presence), or null when unknown. The server
 * counts only people whose last-seen setting lets you see them. A failed request keeps the last answer.
 */
export function useOnlineCount(conversationId: string, enabled: boolean): number | null {
  const engine = useEngine();
  const offered = useOrbit((s) => s.server?.features.includes("conversation-presence") ?? false);
  const [online, setOnline] = useState<number | null>(null);
  useEffect(() => {
    setOnline(null);
    if (!enabled || !offered) return;
    let stopped = false;
    const load = () =>
      engine.api.json("GET", `/v1/conversations/${encodeURIComponent(conversationId)}/presence`, zPresence).then(
        (r) => !stopped && setOnline(r.online),
        () => undefined,
      );
    void load();
    const t = setInterval(() => void load(), ONLINE_REFRESH_MS);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [engine, conversationId, enabled, offered]);
  return online;
}
