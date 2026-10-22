import type { OrgAdminDetail } from "../../api/workspaceSchemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { workspaceDetail } from "../../sync/workspaces";
import { useLoad } from "../workspace/useLoad";

/** What the community's menus may offer this person (the server decides every change again). */
export interface CommunityPermissions {
  /** Creating channels anywhere (here or in a category this person may fill). */
  canCreateChannels: boolean;
  /** Creating channels outside any category, or categories. */
  canCreateTop: boolean;
  canManageChannels: boolean;
  canInvite: boolean;
  canManageOrg: boolean;
  canBan: boolean;
  isOwner: boolean;
  effective: string[];
}

export const NO_PERMISSIONS: CommunityPermissions = {
  canCreateChannels: false,
  canCreateTop: false,
  canManageChannels: false,
  canInvite: false,
  canManageOrg: false,
  canBan: false,
  isOwner: false,
  effective: [],
};

export function permissionsOf(d: OrgAdminDetail | null): CommunityPermissions {
  if (!d) return NO_PERMISSIONS;
  const p = d.permissions;
  return {
    canCreateChannels: p.canCreateChannels,
    canCreateTop: p.isOwner || p.effective.includes("channels.create"),
    canManageChannels: p.isOwner || p.canManageChannels,
    canInvite: p.canInvite,
    canManageOrg: p.canManageOrg,
    canBan: p.canBan,
    isOwner: p.isOwner,
    effective: p.effective,
  };
}

/** The community's detail for its menus, loaded again whenever the community changes (the org list refreshes then). */
export function useCommunityDetail(orgId: string | null): { detail: OrgAdminDetail | null; perms: CommunityPermissions; reload: () => void } {
  const engine = useEngine();
  const org = useOrbit((s) => (orgId ? (s.orgs.find((o) => o.id === orgId) ?? null) : null));
  const loaded = useLoad(() => (orgId && org ? workspaceDetail(engine, orgId) : Promise.resolve(null)), [engine, orgId, org]);
  return { detail: loaded.data, perms: permissionsOf(loaded.data), reload: loaded.reload };
}
