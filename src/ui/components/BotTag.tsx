import { text as uiText } from "../../i18n";
import { Localized, useLocaleRender } from "../../i18n/Localized";
import { IdentityGlyph } from "./IdentityGlyph";
/** A persistent account-type label, independent of optional profile badges. */
export function BotTag({ title = uiText("files.interface.automated_community_account_e61bc60") }: { title?: string }) {
  useLocaleRender();
  return (
    <span className="bot-tag" title={title}>
      <Localized k="workspace.interface.bot_4020871" slots={[<IdentityGlyph kind="bot" size={11} />]} />
    </span>
  );
}
