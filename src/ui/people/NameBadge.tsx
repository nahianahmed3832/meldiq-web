import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import type { MojoMark, ShownBadge } from "../../api/profileSchemas";
import { BadgeMark } from "../components/BadgeMark";
import { IdentityGlyph } from "../components/IdentityGlyph";
/**
 * The badge shown next to a name (API 0.65.0): each person picks one they hold, or none. Without a choice it's the
 * Meldiq Plus badge, as before. Messages and member lists show only this one; the profile card lists every badge.
 */
export type NameBadgeKind = "mojo" | "bug-hunter" | "artist";
export const BADGE_LABEL: Record<NameBadgeKind, string> = {
  mojo: "Meldiq Plus",
  get "bug-hunter"() {
    return uiText("workspace.interface.bug_hunter_3f91280");
  },
  get artist() {
    return uiText("settings.interface.artist_1d3981b");
  },
};
const BADGE_HINT: Record<"bug-hunter" | "artist", string> = {
  get "bug-hunter"() {
    return uiText("workspace.interface.bug_hunter_found_a_bug_meldiq_confirmed_e393eef");
  },
  get artist() {
    return uiText("workspace.interface.artist_made_a_profile_decoration_meldiq_approved_72d9bbe");
  },
};
/** Which badge goes by the name: the chosen one, nothing for "none", else the Meldiq Plus badge when they have one. */
export function nameBadge(shown: ShownBadge | null | undefined, mojo: MojoMark | null | undefined): NameBadgeKind | null {
  if (shown === "none") return null;
  if (shown === "bug-hunter" || shown === "artist") return shown;
  return mojo ? "mojo" : null;
}
/** The Bug Hunter or Artist mark by a name (the Meldiq Plus badge has its own, MojoBadgeMark). */
export function NameBadgeMark({ badge }: { badge: "bug-hunter" | "artist" }) {
  useLocaleRender();
  return (
    <BadgeMark className={`name-badge name-badge-${badge}`} name={BADGE_LABEL[badge]} description={BADGE_HINT[badge]}>
      <IdentityGlyph kind={badge} />
    </BadgeMark>
  );
}
