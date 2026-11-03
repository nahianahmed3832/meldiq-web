import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { BotTag } from "../components/BotTag";
import { Avatar, colorIndexOf } from "../components/Avatar";
import { usePhoto } from "../components/photos";
import type { PostWebhook } from "../../sync/posting/embeds";
/** A webhook's picture (its own, fetched with the session), or its initials. */
export function WebhookAvatar({ id, name, avatarRev, size = 38 }: { id: string; name: string; avatarRev: number | null; size?: number }) {
  useLocaleRender();
  const photo = usePhoto("webhook", id, avatarRev);
  return <Avatar name={name} colorIndex={colorIndexOf(id)} size={size} photoUrl={photo} decorative />;
}
/** Who posted through a webhook: its name with the BOT tag, in place of a member's name. */
export function WebhookName({ webhook }: { webhook: PostWebhook }) {
  useLocaleRender();
  return (
    <span className="msg-name webhook-name">
      {webhook.name} <BotTag title={uiText("messaging.interface.posted_through_a_webhook_608140f")} />
    </span>
  );
}
