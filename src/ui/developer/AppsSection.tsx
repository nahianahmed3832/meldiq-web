import { AppWindow, KeyRound, Pencil, Plus, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useEngine } from "../../application/orbit";
import { APP_LIMIT, createApp, deleteApp, type DeveloperApp, developerApps, parseRedirectUris, rotateAppSecret, updateApp } from "../../sync/developer";
import { CopyButton, SecretBox } from "../components/CopyButton";
import { relative } from "../format";
import { useAction, useLoad } from "../workspace/useLoad";

/**
 * Developer › "Log in with Meldiq" apps (API 0.65.0 batch B): up to 10 apps, each an OAuth client whose ID is shown
 * here and whose secret is shown only when it's made or replaced. Redirect URIs are https, or http://localhost while
 * developing.
 */
export function AppsSection({ webOrigin }: { webOrigin: string }) {
  const engine = useEngine();
  const [version, setVersion] = useState(0);
  const list = useLoad(() => developerApps(engine), [engine, version]);
  const [making, setMaking] = useState(false);
  const [secret, setSecret] = useState<{ title: string; value: string } | null>(null);
  const reload = () => setVersion((v) => v + 1);
  const apps = list.data ?? [];

  return (
    <section className="card ws-card" aria-label="Log in with Meldiq apps">
      <header className="ws-card-head">
        <div className="grow">
          <h3>“Log in with Meldiq” apps {list.data ? `· ${apps.length}/${APP_LIMIT}` : ""}</h3>
          <p className="muted">Let people sign in to your website or app with their Meldiq account. They see what you'll get and say yes first.</p>
        </div>
        <button className="btn btn-secondary btn-sm" disabled={!list.data || apps.length >= APP_LIMIT} onClick={() => setMaking(true)}>
          <Plus size={14} /> New app
        </button>
      </header>
      {secret && <SecretBox title={secret.title} secret={secret.value} onDone={() => setSecret(null)} />}
      {making && (
        <AppForm
          submitLabel="Make app"
          onCancel={() => setMaking(false)}
          onSubmit={async (name, uris) => {
            const made = await createApp(engine, name, uris);
            setSecret({ title: `${made.app.name}'s client secret`, value: made.clientSecret });
            setMaking(false);
            reload();
          }}
        />
      )}
      {list.error && (
        <div className="banner danger" role="alert">
          {list.error}
        </div>
      )}
      {list.data && apps.length === 0 && !making && <p className="faint">No apps yet.</p>}
      <ul className="ws-list dev-list">
        {apps.map((a) => (
          <AppRow key={a.id} app={a} onChanged={reload} onSecret={(value) => setSecret({ title: `${a.name}'s new client secret`, value })} />
        ))}
      </ul>
      <HowAppsWork webOrigin={webOrigin} />
    </section>
  );
}

interface AppFormProps {
  initialName?: string;
  initialUris?: string[];
  /** Renaming isn't offered when only the redirect URIs are edited. */
  nameEditable?: boolean;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (name: string, uris: string[]) => Promise<void>;
}

