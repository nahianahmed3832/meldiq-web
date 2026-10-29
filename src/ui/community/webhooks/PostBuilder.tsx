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
  const engine = useEngine();
  const community = useOrbit((s) => s.orgs.find((o) => o.id === orgId)?.name ?? "the community");
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
      engine.notice("info", `Posted as ${target.name}.`);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't post. Try again.");
    } finally {
      setBusy(false);
    }
  };
  const copyJson = () =>
    void navigator.clipboard
      ?.writeText(draftToJson(draft))
      .then(() => setCopied(true))
      .catch(() => engine.notice("error", "Couldn't copy the JSON."));

  return (
    <Dialog
      title="Make a post"
      subtitle={`In #${channel.name ?? "channel"}, posted by a webhook`}
      onClose={onClose}
      width="min(1080px, 96vw)"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy || problems.length > 0} onClick={() => void post()}>
            {busy ? "Posting…" : "Post"}
          </button>
        </>
      }
    >
      <div className="dialog-body post-builder">
        <div className="builder-form">
          <div className="row builder-tools">
            <label className="field grow">
              <span className="label">Post as</span>
              <select className="input" value={webhookId ?? ""} onChange={(e) => setWebhookId(e.target.value || null)}>
                {webhooks.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
                {webhooks.length === 0 && <option value="">A new webhook (made when you post)</option>}
              </select>
            </label>
            <button type="button" className="btn btn-ghost btn-sm" onClick={(e) => emoji.open(e.currentTarget)} aria-haspopup="menu">
              <Smile size={15} /> Emoji
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setImporting(true)}>
              <FileInput size={15} /> Import JSON
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={copyJson}>
              <Copy size={15} /> {copied ? "Copied" : "Copy JSON"}
            </button>
          </div>
          {error && (
            <div className="banner danger" role="alert">
              {error}
            </div>
          )}
          {forum && (
            <label className="field">
              <span className="label">Post title</span>
              <input className="input" value={draft.threadName} maxLength={DRAFT_LIMITS.threadName} onChange={(e) => change({ threadName: e.target.value })} />
            </label>
          )}
          <label className="field">
            <span className="label">Text above the boxes</span>
            <textarea className="textarea" rows={2} value={draft.content} maxLength={DRAFT_LIMITS.content} onChange={(e) => change({ content: e.target.value })} />
          </label>
          <section className="builder-section" aria-label="Boxes">
            <h4 className="builder-label">Boxes</h4>
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
                <Plus size={14} /> Add box
              </button>
            </div>
          </section>
          <ButtonsEditor buttons={draft.buttons} onChange={(buttons) => change({ buttons })} />
          {problems.length > 0 && (
            <ul className="builder-problems" aria-label="Before posting">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </div>
        <PostPreview draft={draft} webhook={webhook} orgId={orgId} channelId={channel.id} />
      </div>
      {emoji.anchor && (
        <Menu anchor={emoji.anchor} label="Emoji" onClose={emoji.close} entries={[{ custom: <EmojiPicker onPick={(e) => (emoji.close(), change({ content: `${draft.content}${e}` }))} /> }]} />
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
