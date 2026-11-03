import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { ChevronDown, LogIn, Plus } from "lucide-react";
import { useOrbit } from "../../application/orbit";
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
  useLocaleRender();
  const l10n = useLocalization();
  const org = useOrbit((s) => s.orgs.find((o) => o.id === orgId) ?? null);
  const menu = useMenu();
  const community = useCommunityMenu(orgId, perms, onDialog);
  const entries: MenuEntry[] = org
    ? community.entries
    : [
        {
          custom: (
            <div className="side-quiet">
              <Localized k="organization.interface.you_re_not_in_a_community_yet_2b220f6" />
            </div>
          ),
        },
        { label: l10n("workspace.home_start_community"), icon: <Plus size={16} />, onSelect: () => onDialog({ kind: "createWorkspace" }) },
        { label: l10n("workspace.home_join_code"), icon: <LogIn size={16} />, onSelect: () => onDialog({ kind: "joinWorkspace" }) },
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
        aria-label={uiText("organization.interface.community_value0_community_menu_f632b7c", { value0: org?.name ?? "none" })}
        title={
          org
            ? uiText("organization.interface.value0_value1_value2_035f89b", {
                value0: org.name,
                value1: members(org.memberCount),
                value2: org.visibility === "public" ? uiText("organization.interface.public_5e24ecc") : "",
              })
            : undefined
        }
      >
        <strong className="ellipsis grow">{org?.name ?? "Meldiq"}</strong>
        <ChevronDown size={18} className="faint" aria-hidden="true" />
      </button>
      {menu.anchor && <Menu anchor={menu.anchor} point={menu.point} label={org?.name ?? l10n("organization.community")} onClose={menu.close} entries={entries} />}
      {community.dialogs}
    </>
  );
}
