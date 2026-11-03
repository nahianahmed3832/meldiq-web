import { useLocaleRender } from "../../../i18n/Localized";
import { text as uiText } from "../../../i18n";
import { Localized } from "../../../i18n/Localized";
import { useT as useLocalization } from "../../../i18n";
import { Copy, FileInput, Plus, Smile } from "lucide-react";
import { useState } from "react";
import { ApiError } from "../../../api/client";
import type { Conversation } from "../../../api/schemas";
import { useEngine, useOrbit } from "../../../application/orbit";
import { createWebhook, postThroughWebhook, type Webhook } from "../../../sync/posting/api";
import { DRAFT_LIMITS, draftProblems, draftToJson, emptyBox, moved, type PostDraft, sampleDraft, toWebhookBody } from "../../../sync/posting/draft";
import { EmojiPicker } from "../../chat/EmojiPicker";
import { Dialog, Menu, useMenu } from "../../components/Overlay";
import { BoxEditor } from "./BoxEditor";
import { ButtonsEditor } from "./ButtonsEditor";
import { ImportJsonDialog } from "./ImportJsonDialog";
import { PostPreview } from "./PostPreview";
interface PostBuilderProps {
  channel: Conversation;
  orgId: string;
  webhooks: Webhook[];
  /** A webhook made to post with (the channel had none): its address is shown once in the list. */
  onWebhookMade: (w: Webhook, token: string) => void;
  onClose: () => void;
}
/**
 * Make a post (the reference's embed builder): pick the webhook to post as, write the text above the boxes, the boxes
 * and the link buttons, watch the preview, and post. The JSON is Discord's webhook format, so it can be copied out to an
 * app or pasted in from one.
 */
