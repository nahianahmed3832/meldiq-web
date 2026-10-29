import { useEngine, useOrbit } from "../../application/orbit";
import { setPrefs, usePrefs } from "../../application/prefs";
import { PARITY_FEATURES } from "../../sync/communityParity";
import { PERSONAL } from "../../sync/navPrefs";

/**
 * "Show community themes" (community parity A3): whether a community's accent, background tint and banner show while
 * you're in it. On servers with community-settings it's synced in the personal preferences (`communityThemes`), so every
 * device follows it; this browser's own setting is used until the synced one exists, and on older servers.
 */
export function useCommunityThemes(): { on: boolean; set: (on: boolean) => void } {
  const engine = useEngine();
  const local = usePrefs().communityColors;
  const synced = useOrbit((s) => s.nav[PERSONAL]?.communityThemes);
  const syncs = useOrbit((s) => s.server?.features.includes(PARITY_FEATURES.settings) ?? false);
  const on = syncs && synced !== undefined ? synced : local;
  const set = (next: boolean) => {
    setPrefs({ communityColors: next });
    if (syncs) void engine.nav.change(PERSONAL, { op: "communityThemes", on: next });
  };
  return { on, set };
}
