import { Grid3x3 } from "lucide-react";
import { useEffect, useState } from "react";
import type { Conversation } from "../../api/schemas";
import { useOrbit } from "../../application/orbit";
import { OFFICIAL_BOTS_FEATURE } from "../../sync/officialBots";
import { useWordyChannel, WORDY_EVENT, type WordyOpen } from "./wordyLaunch";
import { WordyGameDialog } from "./WordyGameDialog";

/**
 * In a community channel: "Play Wordy" in the Wordy channel's header, and the game panel when `/wordy` is sent from
 * this channel's composer (any channel of a community with Wordy on).
 */
export function WordyHeaderAction({ c }: { c: Conversation }) {
  const offered = useOrbit((s) => s.server?.features.includes(OFFICIAL_BOTS_FEATURE) ?? false);
  const orgId = offered && c.type === "CHANNEL" && c.orgId ? c.orgId : null;
  const wordyChannel = useWordyChannel(orgId);
  const [open, setOpen] = useState<WordyOpen | null>(null);

  useEffect(() => {
    if (!orgId) return;
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<WordyOpen>).detail;
      if (detail?.orgId === orgId) setOpen(detail);
    };
    window.addEventListener(WORDY_EVENT, onOpen);
    return () => window.removeEventListener(WORDY_EVENT, onOpen);
  }, [orgId]);

  if (!orgId) return null;
  return (
    <>
      {wordyChannel === c.id && (
        <button className="btn btn-secondary btn-sm" onClick={() => setOpen({ orgId, guess: null })} title="Play today's word privately">
          <Grid3x3 size={15} /> Play Wordy
        </button>
      )}
      {open && <WordyGameDialog orgId={open.orgId} firstGuess={open.guess} onClose={() => setOpen(null)} />}
    </>
  );
}
