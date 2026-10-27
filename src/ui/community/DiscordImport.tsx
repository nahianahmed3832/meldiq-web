import { Check, CircleAlert, ExternalLink, Hash, Image, RotateCw, Shield, Smile, Unplug, Volume2 } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { ApiError } from "../../api/client";
import type { DiscordReturn } from "../../application/discordReturn";
import { useEngine, useOrbit } from "../../application/orbit";
import { setPrefs } from "../../application/prefs";
import { navigate } from "../../application/router";
import {
  type DiscordConnection,
  type DiscordDestination,
  type DiscordImport as ImportView,
  type DiscordImportItem,
  type DiscordImportOptions,
  type DiscordItemKind,
  type DiscordPreview,
  disconnectDiscord,
  discordConnectUrl,
  discordImport,
  discordPreview,
  discordStatus,
  finishDiscordConnect,
  importFinished,
  previewFor,
  retryDiscordImport,
  startDiscordImport,
} from "../../sync/discord";
import { QuickInvite } from "../workspace/InviteLink";

/** How often an import in progress is checked. */
const POLL_MS = 1_000;
/** The only place the server may send the browser to connect (it's Discord's own authorization page). */
const DISCORD_ORIGIN = "https://discord.com";

const IMPORTED = ["The server icon", "Roles: names and colours, and what they may do if you choose", "Categories and channels: text, announcement, voice and forum", "Custom emoji"];
const KIND_LABEL: Record<DiscordItemKind, string> = { icon: "Icon", role: "Roles", category: "Categories", channel: "Channels", emoji: "Emoji" };
const KIND_ICON: Record<DiscordItemKind, ReactNode> = {
  icon: <Image size={14} aria-hidden="true" />,
  role: <Shield size={14} aria-hidden="true" />,
  category: <Hash size={14} aria-hidden="true" />,
  channel: <Volume2 size={14} aria-hidden="true" />,
  emoji: <Smile size={14} aria-hidden="true" />,
};
const DEFAULT_OPTIONS: DiscordImportOptions = { icon: true, roles: true, rolePermissions: false, channels: true, emojis: true };

type Step = { kind: "loading" } | { kind: "start" } | { kind: "finishing" } | { kind: "review"; connection: DiscordConnection } | { kind: "importing"; id: string };

/**
 * Import from Discord (community-first brief §3D; meldiq docs/DISCORD_IMPORT.md): what moves and what never does, then
 * Discord's own page to add Meldiq's bot to a server you manage; back here, a preview of every item and where it goes,
 * an explicit Import, progress item by item, Retry for what failed, and an invitation for the members. Nothing is shown
 * as done that the server didn't report, and nothing at all works until the server has a Discord application.
 */
