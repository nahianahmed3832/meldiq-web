import { Copy, RefreshCw, Trash2, Webhook } from "lucide-react";
import { type FormEvent, useState } from "react";
import type { OrgAdminDetail } from "../../api/workspaceSchemas";
import { useEngine } from "../../app/orbit";
import {
  directoryGroups,
  type App,
  appDirectory,
  createWebhook,
  declineApp,
  deleteWebhook,
  installApp,
  requestApp,
  rotateWebhook,
  setAppEnabled,
  STATE_LABEL,
  uninstallApp,
  webhooks,
  workflows,
} from "../../sync/apps";
import { workspaceChannels } from "../../sync/workspaces";
import { relative } from "../format";
import { useAction, useLoad } from "./useLoad";
import { Card, ErrorLine } from "./WorkspaceView";

const ACTION_LABEL: Record<string, string> = { install: "Install", request: "Ask an admin", approve: "Approve", decline: "Decline", uninstall: "Uninstall" };

/**
 * Workspace › Apps (android ui/screens/workspace/apps, server docs/INTEGRATIONS.md): the app directory with each app's
 * honest state, the install lifecycle as far as this person may, incoming webhooks and workflows. Connecting a personal
 * account from the browser waits on a server change (its sign-in currently returns only to the phone app).
 */