function AppForm({ initialName = "", initialUris = [], nameEditable = true, submitLabel, onCancel, onSubmit }: AppFormProps) {
  const [name, setName] = useState(initialName);
  const [uris, setUris] = useState(initialUris.join("\n"));
  const [problem, setProblem] = useState<string | null>(null);
  const act = useAction();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseRedirectUris(uris);
    const bad = !name.trim() ? "Give the app a name." : "problem" in parsed ? parsed.problem : null;
    setProblem(bad);
    if (bad || "problem" in parsed) return;
    void act.act(() => onSubmit(name.trim(), parsed.uris));
  };
  return (
    <form className="ws-form" onSubmit={submit} noValidate aria-label={submitLabel}>
      {nameEditable && (
        <label className="field ws-wide">
          <span>App name</span>
          <input className="input" autoFocus maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
      )}
      <label className="field ws-wide">
        <span>Redirect URIs, one per line</span>
        <textarea className="input" rows={3} placeholder="https://example.com/auth/meldiq" value={uris} onChange={(e) => setUris(e.target.value)} />
        <small className="faint">Where Meldiq sends people back after they say yes. https, or http://localhost while you develop.</small>
      </label>
      {(problem || act.error) && (
        <div className="banner danger ws-wide" role="alert">
          {problem ?? act.error}
        </div>
      )}
      <div className="ws-form-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn btn-primary btn-sm" disabled={act.busy}>
          {act.busy ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

function AppRow({ app, onChanged, onSecret }: { app: DeveloperApp; onChanged: () => void; onSecret: (secret: string) => void }) {
  const engine = useEngine();
  const act = useAction();
  const [editing, setEditing] = useState(false);
  return (
    <li className="dev-item">
      <div className="ws-row">
        <AppWindow size={18} className="faint" />
        <span className="lines grow">
          <span className="ellipsis">{app.name}</span>
          <small>
            {app.redirectUris.length} redirect {app.redirectUris.length === 1 ? "URI" : "URIs"} · secret from {relative(app.secretRotatedAt)}
          </small>
        </span>
      </div>
      <div className="row dev-actions">
        <span className="faint">Client ID</span>
        <code className="ellipsis">{app.id}</code>
        <CopyButton text={app.id} label={`Copy ${app.name}'s client ID`} />
        <span className="grow" />
        <button className="btn btn-ghost btn-sm" onClick={() => setEditing((v) => !v)}>
          <Pencil size={14} /> Redirect URIs
        </button>
        <button
          className="btn btn-ghost btn-sm"
          disabled={act.busy}
          onClick={() => {
            if (!window.confirm(`Replace ${app.name}'s client secret? The current one stops working at once.`)) return;
            void act.act(async () => onSecret((await rotateAppSecret(engine, app.id)).clientSecret));
          }}
        >
          <KeyRound size={14} /> New secret
        </button>
        <button
          className="btn btn-danger-quiet btn-sm"
          disabled={act.busy}
          onClick={() => {
            if (window.confirm(`Delete ${app.name}? Everyone signed in to it with Meldiq is signed out of it.`)) void act.act(() => deleteApp(engine, app.id).then(onChanged));
          }}
        >
          <Trash2 size={14} /> Delete
        </button>
      </div>
      {editing ? (
        <AppForm
          initialName={app.name}
          initialUris={app.redirectUris}
          nameEditable={false}
          submitLabel="Save"
          onCancel={() => setEditing(false)}
          onSubmit={async (_name, uris) => {
            await updateApp(engine, app.id, { redirectUris: uris });
            setEditing(false);
            onChanged();
          }}
        />
      ) : (
        <ul className="dev-uris">
          {app.redirectUris.map((u) => (
            <li key={u}>
              <code>{u}</code>
            </li>
          ))}
        </ul>
      )}
      {act.error && (
        <div className="banner danger" role="alert">
          {act.error}
        </div>
      )}
    </li>
  );
}

function HowAppsWork({ webOrigin }: { webOrigin: string }) {
  return (
    <details className="dev-how">
      <summary>How “Log in with Meldiq” works</summary>
      <ol>
        <li>
          Send people to <code>{webOrigin}/oauth/authorize</code> with <code>client_id</code>, <code>redirect_uri</code>, <code>scope</code> (<code>identify</code>, and <code>email</code> if you need
          it), <code>state</code>, and for apps without a server a PKCE <code>code_challenge</code> with <code>code_challenge_method=S256</code>.
        </li>
        <li>They see your app's name and what it gets, and choose Allow or Cancel. Meldiq sends them back with a code (or an error).</li>
        <li>
          Your server swaps the code at <code>POST /v2/oauth/token</code> for tokens, then reads who they are at <code>GET /v2/oauth/userinfo</code>.
        </li>
        <li>People can remove your app's access any time in Privacy & security › Authorised apps.</li>
      </ol>
      <small className="faint">The full reference is the “Log in with Meldiq” section of docs/SETTINGS_PARITY_API.md in the Meldiq server’s repository.</small>
    </details>
  );
}
