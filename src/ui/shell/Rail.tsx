import { Compass, Plus } from "lucide-react";
import { shallowEqual, useOrbit } from "../../application/orbit";
import { setPrefs } from "../../application/prefs";
import { navigate, type Section } from "../../application/router";
import { ACCENT_CLASS, accentStyle } from "../community/accent";
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
  const orgs = useRailOrgs();
  // Unread DMs and people waiting for an answer to their connection request.
  const dms = useOrbit(unreadPeopleCount) + useIncomingRequestCount();
  const t = useT();
  const home = section === "dms";
  const discovering = section === "discover";
  const homeLabel = `${t("rail_home")}${dms ? `, ${t("nav_unread", { n: dms })}` : ""}`;
  return (
    <nav className="rail" aria-label={t("rail_label")}>
      <a className="rail-home" href="/dms" aria-current={home ? "page" : undefined} aria-label={homeLabel} title={t("rail_home")}>
        <img className="rail-mascot" src="/meldling-96.webp" srcSet="/meldling-96.webp 96w, /meldling-192.webp 192w" sizes="46px" width={46} height={46} alt="" draggable={false} />
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
            const selected = !home && !discovering && o.id === orgId;
            return <CommunityButton key={o.id} org={o} selected={selected} size={44} />;
          })}
        </div>
      )}
      <button className="rail-round" onClick={() => onDialog({ kind: "createWorkspace" })} aria-label={t("rail_create")} title={t("rail_create")}>
        <Plus size={22} aria-hidden="true" />
      </button>
      <a className="rail-round" href="/discover" aria-current={discovering ? "page" : undefined} aria-label={t("rail_discover")} title={t("rail_discover")}>
        <Compass size={22} aria-hidden="true" />
      </a>
      <div className="rail-spacer" />
    </nav>
  );
}

type RailOrg = { id: string; name: string; photoRev: number | null; accent: string | null; unread: number; mentions: number };

/** The communities in rail order, with their rolled-up unread activity. */
function useRailOrgs(): RailOrg[] {
  return useOrbit(
    (s) => s.orgs.map((o) => ({ id: o.id, name: o.name, photoRev: o.photoRev, accent: o.accent, ...orgActivity(s, o.id) })),
    (a, b) => a.length === b.length && a.every((x, i) => shallowEqual(x, b[i])),
  );
}

/** One community's icon: selects it and opens its channels (from DMs too); its side marker and badge say what's new. */
function CommunityButton({ org: o, selected, size }: { org: RailOrg; selected: boolean; size: number }) {
  const t = useT();
  const marker = unreadMarker(o.unread, o.mentions, false);
  const label = `${o.name}${o.mentions ? `, ${t("rail_mentions", { n: o.mentions })}` : ""}${o.unread ? `, ${t("nav_unread", { n: o.unread })}` : ""}`;
  return (
    <button
      className={`rail-org${isHighlighted(marker) ? " unread" : ""}${o.accent ? ` ${ACCENT_CLASS}` : ""}`}
      style={accentStyle(o.accent)}
      aria-current={selected}
      title={o.name}
      aria-label={label}
      onClick={() => {
        setPrefs({ orgId: o.id });
        navigate({ section: "home" });
      }}
    >
      <OrgAvatar orgId={o.id} name={o.name} photoRev={o.photoRev} size={size} />
      {!selected && <UnreadBadge marker={marker} />}
    </button>
  );
}

/**
 * Phones have no rail (the tab bar takes its place): this strip at the top of the conversation list carries the same
 * communities and the round Create and Discover, scrolling sideways when there are many.
 */
export function PhoneRail({ orgId, onDialog }: { orgId: string | null; onDialog: (d: ShellDialog) => void }) {
  const orgs = useRailOrgs();
  const t = useT();
  return (
    <nav className="phone-rail" aria-label={t("rail_communities")}>
      {orgs.map((o) => (
        <CommunityButton key={o.id} org={o} selected={o.id === orgId} size={44} />
      ))}
      <button className="rail-round" onClick={() => onDialog({ kind: "createWorkspace" })} aria-label={t("rail_create")} title={t("rail_create")}>
        <Plus size={22} aria-hidden="true" />
      </button>
      <a className="rail-round" href="/discover" aria-label={t("rail_discover")} title={t("rail_discover")}>
        <Compass size={22} aria-hidden="true" />
      </a>
    </nav>
  );
}
