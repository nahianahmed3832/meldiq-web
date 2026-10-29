import type { Conversation } from "../../../api/schemas";
import { useOrbit } from "../../../application/orbit";
import { POSTING_FEATURES } from "../../../sync/posting/api";
import { useCommunityDetail } from "../useCommunityPermissions";

/**
 * Whether Edit channel shows the Webhooks tab: a text, announcement or forum channel of a community, on a server with
 * channel webhooks, for someone who may manage them (owners, admins, `webhooks.manage`).
 */
export function useWebhooksAllowed(channel: Conversation): boolean {
  const offered = useOrbit((s) => s.server?.features.includes(POSTING_FEATURES.webhooks) ?? false);
  const orgId = offered && channel.type === "CHANNEL" && !channel.voice && channel.orgId ? channel.orgId : null;
  const { detail } = useCommunityDetail(orgId);
  if (!orgId || !detail) return false;
  const p = detail.permissions;
  return p.isOwner || p.canManageOrg || p.effective.includes("webhooks.manage");
}