export function PostBuilder({ channel, orgId, webhooks, onWebhookMade, onClose }: PostBuilderProps) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const community = useOrbit((s) => s.orgs.find((o) => o.id === orgId)?.name ?? uiText("organization.interface.the_community_3c1ea1c"));
  const [draft, setDraft] = useState<PostDraft>(() => sampleDraft(community));
  const [webhookId, setWebhookId] = useState<string | null>(webhooks[0]?.id ?? null);
  const [importing, setImporting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const emoji = useMenu();
  const forum = channel.format === "forum";
  const problems = draftProblems(draft, forum);
  const webhook = webhooks.find((w) => w.id === webhookId) ?? null;
  const change = (c: Partial<PostDraft>) => setDraft((d) => ({ ...d, ...c }));
  const post = async () => {
    if (problems.length) return;
    setBusy(true);
    setError(null);
    try {
      let target = webhook;
      if (!target) {
        const made = await createWebhook(engine, orgId, channel.id);
        onWebhookMade(made.webhook, made.token);
        target = made.webhook;
        setWebhookId(made.webhook.id);
      }
      await postThroughWebhook(engine, orgId, channel.id, target.id, toWebhookBody(draft));
      engine.notice("info", uiText("organization.interface.posted_as_value0_26f7346", { value0: target.name }));
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : uiText("organization.interface.couldn_t_post_try_again_5efa913"));
    } finally {
      setBusy(false);
    }
  };
  const copyJson = () =>
    void navigator.clipboard
      ?.writeText(draftToJson(draft))
      .then(() => setCopied(true))
      .catch(() => engine.notice("error", uiText("organization.interface.couldn_t_copy_the_json_e4ba694")));
  return (
    <Dialog
      title={uiText("organization.interface.make_a_post_6332cd4")}
      subtitle={uiText("organization.interface.in_value0_posted_by_a_webhook_5b3d503", { value0: channel.name ?? uiText("messaging.interface.channel_69e3656") })}
      onClose={onClose}
      width="min(1080px, 96vw)"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            {l10n("common.actions.cancel")}
          </button>
          <button className="btn btn-primary" disabled={busy || problems.length > 0} onClick={() => void post()}>
            {busy ? uiText("messaging.interface.posting_648a2ef") : uiText("messaging.interface.post_a555462")}
          </button>
        </>
      }
    >
      <div className="dialog-body post-builder">
        <div className="builder-form">
          <div className="row builder-tools">
            <label className="field grow">
              <span className="label">
                <Localized k="organization.interface.post_as_17d7dbc" />
              </span>
              <select className="input" value={webhookId ?? ""} onChange={(e) => setWebhookId(e.target.value || null)}>
                {webhooks.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
                {webhooks.length === 0 && (
                  <option value="">
                    <Localized k="organization.interface.a_new_webhook_made_when_you_post_addcb1a" />
                  </option>
                )}
              </select>
            </label>
            <button type="button" className="btn btn-ghost btn-sm" onClick={(e) => emoji.open(e.currentTarget)} aria-haspopup="menu">
              <Localized k="organization.interface.emoji_6a31b86" slots={[<Smile size={15} />]} />
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setImporting(true)}>
              <Localized k="organization.interface.import_json_12e3a0d" slots={[<FileInput size={15} />]} />
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={copyJson}>
              <Copy size={15} /> {copied ? l10n("common.common_copied") : uiText("organization.interface.copy_json_7708c6e")}
            </button>
          </div>
          {error && (
            <div className="banner danger" role="alert">
              {error}
            </div>
          )}
          {forum && (
            <label className="field">
              <span className="label">
                <Localized k="organization.interface.post_title_c45dcb7" />
              </span>
              <input className="input" value={draft.threadName} maxLength={DRAFT_LIMITS.threadName} onChange={(e) => change({ threadName: e.target.value })} />
            </label>
          )}
          <label className="field">
            <span className="label">
              <Localized k="organization.interface.text_above_the_boxes_3df6a6c" />
            </span>
            <textarea className="textarea" rows={2} value={draft.content} maxLength={DRAFT_LIMITS.content} onChange={(e) => change({ content: e.target.value })} />
          </label>
          <section className="builder-section" aria-label={uiText("organization.interface.boxes_5509dc6")}>
            <h4 className="builder-label">
              <Localized k="organization.interface.boxes_5509dc6" />
            </h4>
            {draft.boxes.map((b, i) => (
              <BoxEditor
                key={b.key}
                box={b}
                index={i}
                count={draft.boxes.length}
                onChange={(next) => change({ boxes: draft.boxes.map((x) => (x.key === b.key ? next : x)) })}
                onMove={(by) => change({ boxes: moved(draft.boxes, i, by) })}
                onRemove={() => change({ boxes: draft.boxes.filter((x) => x.key !== b.key) })}
              />
            ))}
            <div>
              <button type="button" className="btn btn-ghost btn-sm" disabled={draft.boxes.length >= DRAFT_LIMITS.boxes} onClick={() => change({ boxes: [...draft.boxes, emptyBox("#5865f2")] })}>
                <Localized k="organization.interface.add_box_d7d7e29" slots={[<Plus size={14} />]} />
              </button>
            </div>
          </section>
          <ButtonsEditor buttons={draft.buttons} onChange={(buttons) => change({ buttons })} />
          {problems.length > 0 && (
            <ul className="builder-problems" aria-label={uiText("organization.interface.before_posting_8d32ba7")}>
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </div>
        <PostPreview draft={draft} webhook={webhook} orgId={orgId} channelId={channel.id} />
      </div>
      {emoji.anchor && (
        <Menu
          anchor={emoji.anchor}
          label={uiText("messaging.interface.emoji_61ad897")}
          onClose={emoji.close}
          entries={[{ custom: <EmojiPicker onPick={(e) => (emoji.close(), change({ content: `${draft.content}${e}` }))} /> }]}
        />
      )}
      {importing && (
        <ImportJsonDialog
          onClose={() => setImporting(false)}
          onImport={(d) => {
            setDraft(d);
            setImporting(false);
          }}
        />
      )}
    </Dialog>
  );
}
