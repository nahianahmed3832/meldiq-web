import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { IdentityGlyph } from "./IdentityGlyph";
import { BadgeMark } from "./BadgeMark";
export function CommunityOwnerBadge() {
  useLocaleRender();
  return (
    <BadgeMark className="community-owner-badge" name={uiText("workspace.interface.community_owner_4523f4e")} description={uiText("organization.interface.created_and_owns_this_community_2ff3121")}>
      <IdentityGlyph kind="owner" size={20} />
    </BadgeMark>
  );
}
