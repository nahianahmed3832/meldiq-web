import { ChevronDown, LogIn, Plus, Sparkles } from "lucide-react";
import { useEffect } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { Menu, type MenuEntry, useMenu } from "../components/Overlay";
import { members } from "../format";
import type { ShellDialog } from "../shell/Shell";
import { hideMutedKey, useCommunityMenu } from "./communityMenu";
import type { CommunityPermissions } from "./useCommunityPermissions";

export { hideMutedKey };
export { LeaveDialog } from "./LeaveDialog";

/**
 * The community's name above its channels, opening its menu (communityMenu.tsx: the same one as a right-click on its
 * icon in the rail). Without a community: start one or join with a code.
 */
export function CommunityHeader({ orgId, perms, onDialog }: { orgId: string | null; perms: CommunityPermissions; onDialog: (d: ShellDialog) => void }) {
  const org = useOrbit((s) => s.orgs.find((o) => o.id === orgId) ?? null);
  const engine = useEngine();
  const mojo = useOrbit((s) => s.server?.features.includes("mojo") ?? false);
  const level = useOrbit((s) => (orgId ? (s.mojo.orgs[orgId]?.level ?? null) : null));
  // The community's Spark level shows by its name (Meldiq Spark, server docs/MOJO.md): read once it's on screen.
  useEffect(() => {
    if (mojo && orgId && level === null) void engine.mojo.loadOrg(orgId);
  }, [engine, mojo, orgId, level]);
  const menu = useMenu();
  const community = useCommunityMenu(orgId, perms, onDialog);
  const entries: MenuEntry[] = org
    ? community.entries
    : [
        { custom: <div className="side-quiet">You're not in a community yet.</div> },
        { label: "Start a community", icon: <Plus size={16} />, onSelect: () => onDialog({ kind: "createWorkspace" }) },
        { label: "Join with a code", icon: <LogIn size={16} />, onSelect: () => onDialog({ kind: "joinWorkspace" }) },
      ];
  return (
    <>
      <button
        className="org-switch community-switch"
        onClick={(e) => menu.open(e.currentTarget)}
        onContextMenu={(e) => {
          e.preventDefault();
          menu.openAt(e.currentTarget, e);
        }}
        aria-haspopup="menu"
        aria-expanded={!!menu.anchor}
        aria-label={`Community: ${org?.name ?? "none"}. Community menu`}
        title={org ? `${org.name} · ${members(org.memberCount)}${org.visibility === "public" ? " · Public" : ""}` : undefined}
      >
        <strong className="ellipsis grow">{org?.name ?? "Meldiq"}</strong>
        {!!level && (
          <span className="spark-chip" title={`Spark Level ${level}`} aria-label={`Spark Level ${level}`}>
            <Sparkles size={11} aria-hidden="true" />
            {level}
          </span>
        )}
        <ChevronDown size={18} className="faint" aria-hidden="true" />
      </button>
      {menu.anchor && <Menu anchor={menu.anchor} point={menu.point} label={org?.name ?? "Community"} onClose={menu.close} entries={entries} />}
      {community.dialogs}
    </>
  );
}
