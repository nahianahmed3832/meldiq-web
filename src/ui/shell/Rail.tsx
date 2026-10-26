import { Compass, Plus } from "lucide-react";
import { shallowEqual, useOrbit } from "../../application/orbit";
import { setPrefs } from "../../application/prefs";
import { navigate, type Section } from "../../application/router";
import { OrgAvatar } from "../components/OrgAvatar";
import { UnreadBadge } from "../components/UnreadBadge";
import { useIncomingRequestCount } from "../people/connectionRequests";
import { orgActivity, unreadPeopleCount } from "../selectors";
import { capCount, isHighlighted, unreadMarker } from "../unread";
import { useT } from "../../i18n";
import type { ShellDialog } from "./Shell";

/**
 * The rail, top to bottom: the mascot (Home and messages: the DM list), the communities with their rolled-up unread
 * state, then round Create and Discover. Activity and Later live in the top bar and the sidebar (community-first brief
 * §G); their routes are unchanged.
 */
export function Rail({ orgId, section, onDialog }: { orgId: string | null; section: Section; onDialog: (d: ShellDialog) => void }) {
  const orgs = useOrbit(
    (s) => s.orgs.map((o) => ({ id: o.id, name: o.name, photoRev: o.photoRev, ...orgActivity(s, o.id) })),
    (a, b) => a.length === b.length && a.every((x, i) => shallowEqual(x, b[i])),
  );
  // Unread DMs and people waiting for an answer to their connection request.
  const dms = useOrbit(unreadPeopleCount) + useIncomingRequestCount();
  const t = useT();
  const home = section === "dms";
  const homeLabel = `${t("rail_home")}${dms ? `, ${t("nav_unread", { n: dms })}` : ""}`;
  return (
    <nav className="rail" aria-label={t("rail_label")}>
      <a className="rail-home" href="/dms" aria-current={home ? "page" : undefined} aria-label={homeLabel} title={t("rail_home")}>
        <img className="rail-mascot" src="/meldiq-mascot-96.webp" srcSet="/meldiq-mascot-96.webp 96w, /meldiq-mascot-192.webp 192w" sizes="46px" width={46} height={46} alt="" draggable={false} />
        {dms > 0 && (
          <span className="count accent" aria-hidden="true">
            {capCount(dms)}
          </span>
        )}
      </a>
      <div className="rail-sep" />
      {orgs.length > 0 && (
        <div role="group" aria-label={t("rail_communities")} className="rail-orgs">
          {orgs.map((o) => {
            // Direct messages belong to no community, so none is selected there (as on Discord).
            const selected = section !== "dms" && o.id === orgId;
            const marker = unreadMarker(o.unread, o.mentions, false);
            const label = `${o.name}${o.mentions ? `, ${t("rail_mentions", { n: o.mentions })}` : ""}${o.unread ? `, ${t("nav_unread", { n: o.unread })}` : ""}`;
            return (
              <button
                key={o.id}
                className={`rail-org${isHighlighted(marker) ? " unread" : ""}`}
                aria-current={selected}
                title={o.name}
                aria-label={label}
                onClick={() => {
                  setPrefs({ orgId: o.id });
                  // A community opens its own channels, from DMs too (it used to stay in DMs, under the community's name).
                  navigate({ section: "home" });
                }}
              >
                <OrgAvatar orgId={o.id} name={o.name} photoRev={o.photoRev} size={44} />
                {!selected && <UnreadBadge marker={marker} />}
              </button>
            );
          })}
        </div>
      )}
      <button className="rail-round" onClick={() => onDialog({ kind: "createWorkspace" })} aria-label={t("rail_create")} title={t("rail_create")}>
        <Plus size={22} aria-hidden="true" />
      </button>
      <button className="rail-round" onClick={() => onDialog({ kind: "discover" })} aria-label={t("rail_discover")} title={t("rail_discover")}>
        <Compass size={22} aria-hidden="true" />
      </button>
      <div className="rail-spacer" />
    </nav>
  );
}
