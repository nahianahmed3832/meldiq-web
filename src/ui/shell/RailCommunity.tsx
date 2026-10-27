import { MonitorUp, Volume2 } from "lucide-react";
import { shallowEqual, useOrbit } from "../../application/orbit";
import { contextMenuProps, Menu, useMenu } from "../components/Overlay";
import { useCommunityMenu } from "../community/communityMenu";
import { useCommunityDetail } from "../community/useCommunityPermissions";
import { setPrefs, usePrefs } from "../../application/prefs";
import { navigate } from "../../application/router";
import { ACCENT_CLASS, accentStyle } from "../community/accent";
import { OrgAvatar } from "../components/OrgAvatar";
import { UnreadBadge } from "../components/UnreadBadge";
import { orgActivity, orgLive } from "../selectors";
import { isHighlighted, unreadMarker } from "../unread";
import { useT } from "../../i18n";
import type { ShellDialog } from "./Shell";

export type RailOrg = { id: string; name: string; photoRev: number | null; accent: string | null; myRole: string | null; unread: number; mentions: number };

/** The communities in rail order, with their rolled-up unread activity. */
export function useRailOrgs(): RailOrg[] {
  return useOrbit(
    (s) => s.orgs.map((o) => ({ id: o.id, name: o.name, photoRev: o.photoRev, accent: o.accent, myRole: o.myRole, ...orgActivity(s, o.id) })),
    (a, b) => a.length === b.length && a.every((x, i) => shallowEqual(x, b[i])),
  );
}

/**
 * One community's icon: selects it and opens its channels (from DMs too); its side marker and badge say what's new.
 * A right-click (or the Menu key) opens its menu: open, invite, mark as read, settings, copy its id, leave.
 */
export function CommunityButton({
  org: o,
  selected,
  size,
  onDialog,
  drag,
}: {
  org: RailOrg;
  selected: boolean;
  size: number;
  onDialog: (d: ShellDialog) => void;
  /** Its place for dragging: in a folder (its id) or not, and whether something may be dropped onto it. */
  drag?: { group: string | null; into: boolean };
}) {
  const t = useT();
  const menu = useMenu();
  // The permissions behind the menu's items load only once it opens (one request per right-click, not per icon).
  const { perms } = useCommunityDetail(menu.anchor ? o.id : null);
  const community = useCommunityMenu(o.id, perms, onDialog);
  const marker = unreadMarker(o.unread, o.mentions, false);
  // A call on in one of its channels (2026-10-28): a speaker at the icon's corner, red while someone shares a screen.
  const live = useOrbit((s) => orgLive(s, o.id), shallowEqual);
  const ownColors = usePrefs().communityColors;
  const accent = ownColors ? o.accent : null;
  const label = `${o.name}${live.live ? (live.sharing ? ", someone is live" : ", a call is on") : ""}${o.mentions ? `, ${t("rail_mentions", { n: o.mentions })}` : ""}${o.unread ? `, ${t("nav_unread", { n: o.unread })}` : ""}`;
  const openIt = () => {
    setPrefs({ orgId: o.id });
    navigate({ section: "home" });
  };
  return (
    <>
      <button
        className={`rail-org${isHighlighted(marker) ? " unread" : ""}${accent ? ` ${ACCENT_CLASS}` : ""}`}
        style={accentStyle(accent)}
        aria-current={selected}
        title={o.name}
        aria-label={label}
        aria-haspopup="menu"
        onClick={openIt}
        {...contextMenuProps(menu.openAt)}
        data-drag={drag ? o.id : undefined}
        data-drag-kind="org"
        data-drag-group={drag?.group ?? undefined}
        data-drag-into={drag?.into ? "true" : undefined}
      >
        <OrgAvatar orgId={o.id} name={o.name} photoRev={o.photoRev} size={size} />
        {!selected && <UnreadBadge marker={marker} />}
        {live.live && (
          <span className={`rail-live${live.sharing ? " sharing" : ""}`} title={live.sharing ? "Someone is live" : "A call is on"}>
            {live.sharing ? <MonitorUp size={11} aria-hidden="true" /> : <Volume2 size={11} aria-hidden="true" />}
          </span>
        )}
      </button>
      {menu.anchor && <Menu anchor={menu.anchor} point={menu.point} label={o.name} onClose={menu.close} entries={community.entries} />}
      {community.dialogs}
    </>
  );
}
