import { useLocaleRender } from "../../../i18n/Localized";
import { text as uiText } from "../../../i18n";
import { Localized } from "../../../i18n/Localized";
import { useT as useLocalization } from "../../../i18n";
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
  useLocaleRender();
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
        <button
          type="button"
          className="webhook-avatar"
          aria-label={uiText("organization.interface.change_value0_s_picture_f4a9fe8", { value0: w.name })}
          disabled={act.busy}
          onClick={() => file.current?.click()}
        >
          <WebhookAvatar id={w.id} name={w.name} avatarRev={rev} size={44} />
          <span className="webhook-avatar-badge" aria-hidden>
            <Camera size={12} />
          </span>
        </button>
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
        <div className="grow webhook-lines">
          <input
            className="input input-sm"
            aria-label={uiText("organization.interface.webhook_name_d28bddc")}
            value={name}
            maxLength={POST_LIMITS.webhookName}
            onChange={(e) => setName(e.target.value)}
            onBlur={rename}
            onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
          />
          <small className="faint">
            {w.lastUsedAt ? uiText("organization.interface.last_used_value0_223e764", { value0: relative(w.lastUsedAt) }) : uiText("organization.interface.not_used_yet_9de8748")}
            {w.createdBy ? uiText("organization.interface.made_by_value0_2dda760", { value0: w.createdBy.displayName }) : ""}
          </small>
        </div>
        {rev !== null && (
          <button type="button" className="btn btn-ghost btn-sm" disabled={act.busy} onClick={() => void act.act(async () => onChanged(await removeWebhookAvatar(engine, orgId, w.channelId, w.id)))}>
            <Localized k="organization.interface.standard_picture_8a10581" />
          </button>
        )}
        <button type="button" className="btn btn-secondary btn-sm" disabled={act.busy} onClick={() => setConfirm("rotate")}>
          <Localized k="organization.interface.new_url_6289e14" slots={[<RefreshCw size={14} />]} />
        </button>
        <button
          type="button"
          className="icon-btn danger"
          aria-label={uiText("organization.interface.delete_value0_8782b77", { value0: w.name })}
          disabled={act.busy}
          onClick={() => setConfirm("delete")}
        >
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
  useLocaleRender();
  return (
    <div className="secret-box" role="alert">
      <strong>
        <Localized k="organization.interface.webhook_url_84805a7" />
      </strong>
      <small>
        <Localized k="organization.interface.copy_it_now_you_won_t_see_it_again_anyone_who_has_it_can_post_her_616adc9" />
      </small>
      <div className="secret-row">
        <code className="grow webhook-url">{address}</code>
        <CopyButton text={address} label={uiText("organization.interface.copy_the_webhook_url_4e901d6")} />
      </div>
      <div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onDone}>
          <Localized k="organization.interface.i_ve_saved_it_ad586e1" />
        </button>
      </div>
    </div>
  );
}
function ConfirmDialog({ kind, name, onClose, onConfirm }: { kind: "rotate" | "delete"; name: string; onClose: () => void; onConfirm: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const rotate = kind === "rotate";
  return (
    <Dialog
      title={rotate ? uiText("organization.interface.new_url_for_value0_891d30b", { value0: name }) : uiText("organization.interface.delete_value0_3d83de3", { value0: name })}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            {l10n("common.actions.cancel")}
          </button>
          <button className={`btn ${rotate ? "btn-primary" : "btn-danger"}`} data-autofocus onClick={onConfirm}>
            {rotate ? uiText("organization.interface.make_a_new_url_69bbf24") : l10n("common.actions.delete")}
          </button>
        </>
      }
    >
      <div className="dialog-body">
        <p className="muted" style={{ margin: 0 }}>
          {rotate
            ? uiText("organization.interface.the_current_url_stops_working_right_away_anything_using_it_needs_273fdd0")
            : uiText("organization.interface.its_url_stops_working_right_away_messages_it_already_posted_stay_998bc26")}
        </p>
      </div>
    </Dialog>
  );
}