export function DiscordImport({ returned, onClose }: { returned: DiscordReturn | null; onClose: () => void }) {
  const engine = useEngine();
  const [step, setStep] = useState<Step>({ kind: "loading" });
  const [configured, setConfigured] = useState(false);
  const [connections, setConnections] = useState<DiscordConnection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const s = await discordStatus(engine);
        if (!live) return;
        setConfigured(s.configured);
        setConnections(s.connections);
        if (returned?.kind === "connected" && s.configured) {
          setStep({ kind: "finishing" });
          const connection = await finishDiscordConnect(engine, returned);
          if (live) setStep({ kind: "review", connection });
          return;
        }
        if (returned?.kind === "cancelled") setError("Discord wasn't connected: the bot wasn't added. You can try again.");
        setStep({ kind: "start" });
      } catch (e) {
        if (!live) return;
        setError(errorText(e, "Couldn't reach the server. Try again."));
        setStep({ kind: "start" });
      }
    })();
    return () => {
      live = false;
    };
  }, [engine, returned]);

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      const url = await discordConnectUrl(engine);
      if (new URL(url).origin !== DISCORD_ORIGIN) throw new Error("unexpected address");
      window.location.assign(url);
    } catch (e) {
      setError(errorText(e, "Couldn't start connecting Discord. Try again."));
      setBusy(false);
    }
  };

  const disconnect = async (c: DiscordConnection, leave: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await disconnectDiscord(engine, c.id, leave);
      setConnections((l) => l.filter((x) => x.id !== c.id));
      setStep({ kind: "start" });
    } catch (e) {
      setError(errorText(e, "Couldn't disconnect. Try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="discord-import">
      {error && (
        <div className="banner danger" role="alert">
          {error}
        </div>
      )}
      {step.kind === "loading" && <span className="skeleton" style={{ height: 160 }} aria-busy="true" />}
      {step.kind === "finishing" && (
        <p className="muted" aria-live="polite">
          Checking with Discord that you manage this server…
        </p>
      )}
      {step.kind === "start" && <Intro configured={configured} connections={connections} busy={busy} onConnect={() => void connect()} onChoose={(c) => setStep({ kind: "review", connection: c })} />}
      {step.kind === "review" && (
        <Review
          connection={step.connection}
          onBack={() => setStep({ kind: "start" })}
          onDisconnect={(leave) => void disconnect(step.connection, leave)}
          onStarted={(id) => setStep({ kind: "importing", id })}
        />
      )}
      {step.kind === "importing" && <Progress id={step.id} onClose={onClose} />}
    </div>
  );
}

function Intro(props: { configured: boolean; connections: DiscordConnection[]; busy: boolean; onConnect: () => void; onChoose: (c: DiscordConnection) => void }) {
  return (
    <>
      {!props.configured ? (
        <div className="banner info" role="status">
          Importing from Discord isn't set up on this server yet. Its administrator needs to add a Discord application first.
        </div>
      ) : (
        <ol className="discord-steps">
          <li>
            <span>
              <strong>Connect Discord</strong> and pick your server. Discord asks to add Meldiq's bot, which only views channels.
            </span>
            <span className="discord-step-actions">
              <button className="btn btn-primary discord-connect" disabled={props.busy} onClick={props.onConnect}>
                <ExternalLink size={16} aria-hidden="true" /> {props.busy ? "Opening Discord…" : "Connect Discord"}
              </button>
              {props.connections.map((c) => (
                <button key={c.id} className="btn btn-secondary" onClick={() => props.onChoose(c)}>
                  Continue with {c.guildName}
                </button>
              ))}
            </span>
          </li>
          <li>Meldiq checks that you own that server or have Manage Server there, then forgets your Discord sign-in.</li>
          <li>You see every channel, role and emoji that would be made, and choose Import.</li>
        </ol>
      )}
      <div className="discord-lists">
        <section aria-labelledby="di-yes">
          <h3 id="di-yes" className="invite-or-title">
            Comes over
          </h3>
          <ul className="discord-bullets">
            {IMPORTED.map((x) => (
              <li key={x}>
                <Check size={14} aria-hidden="true" /> {x}
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="di-no">
          <h3 id="di-no" className="invite-or-title">
            Never copied
          </h3>
          <ul className="discord-bullets faint">
            <li>Messages and history</li>
            <li>Members, their accounts and DMs</li>
            <li>Bots, webhooks, stickers and events</li>
          </ul>
        </section>
      </div>
      <p className="faint discord-footnote">Discord doesn't allow copying messages or members. You can remove the bot from your Discord server afterwards.</p>
    </>
  );
}

function Review({ connection, onBack, onDisconnect, onStarted }: { connection: DiscordConnection; onBack: () => void; onDisconnect: (leave: boolean) => void; onStarted: (id: string) => void }) {
  const engine = useEngine();
  // Communities this person runs (owners and admins); the server still checks each part against their role.
  const runs = useOrbit(
    (s) => s.orgs.filter((o) => o.myRole === "OWNER" || o.myRole === "ADMIN"),
    (a, b) => a.length === b.length && a.every((x, i) => x === b[i]),
  );
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [name, setName] = useState(connection.guildName.slice(0, 80));
  const [orgId, setOrgId] = useState(runs[0]?.id ?? "");
  const [options, setOptions] = useState<DiscordImportOptions>(DEFAULT_OPTIONS);
  const [preview, setPreview] = useState<DiscordPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [leave, setLeave] = useState(false);
  const target = mode === "existing" ? orgId || null : null;

  useEffect(() => {
    let live = true;
    setPreview(null);
    discordPreview(engine, connection.id, target)
      .then((p) => live && setPreview(p))
      .catch((e: unknown) => live && setError(errorText(e, "Couldn't read the Discord server.")));
    return () => {
      live = false;
    };
  }, [engine, connection.id, target]);

  const shown = useMemo(() => (preview ? previewFor(preview.items, options) : []), [preview, options]);
  const making = shown.filter((i) => i.action === "create").length;
  const nothingChosen = !options.icon && !options.roles && !options.channels && !options.emojis;

  const start = async () => {
    const destination: DiscordDestination = mode === "existing" ? { orgId } : { name: name.trim() };
    if (mode === "new" && !name.trim()) return setError("Give the community a name.");
    if (mode === "existing" && !orgId) return setError("Choose a community.");
    setBusy(true);
    setError(null);
    try {
      onStarted((await startDiscordImport(engine, connection.id, destination, options)).id);
    } catch (e) {
      setError(errorText(e, "Couldn't start the import. Try again."));
      setBusy(false);
    }
  };

  const toggle = (k: keyof DiscordImportOptions) => setOptions((o) => ({ ...o, [k]: !o[k], ...(k === "roles" && o.roles ? { rolePermissions: false } : {}) }));
  return (
    <>
      <p style={{ margin: 0 }}>
        Connected: <strong>{connection.guildName}</strong>
      </p>
      {error && (
        <div className="banner danger" role="alert">
          {error}
        </div>
      )}
      <div className="field">
        <span className="label">Import into</span>
        <div className="segmented" role="radiogroup" aria-label="Import into">
          <button type="button" role="radio" aria-checked={mode === "new"} aria-pressed={mode === "new"} onClick={() => setMode("new")}>
            A new community
          </button>
          <button type="button" role="radio" aria-checked={mode === "existing"} aria-pressed={mode === "existing"} disabled={runs.length === 0} onClick={() => setMode("existing")}>
            One I run
          </button>
        </div>
      </div>
      {mode === "new" ? (
        <div className="field">
          <label htmlFor="di-name">Name on Meldiq</label>
          <input id="di-name" className="input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          <span className="hint">Private and invite-only to start; you can list it in Discover later.</span>
        </div>
      ) : (
        <div className="field">
          <label htmlFor="di-org">Community</label>
          <select id="di-org" className="input" value={orgId} onChange={(e) => setOrgId(e.target.value)}>
            {runs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <fieldset className="discord-options">
        <legend className="label">What to bring over</legend>
        <Toggle on={options.icon} onChange={() => toggle("icon")} label="Server icon" />
        <Toggle on={options.roles} onChange={() => toggle("roles")} label="Roles (names and colours)" />
        <Toggle on={options.rolePermissions} disabled={!options.roles} onChange={() => toggle("rolePermissions")} label="Also what each role may do (never Administrator)" />
        <Toggle on={options.channels} onChange={() => toggle("channels")} label="Categories and channels" />
        <Toggle on={options.emojis} onChange={() => toggle("emojis")} label="Custom emoji" />
      </fieldset>
      <section aria-labelledby="di-preview" className="discord-preview">
        <h3 id="di-preview" className="invite-or-title">
          {preview ? `Preview: ${making} to make` : "Preview"}
        </h3>
        {!preview && !error && <span className="skeleton" style={{ height: 120 }} aria-busy="true" />}
        {preview && <ItemList items={shown.map((i) => ({ key: i.key, kind: i.kind, name: i.name, state: i.action === "create" ? "create" : "skip", note: i.note }))} />}
        {preview && (
          <p className="faint discord-excluded">
            <CircleAlert size={13} aria-hidden="true" /> Never imported: {preview.excluded.join("; ")}.
          </p>
        )}
      </section>
      <div className="discord-actions">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>
          Back
        </button>
        <span className="grow" />
        <label className="discord-leave">
          <input type="checkbox" checked={leave} onChange={(e) => setLeave(e.target.checked)} /> Remove the bot from Discord
        </label>
        <button className="btn btn-secondary btn-sm" onClick={() => onDisconnect(leave)}>
          <Unplug size={14} aria-hidden="true" /> Disconnect
        </button>
        <button className="btn btn-primary" disabled={busy || !preview || making === 0 || nothingChosen} onClick={() => void start()}>
          {busy ? "Starting…" : `Import ${making} item${making === 1 ? "" : "s"}`}
        </button>
      </div>
    </>
  );
}

function Progress({ id, onClose }: { id: string; onClose: () => void }) {
  const engine = useEngine();
  const [view, setView] = useState<{ import: ImportView; items: DiscordImportItem[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState(0);

  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      try {
        const v = await discordImport(engine, id);
        if (!live) return;
        setView(v);
        setError(null);
        if (!importFinished(v.import)) timer = setTimeout(() => void tick(), POLL_MS);
      } catch (e) {
        if (!live) return;
        setError(errorText(e, "Lost track of the import. It carries on; check again."));
      }
    };
    void tick();
    return () => {
      live = false;
      if (timer) clearTimeout(timer);
    };
  }, [engine, id, round]);

  const retry = async () => {
    try {
      await retryDiscordImport(engine, id);
      setRound((r) => r + 1);
    } catch (e) {
      setError(errorText(e, "Couldn't retry. Try again."));
    }
  };

  const imp = view?.import;
  const c = imp?.counts;
  const finished = imp ? importFinished(imp) : false;
  const settled = c ? c.done + c.failed + c.skipped : 0;
  const open = () => {
    if (!imp?.orgId) return;
    setPrefs({ orgId: imp.orgId });
    onClose();
    navigate({ section: "home" });
  };
  return (
    <>
      {error && (
        <div className="banner danger" role="alert">
          <span className="grow">{error}</span>
          <button className="btn btn-secondary btn-sm" onClick={() => setRound((r) => r + 1)}>
            Check again
          </button>
        </div>
      )}
      {!view && !error && <span className="skeleton" style={{ height: 120 }} aria-busy="true" />}
      {imp && c && (
        <>
          <div aria-live="polite">
            <strong>{STATUS_TEXT[imp.status]}</strong>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              {c.done} made · {c.skipped} left out · {c.failed} failed{c.pending ? ` · ${c.pending} to go` : ""}
            </p>
          </div>
          <progress className="discord-progress" max={Math.max(c.total, 1)} value={settled} aria-label="Import progress" />
          {imp.error && <div className="banner danger">{imp.error}</div>}
          <ItemList items={view.items.map((i) => ({ key: i.key, kind: i.kind, name: i.name, state: i.status, note: i.note }))} />
          {finished && (c.failed > 0 || imp.status === "interrupted" || imp.status === "failed") && (
            <button className="btn btn-secondary" onClick={() => void retry()}>
              <RotateCw size={16} aria-hidden="true" /> Retry what didn't finish
            </button>
          )}
          {finished && imp.orgId && (
            <section className="invite-or" aria-labelledby="di-invite">
              <h3 id="di-invite" className="invite-or-title">
                Invite your members
              </h3>
              <p className="muted">Share this link in your Discord server so people can join on Meldiq.</p>
              <QuickInvite orgId={imp.orgId} />
              <button className="btn btn-primary" onClick={open}>
                Open the community
              </button>
            </section>
          )}
        </>
      )}
    </>
  );
}

const STATUS_TEXT: Record<ImportView["status"], string> = {
  running: "Importing…",
  completed: "Import finished",
  completed_with_errors: "Finished, with some items that failed",
  failed: "The import stopped",
  interrupted: "The import was interrupted",
};

const STATE_TEXT: Record<string, string> = { create: "Will be made", skip: "Left out", pending: "Waiting", done: "Made", failed: "Failed", skipped: "Left out" };

function ItemList({ items }: { items: { key: string; kind: DiscordItemKind; name: string; state: string; note: string | null }[] }) {
  const groups = (Object.keys(KIND_LABEL) as DiscordItemKind[]).map((k) => ({ kind: k, items: items.filter((i) => i.kind === k) })).filter((g) => g.items.length > 0);
  if (groups.length === 0) return <p className="faint">Nothing to import with these choices.</p>;
  return (
    <div className="discord-items">
      {groups.map((g) => (
        <div key={g.kind} role="group" aria-label={KIND_LABEL[g.kind]}>
          <h4 className="discord-kind">
            {KIND_ICON[g.kind]} {KIND_LABEL[g.kind]} ({g.items.length})
          </h4>
          <ul>
            {g.items.map((i) => (
              <li key={i.key} className={`discord-item ${i.state}`}>
                <span className="grow ellipsis">{i.name}</span>
                <span className="discord-state">{STATE_TEXT[i.state] ?? i.state}</span>
                {i.note && <small className="discord-note">{i.note}</small>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: () => void; label: string; disabled?: boolean }) {
  return (
    <label className={`discord-toggle${disabled ? " disabled" : ""}`}>
      <input type="checkbox" checked={on} disabled={disabled} onChange={onChange} /> {label}
    </label>
  );
}

const errorText = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);
