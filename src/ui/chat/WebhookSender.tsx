import { BotTag } from "../components/BotTag";
import { Avatar, colorIndexOf } from "../components/Avatar";
import { usePhoto } from "../components/photos";
import type { PostWebhook } from "../../sync/posting/embeds";

/** A webhook's picture (its own, fetched with the session), or its initials. */
export function WebhookAvatar({ id, name, avatarRev, size = 38 }: { id: string; name: string; avatarRev: number | null; size?: number }) {
  const photo = usePhoto("webhook", id, avatarRev);
  return <Avatar name={name} colorIndex={colorIndexOf(id)} size={size} photoUrl={photo} decorative />;
}

/** Who posted through a webhook: its name with the BOT tag, in place of a member's name. */
export function WebhookName({ webhook }: { webhook: PostWebhook }) {
  return (
    <span className="msg-name webhook-name">
      {webhook.name} <BotTag title="Posted through a webhook" />
    </span>
  );
}