export function AppsPage({ detail }: { detail: OrgAdminDetail }) {
  const engine = useEngine();
  const orgId = detail.org.id;
  const [version, setVersion] = useState(0);
  const dir = useLoad(() => appDirectory(engine, orgId), [engine, orgId, version]);
  const act = useAction();
  const reload = () => setVersion((v) => v + 1);
  const run = (fn: () => Promise<unknown>) => void act.act(() => fn().then(reload));

  const actionsFor = (a: App) => {
    const out: { key: string; label: string; danger?: boolean; fn: () => Promise<unknown> }[] = [];
    for (const k of a.actions) {
      if (k === "install" || k === "approve") out.push({ key: k, label: ACTION_LABEL[k], fn: () => installApp(engine, orgId, a.id) });
      else if (k === "request") out.push({ key: k, label: ACTION_LABEL[k], fn: () => requestApp(engine, orgId, a.id, null) });
      else if (k === "decline") out.push({ key: k, label: ACTION_LABEL[k], fn: () => declineApp(engine, orgId, a.id) });
      else if (k === "configure") out.push({ key: k, label: a.state === "disabled" ? "Turn on" : "Turn off", fn: () => setAppEnabled(engine, orgId, a.id, a.state === "disabled") });
      else if (k === "uninstall") out.push({ key: k, label: ACTION_LABEL[k], danger: true, fn: () => uninstallApp(engine, orgId, a.id) });
    }
    return out;
  };

  const { recommended, more } = directoryGroups(dir.data?.apps ?? []);
  const row = (a: App) => {
    const connectable = a.actions.includes("connect") || a.actions.includes("reconnect");
    return (
      <li key={a.id} className="ws-row" style={{ alignItems: "flex-start" }}>
        <span className="lines grow">
          <span>
            {a.name}{" "}
            <span className={`tag${a.state === "connected" || a.state === "installed" ? " ok" : a.state === "error" || a.state === "blocked" ? " danger" : ""}`}>
              {STATE_LABEL[a.state] ?? a.state}
            </span>
          </span>
          <small>{a.summary ?? a.publisher ?? ""}</small>
          {a.state === "needs_configuration" && <small>The server doesn't have this app's sign-in set up yet (an administrator of the Meldiq server registers it with the provider).</small>}
          {connectable && <small>Connect your own account from the Meldiq phone app for now: signing in from the browser is coming in a server update.</small>}
        </span>
        <span className="row" style={{ gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {actionsFor(a).map((x) => (
            <button
              key={x.key}
              className={`btn btn-sm ${x.danger ? "btn-danger-quiet" : x.key === "install" || x.key === "approve" ? "btn-primary" : "btn-secondary"}`}
              disabled={act.busy}
              onClick={() => run(x.fn)}
            >
              {x.label}
            </button>
          ))}
        </span>
      </li>
    );
  };
  return (
    <div className="ws-page">
      <ErrorLine text={act.error ?? dir.error} />
      <Card title="Apps" sub="Connect the tools your workspace uses. Items shared from an app go into end-to-end encrypted messages as links; the app decides who can open them.">
        {!dir.data ? (
          <span className="skeleton" style={{ height: 120 }} />
        ) : (
          <>
            {recommended.length > 0 && (
              <section aria-labelledby="apps-recommended">
                <h3 id="apps-recommended" className="ws-subhead">
                  Recommended
                </h3>
                <ul className="ws-list">{recommended.map(row)}</ul>
              </section>
            )}
            {more.length > 0 && (
              <section aria-labelledby="apps-more">
                <h3 id="apps-more" className="ws-subhead">
                  More apps
                </h3>
                <ul className="ws-list">{more.map(row)}</ul>
              </section>
            )}
            {recommended.length === 0 && more.length === 0 && <p className="muted">No apps are available on this server yet.</p>}
          </>
        )}
      </Card>
      <Webhooks orgId={orgId} />
      <Workflows orgId={orgId} />
    </div>
  );
}

/** Incoming webhooks: a secret URL per channel for your own tools (works end to end, no provider needed). */
function Webhooks({ orgId }: { orgId: string }) {
  const engine = useEngine();
  const [version, setVersion] = useState(0);
  const list = useLoad(() => webhooks(engine, orgId), [engine, orgId, version]);
  const channels = useLoad(() => workspaceChannels(engine, orgId, false), [engine, orgId]);
  const [name, setName] = useState("");
  const [channel, setChannel] = useState("");
  const [secret, setSecret] = useState<{ url: string; secret: string } | null>(null);
  const act = useAction();
  const reload = () => setVersion((v) => v + 1);
  const create = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !channel) return;
    void act.act(async () => {
      const r = await createWebhook(engine, orgId, channel, name.trim());
      setSecret({ url: r.hook.url, secret: r.secret });
      setName("");
      reload();
    });
  };
  if (list.error && !list.data) return null; // not allowed here: the server says so
  return (
    <Card title="Incoming webhooks" sub="Post into a channel from your own tools with a secret URL. What they post isn't end-to-end encrypted.">
      <ErrorLine text={act.error} />
      {secret && (
        <div className="banner warn" role="status" style={{ display: "grid", gap: 6 }}>
          <span>Copy the secret now: it isn't shown again.</span>
          <code className="link-full">{secret.url}</code>
          <code className="link-full">Authorization: Bearer {secret.secret}</code>
          <span className="row" style={{ gap: 6 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => void navigator.clipboard?.writeText(`${secret.url}\nAuthorization: Bearer ${secret.secret}`)}>
              <Copy size={14} /> Copy
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setSecret(null)}>
              Done
            </button>
          </span>
        </div>
      )}
      <ul className="ws-list">
        {(list.data ?? []).map((h) => (
          <li key={h.id} className="ws-row">
            <Webhook size={16} className="faint" />
            <span className="lines grow">
              <span>{h.name}</span>
              <small>
                #{h.channelName ?? "channel"} · {h.lastDeliveryAt ? `last post ${relative(h.lastDeliveryAt)}` : "no posts yet"}
                {h.lastError ? ` · ${h.lastError}` : ""}
                {!h.active ? " · paused" : ""}
              </small>
            </span>
            <button
              className="btn btn-ghost btn-sm"
              aria-label={`New secret for ${h.name}`}
              disabled={act.busy}
              onClick={() => void act.act(async () => setSecret({ url: h.url, secret: (await rotateWebhook(engine, orgId, h.id)).secret }))}
            >
              <RefreshCw size={14} />
            </button>
            <button className="btn btn-ghost btn-sm" aria-label={`Delete ${h.name}`} disabled={act.busy} onClick={() => void act.act(() => deleteWebhook(engine, orgId, h.id).then(reload))}>
              <Trash2 size={14} />
            </button>
          </li>
        ))}
        {list.data?.length === 0 && <li className="faint">No webhooks yet.</li>}
      </ul>
      <form className="row" style={{ gap: 8, flexWrap: "wrap" }} onSubmit={create}>
        <input
          className="input input-sm"
          style={{ flex: "1 1 180px" }}
          placeholder="Name, e.g. Deploy bot"
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          aria-label="Webhook name"
        />
        <select className="input input-sm" value={channel} onChange={(e) => setChannel(e.target.value)} aria-label="Channel">
          <option value="">Choose a channel</option>
          {(channels.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              #{c.name}
            </option>
          ))}
        </select>
        <button className="btn btn-secondary btn-sm" disabled={!name.trim() || !channel || act.busy}>
          Create webhook
        </button>
      </form>
    </Card>
  );
}

function Workflows({ orgId }: { orgId: string }) {
  const engine = useEngine();
  const list = useLoad(() => workflows(engine, orgId), [engine, orgId]);
  if (!list.data || list.data.length === 0) return null;
  return (
    <Card title="Workflows" sub="Everything that posts into this workspace's channels automatically.">
      <ul className="ws-list">
        {list.data.map((w, i) => (
          <li key={w.id ?? i} className="ws-row">
            <span className="lines grow">
              <span>
                {w.trigger ?? "Trigger"} → {w.action ?? "post to a channel"}
              </span>
              <small>
                {w.owner ? `by ${w.owner}` : ""}
                {w.lastRunAt ? ` · last run ${relative(w.lastRunAt)}` : ""}
                {w.problem ? ` · ${w.problem}` : ""}
              </small>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
