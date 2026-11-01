import { Crown } from "lucide-react";
import { BadgeMark } from "./BadgeMark";

export function CommunityOwnerBadge() {
  return (
    <BadgeMark className="community-owner-badge" name="Community owner" description="Created and owns this community.">
      <Crown size={15} aria-hidden="true" />
    </BadgeMark>
  );
}
