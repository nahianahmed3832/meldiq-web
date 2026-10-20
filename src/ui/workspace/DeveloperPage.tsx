import { Copy, KeyRound, Plus, Webhook as WebhookIcon } from "lucide-react";
import { useState } from "react";
import type { OrgAdminDetail } from "../../api/workspaceSchemas";
import { useEngine } from "../../app/orbit";
import {
  type ApiKey,
  createApiKey,
  createWebhook,
  deleteWebhook,
  developerCatalog,
  KEY_DAYS,
  keyState,
  listApiKeys,
  listWebhooks,
  revokeApiKey,
  rotateApiKey,
  rotateWebhookSecret,
  SCOPE_LABEL,
  testWebhook,
  updateWebhook,
  type Webhook,
  webhookDeliveries,
  webhookUrlProblem,
} from "../../sync/developer";
import { Dialog } from "../components/Overlay";
import { dayLabel, shortWhen } from "../format";
import { useAction, useLoad } from "./useLoad";
import { Card, ErrorLine } from "./WorkspaceView";

/** A token or signing secret just made: shown once, kept only while its dialog is open. */
interface Shown {
  name: string;
  secret: string;
  kind: "key" | "webhook";
}

/**
 * Workspace › API keys & webhooks (android round 7 C6 DeveloperScreen, server docs/DEVELOPER_API.md), for people with
 * `developers.manage`. Keys and webhooks reach workspace details only, never messages; they stop working when the
 * person who made them loses this permission.
 */
