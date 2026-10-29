import { UserCheck } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useOrbit } from "../../../application/orbit";
import type { StoredMessage } from "../../../model/types";
import { POSTING_FEATURES } from "../../../sync/posting/api";
import type { MenuEntry } from "../../components/Overlay";
import { useCommunityDetail } from "../useCommunityPermissions";
import { ReactionRolesDialog } from "./ReactionRolesDialog";

/**
 * The message menu's "Reaction roles…" (community parity C): on a community channel's message, for people who may give
 * roles, on servers with reaction roles. Who may is loaded only while the menu is open, as the community menus do.
 */
export function useReactionRolesItem(m: StoredMessage, orgId: string | null, menuOpen: boolean): { entries: MenuEntry[]; dialog: ReactNode } {
  const offered = useOrbit((s) => s.server?.features.includes(POSTING_FEATURES.reactionRoles) ?? false);
  const usable = offered && !!orgId && m.kind === "text" && !m.deleted && m.serverTs !== null;
  const { detail } = useCommunityDetail(usable && menuOpen ? orgId : null);
  const [open, setOpen] = useState(false);
  const can = !!detail && (detail.permissions.isOwner || detail.permissions.canAssignRoles || detail.permissions.effective.includes("roles.assign"));
  const entries: MenuEntry[] = usable && can ? [{ label: "Reaction roles…", icon: <UserCheck size={16} />, onSelect: () => setOpen(true) }] : [];
  const dialog = open && orgId ? <ReactionRolesDialog orgId={orgId} channelId={m.conversationId} messageId={m.id} onClose={() => setOpen(false)} /> : null;
  return { entries, dialog };
}
