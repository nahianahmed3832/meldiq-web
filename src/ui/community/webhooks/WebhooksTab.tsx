import { PenSquare, Plus } from "lucide-react";
import { useState } from "react";
import type { Conversation } from "../../../api/schemas";
import { useEngine } from "../../../application/orbit";
import { createWebhook, listWebhooks, type Webhook } from "../../../sync/posting/api";
import { useAction, useLoad } from "../../workspace/useLoad";
import { PostBuilder } from "./PostBuilder";
import { type Secret, WebhookRow } from "./WebhookRow";

/**
 * Edit channel › Webhooks (the reference's tab): each webhook is a secret address anyone holding it can post to, as
 * the webhook's name. Up to 10 per channel; the address is shown once, when made or replaced. "Make a post" builds a
 * post with boxes and buttons and sends it through one.
 */
export function WebhooksTab({ channel, orgId }: { channel: Conversation; orgId: string }) {
  const engine = useEngine();
  const list = useLoad(() => listWebhooks(engine, orgId, channel.id), [engine, orgId, channel.id]);
  const create = useAction();
  const [secret, setSecret] = useState<Secret | null>(null);
  const [building, setBuilding] = useState(false);
  const [extra, setExtra] = useState<Webhook[]>([]);
  const [gone, setGone] = useState<string[]>([]);
  const hooks = mergeHooks(list.data?.webhooks ?? [], extra).filter((w) => !gone.includes(w.id));
  const limit = list.data?.limit ?? 10;
  const full = hooks.length >= limit;

  const make = () =>
    void create.act(async () => {
      const made = await createWebhook(engine, orgId, channel.id);
      setExtra((x) => [...x, made.webhook]);
      setSecret({ webhookId: made.webhook.id, token: made.token });
    });
  const changed = (w: Webhook | null, id: string) => {
    setExtra((x) => [...x.filter((h) => h.id !== id), ...(w ? [w] : [])]);
    if (!w) setGone((g) => [...g, id]);
  };

  return (
    <div className="dialog-body webhooks">
      <p className="muted" style={{ margin: 0 }}>
        A webhook lets an app or a site post here: anyone who has its address can post as it. Keep the address secret, and make a new one if it gets out.
      </p>
      {(list.error || create.error) && (
        <div className="banner danger" role="alert">
          {create.error ?? list.error}
        </div>
      )}
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="btn btn-primary btn-sm" disabled={full || create.busy || !list.data} onClick={make}>
          <Plus size={15} /> New webhook
        </button>
        <button type="button" className="btn btn-secondary btn-sm" disabled={!list.data || (hooks.length === 0 && full)} onClick={() => setBuilding(true)}>
          <PenSquare size={15} /> Make a post
        </button>
        <span className="grow" />
        <span className="faint" aria-live="polite">
          {hooks.length} of {limit}
        </span>
      </div>
      {list.loading && !list.data && <span className="skeleton" aria-busy="true" style={{ height: 56 }} />}
      {list.data && hooks.length === 0 && <p className="faint">No webhooks yet.</p>}
      <ul className="webhook-list" aria-label="Webhooks">
        {hooks.map((w) => (
          <WebhookRow key={w.id} webhook={w} orgId={orgId} secret={secret?.webhookId === w.id ? secret : null} onSecret={setSecret} onChanged={(next) => changed(next, w.id)} />
        ))}
      </ul>
      {building && (
        <PostBuilder
          channel={channel}
          orgId={orgId}
          webhooks={hooks}
          onWebhookMade={(w, token) => {
            setExtra((x) => [...x, w]);
            setSecret({ webhookId: w.id, token });
          }}
          onClose={() => setBuilding(false)}
        />
      )}
    </div>
  );
}

/** The loaded list with this session's own changes over it (a new or changed webhook shows before the reload lands). */
function mergeHooks(loaded: readonly Webhook[], extra: readonly Webhook[]): Webhook[] {
  const byId = new Map(loaded.map((w) => [w.id, w]));
  for (const w of extra) byId.set(w.id, w);
  return [...byId.values()].sort((a, b) => a.createdAt - b.createdAt);
}