export function DeveloperPage({ detail }: { detail: OrgAdminDetail }) {
  const engine = useEngine();
  const orgId = detail.org.id;
  const [tick, setTick] = useState(0);
  const catalog = useLoad(() => developerCatalog(engine), [engine]);
  const keys = useLoad(() => listApiKeys(engine, orgId), [engine, orgId, tick]);
  const hooks = useLoad(() => listWebhooks(engine, orgId), [engine, orgId, tick]);
  const [dialog, setDialog] = useState<"key" | "hook" | null>(null);
  const [openKey, setOpenKey] = useState<ApiKey | null>(null);
  const [openHook, setOpenHook] = useState<Webhook | null>(null);
  const [shown, setShown] = useState<Shown | null>(null);
  const reload = () => setTick((t) => t + 1);
  return (
    <div className="ws-page">
      <p className="faint" style={{ margin: 0 }}>
        Keys and webhooks reach workspace details only: never messages (they're end-to-end encrypted), private channels, restricted documents, emails or phone numbers. They stop working if the person
        who made them loses this permission.
      </p>
      <Card
        title="API keys"
        sub="For your own tools: send as Authorization: Bearer mdq.… to /ext/v1. 120 requests a minute per key."
        actions={
          <button className="btn btn-primary btn-sm" disabled={!catalog.data} onClick={() => setDialog("key")}>
            <Plus size={14} /> New key
          </button>
        }
      >
        <ErrorLine text={catalog.error ?? keys.error} />
        {keys.data?.length === 0 && <p className="faint">No API keys yet.</p>}
        <ul className="ws-list">
          {(keys.data ?? []).map((k) => (
            <li key={k.id}>
              <button className="list-row" disabled={k.revoked} onClick={() => setOpenKey(k)}>
                <KeyRound size={18} className={k.revoked || k.expired || !k.ownerAllowed ? "faint" : undefined} />
                <span className="lines grow">
                  <strong>
                    {k.name} <span className="faint mono">…{k.hint}</span>
                  </strong>
                  <small>
                    {keyState(k, dayLabel)} · {k.scopes.join(", ")}
                  </small>
                  <small className="faint">
                    Made by {k.createdBy.name ?? "someone"}
                    {k.lastUsedAt ? ` · last used ${shortWhen(k.lastUsedAt)}` : " · never used"}
                  </small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Card>
      <Card
        title="Webhooks"
        sub="Workspace events sent to your https address, signed with a secret. A new webhook, and Send a test event, deliver a ping."
        actions={
          <button className="btn btn-primary btn-sm" disabled={!catalog.data} onClick={() => setDialog("hook")}>
            <Plus size={14} /> New webhook
          </button>
        }
      >
        <ErrorLine text={hooks.error} />
        {hooks.data?.length === 0 && <p className="faint">No webhooks yet.</p>}
        <ul className="ws-list">
          {(hooks.data ?? []).map((h) => (
            <li key={h.id}>
              <button className="list-row" onClick={() => setOpenHook(h)}>
                <WebhookIcon size={18} className={h.enabled ? undefined : "faint"} />
                <span className="lines grow">
                  <strong>{h.name}</strong>
                  <small className="ellipsis">{h.url}</small>
                  <small className={h.disabledReason ? "danger-text" : "faint"}>
                    {h.disabledReason ?? (h.enabled ? `${h.deliveries.delivered} delivered · ${h.deliveries.failed} failed · ${h.deliveries.waiting} waiting` : "Off")}
                  </small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      {dialog === "key" && catalog.data && (
        <NewKeyDialog
          orgId={orgId}
          scopes={catalog.data.scopes}
          onClose={() => setDialog(null)}
          onMade={(name, secret) => {
            setDialog(null);
            setShown({ name, secret, kind: "key" });
            reload();
          }}
        />
      )}
      {dialog === "hook" && catalog.data && (
        <HookDialog
          orgId={orgId}
          hook={null}
          events={catalog.data.events}
          onClose={() => setDialog(null)}
          onSaved={(name, secret) => {
            setDialog(null);
            if (secret) setShown({ name, secret, kind: "webhook" });
            reload();
          }}
        />
      )}
      {openKey && (
        <KeyDialog
          orgId={orgId}
          k={openKey}
          onClose={() => setOpenKey(null)}
          onChanged={(made) => {
            setOpenKey(null);
            if (made) setShown({ name: made.name, secret: made.secret, kind: "key" });
            reload();
          }}
        />
      )}
      {openHook && catalog.data && (
        <HookDetailDialog
          orgId={orgId}
          hook={openHook}
          events={catalog.data.events}
          onClose={() => setOpenHook(null)}
          onChanged={(secret) => {
            if (secret) setShown({ name: openHook.name, secret, kind: "webhook" });
            setOpenHook(null);
            reload();
          }}
        />
      )}
      {shown && <SecretDialog shown={shown} onClose={() => setShown(null)} />}
    </div>
  );
}

function NewKeyDialog({ orgId, scopes, onClose, onMade }: { orgId: string; scopes: string[]; onClose: () => void; onMade: (name: string, token: string) => void }) {
  const engine = useEngine();
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [days, setDays] = useState<number>(90);
  const act = useAction();
  const toggle = (s: string) => setPicked(picked.includes(s) ? picked.filter((x) => x !== s) : [...picked, s]);
  return (
    <Dialog
      title="New API key"
      onClose={onClose}
      footer={
        <button
          className="btn btn-primary"
          disabled={!name.trim() || picked.length === 0 || act.busy}
          onClick={() =>
            void act.act(async () => {
              const made = await createApiKey(engine, orgId, { name: name.trim(), scopes: picked, expiresInDays: days });
              onMade(made.key.name, made.token);
            })
          }
        >
          Create key
        </button>
      }
    >
      <div className="dialog-body">
        <label className="field">
          <span>Name</span>
          <input className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="e.g. CI notifications" autoFocus />
        </label>
        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>What it can do</legend>
          {scopes.map((s) => (
            <label key={s} className="row" style={{ gap: 8, fontSize: 13.5 }}>
              <input type="checkbox" checked={picked.includes(s)} onChange={() => toggle(s)} />
              <span>
                <span className="mono">{s}</span> <span className="faint">{SCOPE_LABEL[s] ?? ""}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="field">
          <span>Expires after</span>
          <span className="segmented" role="group" aria-label="Expires after">
            {KEY_DAYS.map((d) => (
              <button key={d} aria-pressed={days === d} onClick={() => setDays(d)}>
                {d} days
              </button>
            ))}
          </span>
        </div>
        <ErrorLine text={act.error} />
      </div>
    </Dialog>
  );
}

function KeyDialog({ orgId, k, onClose, onChanged }: { orgId: string; k: ApiKey; onClose: () => void; onChanged: (made: { name: string; secret: string } | null) => void }) {
  const engine = useEngine();
  const act = useAction();
  return (
    <Dialog title={k.name} onClose={onClose}>
      <div className="dialog-body">
        <p className="faint" style={{ margin: 0 }}>
          …{k.hint} · {keyState(k, dayLabel)} · {k.scopes.join(", ")}
        </p>
        <p style={{ margin: 0 }}>Rotating makes a new key with the same scopes and revokes this one at once. Revoking stops it at once.</p>
        <div className="row" style={{ gap: 8 }}>
          <button
            className="btn btn-secondary"
            disabled={act.busy}
            onClick={() =>
              void act.act(async () => {
                const made = await rotateApiKey(engine, orgId, k.id);
                onChanged({ name: made.key.name, secret: made.token });
              })
            }
          >
            Rotate key
          </button>
          <button className="btn btn-danger" disabled={act.busy} onClick={() => void act.act(() => revokeApiKey(engine, orgId, k.id).then(() => onChanged(null)))}>
            Revoke key
          </button>
        </div>
        <ErrorLine text={act.error} />
      </div>
    </Dialog>
  );
}

function HookDialog({ orgId, hook, events, onClose, onSaved }: { orgId: string; hook: Webhook | null; events: string[]; onClose: () => void; onSaved: (name: string, secret: string | null) => void }) {
  const engine = useEngine();
  const [name, setName] = useState(hook?.name ?? "");
  const [url, setUrl] = useState(hook?.url ?? "https://");
  const [picked, setPicked] = useState<string[]>(hook?.events ?? []);
  const act = useAction();
  const problem = url.trim() === "https://" ? null : webhookUrlProblem(url.trim());
  const toggle = (e: string) => setPicked(picked.includes(e) ? picked.filter((x) => x !== e) : [...picked, e]);
  const save = () =>
    void act.act(async () => {
      const input = { name: name.trim(), url: url.trim(), events: picked };
      if (hook) {
        await updateWebhook(engine, orgId, hook.id, { ...input, enabled: hook.enabled });
        onSaved(hook.name, null);
      } else {
        const made = await createWebhook(engine, orgId, input);
        onSaved(made.webhook.name, made.secret);
      }
    });
  return (
    <Dialog
      title={hook ? "Edit webhook" : "New webhook"}
      onClose={onClose}
      footer={
        <button className="btn btn-primary" disabled={!name.trim() || !url.trim().startsWith("https://") || !!problem || picked.length === 0 || act.busy} onClick={save}>
          Save
        </button>
      }
    >
      <div className="dialog-body">
        <label className="field">
          <span>Name</span>
          <input className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <label className="field">
          <span>Address (https)</span>
          <input className="input mono" value={url} maxLength={1000} onChange={(e) => setUrl(e.target.value)} inputMode="url" />
          <small className={problem ? "danger-text" : "faint"}>{problem ?? "Public https addresses only"}</small>
        </label>
        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Events to send</legend>
          <div className="chips">
            {events.map((e) => (
              <label key={e} className="chip">
                <input type="checkbox" checked={picked.includes(e)} onChange={() => toggle(e)} /> {e}
              </label>
            ))}
          </div>
        </fieldset>
        <ErrorLine text={act.error} />
      </div>
    </Dialog>
  );
}

function HookDetailDialog({ orgId, hook, events, onClose, onChanged }: { orgId: string; hook: Webhook; events: string[]; onClose: () => void; onChanged: (secret: string | null) => void }) {
  const engine = useEngine();
  const deliveries = useLoad(() => webhookDeliveries(engine, orgId, hook.id), [engine, orgId, hook.id]);
  const [editing, setEditing] = useState(false);
  const act = useAction();
  if (editing) return <HookDialog orgId={orgId} hook={hook} events={events} onClose={() => setEditing(false)} onSaved={() => onChanged(null)} />;
  const run = (fn: () => Promise<unknown>) => void act.act(async () => onChanged(((await fn()) as string | undefined) ?? null));
  return (
    <Dialog title={hook.name} wide onClose={onClose}>
      <div className="dialog-body">
        <p className="faint mono" style={{ margin: 0, overflowWrap: "anywhere" }}>
          {hook.url}
        </p>
        <small className="faint">{hook.events.join(", ")}</small>
        {hook.disabledReason && (
          <div className="banner warn" role="status">
            {hook.disabledReason}
          </div>
        )}
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button
            className="btn btn-secondary btn-sm"
            disabled={act.busy}
            onClick={() => run(() => updateWebhook(engine, orgId, hook.id, { name: hook.name, url: hook.url, events: hook.events, enabled: !hook.enabled }).then(() => undefined))}
          >
            {hook.enabled ? "Turn off" : "Turn on"}
          </button>
          <button className="btn btn-secondary btn-sm" disabled={act.busy} onClick={() => run(() => testWebhook(engine, orgId, hook.id).then(() => undefined))}>
            Send a test event
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
            Edit webhook
          </button>
          <button className="btn btn-secondary btn-sm" disabled={act.busy} onClick={() => run(() => rotateWebhookSecret(engine, orgId, hook.id))}>
            New signing secret
          </button>
          <button className="btn btn-danger btn-sm" disabled={act.busy} onClick={() => run(() => deleteWebhook(engine, orgId, hook.id).then(() => undefined))}>
            Delete webhook
          </button>
        </div>
        <ErrorLine text={act.error ?? deliveries.error} />
        <strong style={{ fontSize: 13 }}>Recent deliveries</strong>
        {deliveries.data?.length === 0 && <p className="faint">None yet.</p>}
        <ul className="ws-list">
          {(deliveries.data ?? []).map((d) => (
            <li key={d.id} className={d.state === "failed" ? "danger-text" : "faint"} style={{ fontSize: 12.5 }}>
              {shortWhen(d.createdAt)} · {d.event} · {d.state}
              {d.lastStatus ? ` · ${d.lastStatus}` : ""}
              {d.lastError && d.state !== "delivered" ? ` · ${d.lastError}` : ""} · {d.attempts}×
            </li>
          ))}
        </ul>
      </div>
    </Dialog>
  );
}

function SecretDialog({ shown, onClose }: { shown: Shown; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <Dialog
      title={shown.name}
      onClose={onClose}
      footer={
        <button className="btn btn-primary" onClick={onClose}>
          Done
        </button>
      }
    >
      <div className="dialog-body">
        <div className="banner warn" role="alert">
          Copy this now: Meldiq won't show it again.
        </div>
        <small className="faint">{shown.kind === "key" ? "API key token" : "Webhook signing secret"}</small>
        <code className="mono" style={{ overflowWrap: "anywhere", userSelect: "all", padding: 8, borderRadius: 8, background: "var(--surface-sunken)" }}>
          {shown.secret}
        </code>
        <button className="btn btn-secondary btn-sm" style={{ justifySelf: "start" }} onClick={() => void navigator.clipboard?.writeText(shown.secret).then(() => setCopied(true))}>
          <Copy size={14} /> {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </Dialog>
  );
}
