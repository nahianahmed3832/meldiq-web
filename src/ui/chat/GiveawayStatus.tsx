import { Gift, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { shallowEqual, useEngine, useOrbit } from "../../application/orbit";
import type { GiveawayState } from "../../model/types";
import { countdown, countdownStep } from "../../sync/giveaways";

/** Now, redrawn as often as the countdown needs while the giveaway runs. */
function useNow(endsAt: number, running: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const t = setTimeout(() => setNow(Date.now()), countdownStep(endsAt, now));
    return () => clearTimeout(t);
  }, [endsAt, running, now]);
  return now;
}

/**
 * Under a Giveaways bot card (community parity D): a live countdown while it runs, then "Ended" with the winners. The
 * card's text and boxes come from the bot; this only keeps the time and the outcome current.
 */
export function GiveawayStatus({ giveaway: g }: { giveaway: GiveawayState }) {
  const engine = useEngine();
  const now = useNow(g.endsAt, !g.ended);
  const names = useOrbit((s) => g.winnerIds.map((id) => s.users[id]?.displayName ?? "someone"), shallowEqual);
  const winnerKey = g.winnerIds.join(",");
  useEffect(() => {
    // Winners this browser hasn't met yet: their names come with their profiles.
    for (const id of winnerKey ? winnerKey.split(",") : []) void engine.ensureUser(id);
  }, [engine, winnerKey]);
  const when = new Date(g.endsAt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  if (!g.ended) {
    return (
      <div className="giveaway-status" role="status" aria-live="off">
        <Gift size={15} aria-hidden="true" />
        <span>
          Ends in <strong>{countdown(g.endsAt, now)}</strong> · {g.winners} {g.winners === 1 ? "winner" : "winners"} · react 🎉 to enter
        </span>
        <small className="faint">{when}</small>
      </div>
    );
  }
  return (
    <div className="giveaway-status ended" role="status">
      <Trophy size={15} aria-hidden="true" />
      <span>
        {names.length ? (
          <>
            Ended · {names.length === 1 ? "Winner" : "Winners"}: <strong>{names.join(", ")}</strong>
          </>
        ) : (
          "Ended · nobody entered"
        )}
      </span>
      <small className="faint">{when}</small>
    </div>
  );
}
