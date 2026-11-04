import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import type { Member } from "../../api/schemas";
import { Dialog } from "../components/Overlay";
import { StyledName } from "./NameStyle";
import { StyledAvatar } from "./ProfileStyle";
import { useOrbit } from "../../application/orbit";
import { BotDirectMessages } from "./BotDirectMessages";
type BotIdentity = Pick<Member, "id" | "displayName" | "avatarColor"> & Partial<Pick<Member, "photoRev" | "avatarMedia" | "profileStyle" | "tag" | "mojo" | "statusText" | "statusEmoji">>;
/** Bot profiles use their native identity and personal consent controls. */
export function BotProfileDialog({ bot, onClose }: { bot: BotIdentity; onClose: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const direct = useOrbit((state) => state.server?.features.includes("bot-direct-messages") ?? false);
  const status = [bot.statusEmoji, bot.statusText].filter(Boolean).join(" ");
  return (
    <Dialog
      title={uiText("files.interface.bot_details_83f995e")}
      onClose={onClose}
      footer={
        <button className="btn btn-secondary" onClick={onClose}>
          {l10n("common.actions.done")}
        </button>
      }
    >
      <div className="dialog-body">
        <div className="bot-identity">
          <StyledAvatar
            userId={bot.id}
            name={bot.displayName}
            colorIndex={bot.avatarColor}
            photoRev={bot.photoRev ?? null}
            media={bot.avatarMedia ?? null}
            decoration={bot.profileStyle?.decoration ?? null}
            collectibles={bot.profileStyle?.collectibles}
            size={56}
          />
          <span className="lines">
            <strong>
              <StyledName name={bot.displayName} style={bot.profileStyle} tag={bot.tag} mojo={bot.mojo} bot className="ellipsis" />
            </strong>
            <small>
              <Localized k="files.interface.automated_community_account_e61bc60" />
            </small>
          </span>
        </div>
        {status && <p>{status}</p>}
        <p className="faint">
          <Localized k="files.interface.find_this_bot_s_messages_and_supported_commands_in_your_community_7d13528" />
        </p>
        {direct && <BotDirectMessages key={bot.id} botId={bot.id} onClose={onClose} />}
      </div>
    </Dialog>
  );
}
