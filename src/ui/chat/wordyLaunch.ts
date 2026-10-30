import { useEffect, useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import type { Engine } from "../../sync/engine";
import { OFFICIAL_BOTS_FEATURE } from "../../sync/officialBots";
import { wordyGame } from "../../sync/officialBotTools";

/**
 * Opening the Wordy game panel (community parity D part 2): from the Wordy channel's header, or `/wordy` in the composer
 * (with a guess: `/wordy crane`), so people play without typing their guesses in the channel.
 */
export const WORDY_EVENT = "meldiq:wordy";

export interface WordyOpen {
  orgId: string;
  guess: string | null;
}

export function openWordy(orgId: string, guess: string | null = null): void {
  window.dispatchEvent(new CustomEvent<WordyOpen>(WORDY_EVENT, { detail: { orgId, guess } }));
}

/** `/wordy` or `/wordy <guess>`: the guess (or "" for none), or null when it isn't the Wordy command. */
export function wordyCommand(body: string): string | null {
  const m = /^\/wordy(?:\s+(\S+))?\s*$/i.exec(body.trim());
  return m ? (m[1] ?? "").toLowerCase() : null;
}

const KEEP_MS = 5 * 60_000;
const known = new Map<string, { at: number; channelId: Promise<string | null> }>();

/** The community's Wordy channel (null: Wordy is off, unset, or not on this server), asked once per 5 minutes. */
function wordyChannel(engine: Engine, orgId: string): Promise<string | null> {
  const hit = known.get(orgId);
  if (hit && Date.now() - hit.at < KEEP_MS) return hit.channelId;
  const channelId = wordyGame(engine, orgId)
    .then((g) => g.channelId)
    .catch(() => null);
  known.set(orgId, { at: Date.now(), channelId });
  return channelId;
}

/** The Wordy channel of [orgId], or null (also while it loads, and with no [orgId]). */
export function useWordyChannel(orgId: string | null): string | null {
  const engine = useEngine();
  const [channelId, setChannelId] = useState<string | null>(null);
  useEffect(() => {
    if (!orgId) return setChannelId(null);
    let live = true;
    void wordyChannel(engine, orgId).then((id) => live && setChannelId(id));
    return () => {
      live = false;
    };
  }, [engine, orgId]);
  return channelId;
}

/**
 * For the composer: a function that, for `/wordy` (or `/wordy <guess>`) sent in a community channel on a server with
 * official bots, opens the game panel instead of posting, and says so (true).
 */
export function useWordyCommand(c: { type: string; orgId: string | null }): (body: string) => boolean {
  const offered = useOrbit((s) => s.server?.features.includes(OFFICIAL_BOTS_FEATURE) ?? false);
  return (body) => {
    if (!offered || c.type !== "CHANNEL" || !c.orgId) return false;
    const guess = wordyCommand(body);
    if (guess === null) return false;
    openWordy(c.orgId, guess || null);
    return true;
  };
}
