import { Crown } from "lucide-react";

export function CommunityOwnerBadge() {
  return (
    <span className="community-owner-badge" title="Community owner">
      <Crown size={12} aria-hidden="true" />
      Owner
    </span>
  );
}
