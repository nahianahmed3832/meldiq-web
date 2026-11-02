import { BotTag } from "../components/BotTag";
import { Bot, KeyRound, Pencil, Plus, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { ApiError } from "../../api/client";
import { useEngine, useOrbit } from "../../application/orbit";
import { DISCOVERY_FEATURES } from "../../sync/discovery/rules";
import { BotListingCard } from "./BotListingCard";
import { createBot, deleteBot, type DeveloperBot, developerBots, rotateBotToken, updateBot } from "../../sync/developer";
import { CopyButton, SecretBox } from "../components/CopyButton";
import { Toggle } from "../components/Toggle";
import { relative } from "../format";
import { useAction, useLoad } from "../workspace/useLoad";

/** A refused new bot: the quota from a 409 limit_reached, else the server's words. */
export function botLimitText(e: unknown): string {
  if (!(e instanceof ApiError)) return "Couldn't make the bot. Try again.";
  if (e.code !== "limit_reached") return e.message;
  const d = e.details as { limit?: unknown } | null | undefined;
  return typeof d?.limit === "number" ? `Your plan allows ${d.limit} bots. Delete one, or upgrade with Meldiq Plus for more.` : e.message;
}

/**
 * Developer › Bots (API 0.65.0 batch B): make a bot, rename it, make it public or private, replace its token (shown
 * once), delete it, and how to add it to a community. The quota comes from the server (it follows your plan).
 */
export function BotsSection({ apiOrigin }: { apiOrigin: string }) {
  const engine = useEngine();
  const [version, setVersion] = useState(0);
  const list = useLoad(() => developerBots(engine), [engine, version]);
  const [name, setName] = useState("");
  const [making, setMaking] = useState(false);
  const [secret, setSecret] = useState<{ title: string; value: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const reload = () => setVersion((v) => v + 1);
  const bots = list.data?.bots ?? [];
  const limit = list.data?.limit ?? 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setProblem(null);
    try {
      const made = await createBot(engine, name);
      setSecret({ title: `${made.bot.displayName}'s token`, value: made.token });
      setName("");
      setMaking(false);
      reload();
    } catch (err) {
      setProblem(botLimitText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card ws-card" aria-label="Bots">
      <header className="ws-card-head">
        <div className="grow">
          <h3>Bots {list.data ? `· ${bots.length}/${limit}` : ""}</h3>
          <p className="muted">A bot is an account of its own that your code runs: it posts in channels and answers slash commands. It can't sign in to the app.</p>
        </div>
        <button className="btn btn-secondary btn-sm" disabled={!list.data || bots.length >= limit} onClick={() => setMaking(true)}>
          <Plus size={14} /> New bot
        </button>
      </header>
      {secret && <SecretBox title={secret.title} secret={secret.value} onDone={() => setSecret(null)} />}
      {making && (
        <form className="ws-form" onSubmit={(e) => void submit(e)} aria-label="New bot">
          <label className="field">
            <span>Bot name</span>
            <input className="input" autoFocus maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="ws-form-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMaking(false)}>
              Cancel
            </button>
            <button className="btn btn-primary btn-sm" disabled={busy || !name.trim()}>
              {busy ? "Making…" : "Make bot"}
            </button>
          </div>
        </form>
      )}
      {(list.error || problem) && (
        <div className="banner danger" role="alert">
          {problem ?? list.error}
        </div>
      )}
      {list.data && bots.length === 0 && !making && <p className="faint">No bots yet. Make one to try the bot API.</p>}
      <ul className="ws-list dev-list">
        {bots.map((b) => (
          <BotRow key={b.id} bot={b} onChanged={reload} onSecret={(value) => setSecret({ title: `${b.displayName}'s new token`, value })} />
        ))}
      </ul>
      <HowBotsWork apiOrigin={apiOrigin} />
    </section>
  );
}

function BotRow({ bot, onChanged, onSecret }: { bot: DeveloperBot; onChanged: () => void; onSecret: (token: string) => void }) {
  const engine = useEngine();
  const act = useAction();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(bot.displayName);
  const run = (fn: () => Promise<unknown>) => void act.act(fn).then((ok) => ok && onChanged());
  // Community parity E: list a public bot in Community bots (bot-directory).
  const directoryOn = useOrbit((s) => s.server?.features.includes(DISCOVERY_FEATURES.botDirectory) ?? false);

  return (
    <li className="dev-item">
      <div className="ws-row">
        <Bot size={18} className="faint" />
        <span className="lines grow">
          <span className="ellipsis">
            {bot.displayName} <BotTag />
          </span>
          <small>
            @{bot.username} · {bot.commands} {bot.commands === 1 ? "command" : "commands"} · in {bot.communities} {bot.communities === 1 ? "community" : "communities"} · token from{" "}
            {relative(bot.tokenRotatedAt)}
          </small>
        </span>
        <Toggle label={`${bot.displayName} is public`} checked={bot.public} disabled={act.busy} onChange={(v) => run(() => updateBot(engine, bot.id, { public: v }))} />
        <small className="faint">{bot.public ? "Public" : "Private"}</small>
      </div>
      {renaming ? (
        <form
          className="row"
          style={{ gap: 8 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) run(() => updateBot(engine, bot.id, { name: name.trim() }).then(() => setRenaming(false)));
          }}
        >
          <input className="input input-sm grow" aria-label="Bot name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn btn-primary btn-sm" disabled={act.busy || !name.trim()}>
            Save
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRenaming(false)}>
            Cancel
          </button>
        </form>
      ) : (
        <div className="row dev-actions">
          <span className="faint">Bot ID</span>
          <code className="ellipsis">{bot.id}</code>
          <CopyButton text={bot.id} label={`Copy ${bot.displayName}'s ID`} />
          <span className="grow" />
          <button className="btn btn-ghost btn-sm" onClick={() => setRenaming(true)}>
            <Pencil size={14} /> Rename
          </button>
          <button
            className="btn btn-ghost btn-sm"
            disabled={act.busy}
            onClick={() => {
              if (!window.confirm(`Replace ${bot.displayName}'s token? The current one stops working at once.`)) return;
              void act.act(async () => onSecret((await rotateBotToken(engine, bot.id)).token));
            }}
          >
            <KeyRound size={14} /> New token
          </button>
          <button
            className="btn btn-danger-quiet btn-sm"
            disabled={act.busy}
            onClick={() => {
              if (window.confirm(`Delete ${bot.displayName}? It leaves every community, and what it sent shows as "Deleted account".`)) run(() => deleteBot(engine, bot.id));
            }}
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      )}
      <small className="faint">
        {bot.public ? "Anyone who can edit a community can add it with its ID." : "Only you can add it: open a community you can edit, then Community settings › Bots, and paste its ID."}
      </small>
      {act.error && (
        <div className="banner danger" role="alert">
          {act.error}
        </div>
      )}
      {directoryOn && <BotListingCard botId={bot.id} botName={bot.displayName} isPublic={bot.public} />}
    </li>
  );
}

function HowBotsWork({ apiOrigin }: { apiOrigin: string }) {
  return (
    <details className="dev-how">
      <summary>How bots work</summary>
      <ol>
        <li>Make a bot and copy its token. Treat it like a password.</li>
        <li>
          Your code sends it as <code>Authorization: Bot &lt;token&gt;</code> to <code>{apiOrigin}/v2/bot/…</code>.
        </li>
        <li>
          Register slash commands with <code>PUT /v2/bot/commands</code>, then wait for people to run them with <code>GET /v2/bot/interactions?wait=25</code> and answer each with{" "}
          <code>POST /v2/bot/interactions/&lt;id&gt;/reply</code>. Nothing to host: your computer asks, the server answers.
        </li>
        <li>Add the bot to a community in Community settings › Bots, with its ID.</li>
      </ol>
      <small className="faint">The full reference is the “Bots” section of docs/SETTINGS_PARITY_API.md in the Meldiq server’s repository.</small>
    </details>
  );
}
