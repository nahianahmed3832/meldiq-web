import type { Member } from "../../api/schemas";
import { Dialog } from "../components/Overlay";
import { StyledName } from "./NameStyle";
import { StyledAvatar } from "./ProfileStyle";

type BotIdentity = Pick<Member, "id" | "displayName" | "avatarColor"> & Partial<Pick<Member, "photoRev" | "avatarMedia" | "profileStyle" | "tag" | "mojo" | "statusText" | "statusEmoji">>;

/** Bot accounts have a community identity; they do not use the human profile or direct-message API. */
export function BotProfileDialog({ bot, onClose }: { bot: BotIdentity; onClose: () => void }) {
  const status = [bot.statusEmoji, bot.statusText].filter(Boolean).join(" ");
  return (
    <Dialog
      title="Bot details"
      onClose={onClose}
      footer={
        <button className="btn btn-secondary" onClick={onClose}>
          Done
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
            <small>Automated community account</small>
          </span>
        </div>
        {status && <p>{status}</p>}
        <p className="faint">Find this bot's messages and supported commands in your community's channels.</p>
      </div>
    </Dialog>
  );
}
