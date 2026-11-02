import { IdentityGlyph } from "./IdentityGlyph";
import { BadgeMark } from "./BadgeMark";

export function CommunityOwnerBadge() {
  return (
    <BadgeMark className="community-owner-badge" name="Community owner" description="Created and owns this community.">
      <IdentityGlyph kind="owner" size={20} />
    </BadgeMark>
  );
}
