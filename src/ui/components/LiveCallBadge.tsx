import { MonitorUp, Video, Volume2 } from "lucide-react";
import { shallowEqual, useOrbit } from "../../application/orbit";
import { useT } from "../../i18n";
import { liveCallOf } from "../selectors";

/**
 * A channel row's live call (community-first brief §E): a speaker for voice, a camera for a video call, a screen when
 * someone is sharing, with how many are in it. The label and tooltip spell it out (who is sharing too), so it never relies
 * on the icon alone. Nothing when no call is live.
 */
export function LiveCallBadge({ conversationId }: { conversationId: string }) {
  const t = useT();
  const live = useOrbit(
    (s) => liveCallOf(s, conversationId),
    (a, b) => (a === null || b === null ? a === b : a.video === b.video && shallowEqual(a.people, b.people) && shallowEqual(a.sharing, b.sharing)),
  );
  const names = useOrbit((s) => (live?.sharing ?? []).map((u) => s.users[u]?.displayName ?? t("react_someone")), shallowEqual);
  if (!live) return null;
  const n = live.people.length;
  const kind = live.video ? t("live_video") : t("live_voice");
  const label = [n > 0 ? t("live_people", { kind, n }) : kind, names.length ? t("live_sharing", { names: names.join(", ") }) : ""].filter(Boolean).join(" · ");
  return (
    <span className={`live-call${names.length ? " sharing" : ""}`} role="img" aria-label={label} title={label}>
      {names.length ? <MonitorUp size={13} aria-hidden="true" /> : live.video ? <Video size={13} aria-hidden="true" /> : <Volume2 size={13} aria-hidden="true" />}
      {n > 0 && <span aria-hidden="true">{n}</span>}
    </span>
  );
}
