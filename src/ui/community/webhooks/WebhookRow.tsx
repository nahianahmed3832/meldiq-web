import { Camera, RefreshCw, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { apiBase } from "../../../application/config";
import { useEngine, useOrbit } from "../../../application/orbit";
import { deleteWebhook, removeWebhookAvatar, renameWebhook, rotateWebhook, setWebhookAvatar, type Webhook, webhookAddress } from "../../../sync/posting/api";
import { avatarRevOf, POST_LIMITS } from "../../../sync/posting/embeds";
import { CopyButton } from "../../components/CopyButton";
import { Dialog } from "../../components/Overlay";
import { relative } from "../../format";
import { WebhookAvatar } from "../../chat/WebhookSender";
import { animatedUpload, squareJpeg } from "../../workspace/photo";
import { useAction } from "../../workspace/useLoad";

/** A webhook's secret token, shown once after it was made or replaced. */
export interface Secret {
  webhookId: string;
  token: string;
}

interface WebhookRowProps {
  webhook: Webhook;
  orgId: string;
  secret: Secret | null;
  onSecret: (s: Secret | null) => void;
  /** The webhook as it is now, or null once deleted. */
  onChanged: (w: Webhook | null) => void;
}

/** One webhook: its picture and name (both editable), when it was last used, its address once, New URL and Delete. */
export function WebhookRow({ webhook: w, orgId, secret, onSecret, onChanged }: WebhookRowProps) {
  const engine = useEngine();
  const animated = useOrbit((s) => s.server?.features.includes("animated-community-images") ?? false);
  const [name, setName] = useState(w.name);
  const [confirm, setConfirm] = useState<"rotate" | "delete" | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const act = useAction();
  const rename = () => {
    const next = name.trim();
    if (!next || next === w.name) return setName(w.name);
    void act.act(async () => onChanged(await renameWebhook(engine, orgId, w.channelId, w.id, next)));
  };
  const pick = (f: File | undefined) => {
    if (!f) return;
    void act.act(async () => {
      const image = (await animatedUpload(f, "icon", animated)) ?? (await squareJpeg(f));
      onChanged(await setWebhookAvatar(engine, orgId, w.channelId, w.id, image));
    });
  };
  const rotate = () =>
    void act.act(async () => {
      const made = await rotateWebhook(engine, orgId, w.channelId, w.id);
      onChanged(made.webhook);
      onSecret({ webhookId: w.id, token: made.token });
    });
  const remove = () =>
    void act.act(async () => {
      await deleteWebhook(engine, orgId, w.channelId, w.id);
      if (secret) onSecret(null);
      onChanged(null);
    });
  const rev = avatarRevOf(w.avatarUrl, w.id);

  return (
    <li className="webhook-row">
      <div className="webhook-main">
        <button type="button" className="webhook-avatar" aria-label={`Change ${w.name}'s picture`} disabled={act.busy} onClick={() => file.current?.click()}>
          <WebhookAvatar id={w.id} name={w.name} avatarRev={rev} size={44} />
          <span className="webhook-avatar-badge" aria-hidden>
            <Camera size={12} />
          </span>
        </button>
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
        <div className="grow webhook-lines">
          <input
            className="input input-sm"
            aria-label="Webhook name"
            value={name}
            maxLength={POST_LIMITS.webhookName}
            onChange={(e) => setName(e.target.value)}
            onBlur={rename}
            onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
          />
          <small className="faint">
            {w.lastUsedAt ? `Last used ${relative(w.lastUsedAt)}` : "Not used yet"}
            {w.createdBy ? ` · made by ${w.createdBy.displayName}` : ""}
          </small>
        </div>
        {rev !== null && (
          <button type="button" className="btn btn-ghost btn-sm" disabled={act.busy} onClick={() => void act.act(async () => onChanged(await removeWebhookAvatar(engine, orgId, w.channelId, w.id)))}>
            Standard picture
          </button>
        )}
        <button type="button" className="btn btn-secondary btn-sm" disabled={act.busy} onClick={() => setConfirm("rotate")}>
          <RefreshCw size={14} /> New URL
        </button>
        <button type="button" className="icon-btn danger" aria-label={`Delete ${w.name}`} disabled={act.busy} onClick={() => setConfirm("delete")}>
          <Trash2 size={16} />
        </button>
      </div>
      {act.error && (
        <div className="banner danger" role="alert">
          {act.error}
        </div>
      )}
      {secret && <AddressOnce address={webhookAddress(apiBase() || location.origin, w.id, secret.token)} onDone={() => onSecret(null)} />}
      {confirm && (
        <ConfirmDialog
          kind={confirm}
          name={w.name}
          onClose={() => setConfirm(null)}
          onConfirm={() => {
            setConfirm(null);
            if (confirm === "rotate") rotate();
            else remove();
          }}
        />
      )}
    </li>
  );
}

/** The address, this once: "Copy it now, you won't see it again". */
function AddressOnce({ address, onDone }: { address: string; onDone: () => void }) {
  return (
    <div className="secret-box" role="alert">
      <strong>Webhook URL</strong>
      <small>Copy it now, you won't see it again. Anyone who has it can post here as this webhook.</small>
      <div className="secret-row">
        <code className="grow webhook-url">{address}</code>
        <CopyButton text={address} label="Copy the webhook URL" />
      </div>
      <div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onDone}>
          I've saved it
        </button>
      </div>
    </div>
  );
}

function ConfirmDialog({ kind, name, onClose, onConfirm }: { kind: "rotate" | "delete"; name: string; onClose: () => void; onConfirm: () => void }) {
  const rotate = kind === "rotate";
  return (
    <Dialog
      title={rotate ? `New URL for ${name}?` : `Delete ${name}?`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className={`btn ${rotate ? "btn-primary" : "btn-danger"}`} data-autofocus onClick={onConfirm}>
            {rotate ? "Make a new URL" : "Delete"}
          </button>
        </>
      }
    >
      <div className="dialog-body">
        <p className="muted" style={{ margin: 0 }}>
          {rotate ? "The current URL stops working right away. Anything using it needs the new one." : "Its URL stops working right away. Messages it already posted stay."}
        </p>
      </div>
    </Dialog>
  );
}
