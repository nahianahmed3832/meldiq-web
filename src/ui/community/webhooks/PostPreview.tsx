import { BotTag } from "../../components/BotTag";
import { draftPreview, type PostDraft } from "../../../sync/posting/draft";
import { avatarRevOf } from "../../../sync/posting/embeds";
import type { Webhook } from "../../../sync/posting/api";
import { EmbedBox, PostedContent } from "../../chat/PostedContent";
import { WebhookAvatar } from "../../chat/WebhookSender";

/** "Make a post" › Preview: the post as members will see it, drawn by the same views as a received one. */
export function PostPreview({ draft, webhook, orgId, channelId }: { draft: PostDraft; webhook: Webhook | null; orgId: string; channelId: string }) {
  const { embeds, buttons } = draftPreview(draft);
  const name = webhook?.name ?? "New webhook";
  return (
    <section className="builder-preview" aria-label="Preview">
      <h4 className="builder-label">Preview</h4>
      <div className="msg first preview-msg">
        <div className="msg-gutter">
          <WebhookAvatar id={webhook?.id ?? "new"} name={name} avatarRev={webhook ? avatarRevOf(webhook.avatarUrl, webhook.id) : null} />
        </div>
        <div className="msg-main">
          <div className="msg-head">
            <span className="msg-name webhook-name">
              {name} <BotTag />
            </span>
          </div>
          {draft.threadName.trim() && <strong className="preview-title">{draft.threadName.trim()}</strong>}
          {draft.content.trim() && <div className="msg-text preview-text">{draft.content.trim()}</div>}
          {embeds.map((e, i) => (
            <EmbedBox key={i} embed={e} />
          ))}
          {buttons.length > 0 && <PostedContent rich={{ buttons }} orgId={orgId} channelId={channelId} />}
          {!draft.content.trim() && embeds.length === 0 && <p className="faint">Nothing to show yet.</p>}
        </div>
      </div>
    </section>
  );
}
