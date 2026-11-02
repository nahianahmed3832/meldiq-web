import { BotTag } from "../components/BotTag";
import { Bot, Search, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import type { OrgAdminDetail } from "../../api/workspaceSchemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { DISCOVERY_FEATURES } from "../../sync/discovery/rules";
import { CommunityBotsCard } from "./bots/CommunityBotsCard";
import { type BotProfile, botProfile, installBot, removeBot } from "../../sync/bots";
import { directory } from "../../sync/workspaces";
import { AlsoBuiltIn, OfficialBotsSection, useOfficialBotsOffered } from "./bots/OfficialBotsSection";
import { useAction, useLoad } from "./useLoad";
import { Card, ErrorLine } from "./WorkspaceView";

const BOT_ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Community settings › Bots (API 0.65.0 batch B): add a bot by its ID after seeing who it is and who made it, and remove
 * the ones here. A bot joins as an ordinary member, so roles and channel permissions decide what it can see and post.
 * Shown to people with Edit community permission; the server checks again. Community parity D (feature community-bots):
 * Meldiq's official bots, "Your own bot" and Bots+ come first, and "Also built in" closes the page.
 */
export function BotsPage({ detail }: { detail: OrgAdminDetail }) {
  const official = useOfficialBotsOffered();
  const others = useOrbit((s) => s.server?.features.includes("bots") ?? false);
  return (
    <>
      {official && <OfficialBotsSection detail={detail} />}
      {others && <InstalledBots detail={detail} />}
      {official && <AlsoBuiltIn />}
    </>
  );
}

/** Bots people made (API 0.65.0 batch B): add one by its ID, and the ones here. */
function InstalledBots({ detail }: { detail: OrgAdminDetail }) {
  const engine = useEngine();
  const orgId = detail.org.id;
  const [rev, setRev] = useState(0);
  const members = useLoad(() => directory(engine, orgId), [engine, orgId, rev]);
  const installed = (members.data ?? []).filter((m) => m.bot);
  const remove = useAction();
  const reload = () => setRev((r) => r + 1);
  // Community parity E: the community bot directory (bot-directory).
  const directoryOn = useOrbit((s) => s.server?.features.includes(DISCOVERY_FEATURES.botDirectory) ?? false);

  return (
    <>
      <AddBot orgId={orgId} onAdded={reload} />
      {directoryOn && <CommunityBotsCard orgId={orgId} installed={new Set(installed.map((b) => b.id))} onAdded={reload} />}
      <Card title={`Bots here · ${installed.length}`} sub="Bots are members: give them roles to choose which channels they see and where they can post.">
        <ErrorLine text={members.error ?? remove.error} />
        {!members.data && !members.error && <div className="skeleton" style={{ height: 60 }} aria-busy="true" />}
        {members.data && installed.length === 0 && <p className="faint">No bots in this community yet.</p>}
        <ul className="ws-list">
          {installed.map((b) => (
            <li key={b.id} className="ws-row">
              <Bot size={18} className="faint" />
              <span className="lines grow">
                <span className="ellipsis">
                  {b.displayName} <BotTag />
                </span>
                <small>@{b.username}</small>
              </span>
              <button
                className="btn btn-danger-quiet btn-sm"
                disabled={remove.busy}
                onClick={() => {
                  if (window.confirm(`Remove ${b.displayName} from ${detail.org.name}?`)) void remove.act(() => removeBot(engine, orgId, b.id).then(reload));
                }}
              >
                <Trash2 size={14} /> Remove
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

/** Look a bot up by its ID, show it, then add it. */
function AddBot({ orgId, onAdded }: { orgId: string; onAdded: () => void }) {
  const engine = useEngine();
  const [id, setId] = useState("");
  const [found, setFound] = useState<BotProfile | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const look = useAction();
  const add = useAction();

  const find = (e: FormEvent) => {
    e.preventDefault();
    const botId = id.trim();
    setFound(null);
    setNote(null);
    if (!BOT_ID.test(botId)) return setNote("A bot ID is letters, digits, - and _, as its maker copied it from Developer settings.");
    void look.act(async () => setFound(await botProfile(engine, botId)));
  };

  return (
    <Card title="Add a bot" sub="Ask the bot's maker for its ID. Only bots their makers made public can be added, unless it's your own.">
      <form className="row" style={{ gap: 8 }} onSubmit={find}>
        <input className="input grow" aria-label="Bot ID" placeholder="Bot ID" maxLength={64} value={id} onChange={(e) => setId(e.target.value)} />
        <button className="btn btn-secondary btn-sm" disabled={look.busy || !id.trim()}>
          <Search size={14} /> {look.busy ? "Looking…" : "Look up"}
        </button>
      </form>
      <ErrorLine text={note ?? look.error ?? add.error} />
      {found && (
        <div className="ws-row bot-found">
          <Bot size={22} className="faint" />
          <span className="lines grow">
            <span className="ellipsis">
              {found.displayName} <BotTag />
            </span>
            <small>
              @{found.username}
              {found.owner ? ` · made by @${found.owner.username}` : ""} · {found.commands} {found.commands === 1 ? "command" : "commands"} · {found.public ? "public" : "private"}
            </small>
          </span>
          <button
            className="btn btn-primary btn-sm"
            disabled={add.busy}
            onClick={() =>
              void add.act(async () => {
                const added = await installBot(engine, orgId, found.id);
                setNote(added ? null : `${found.displayName} is already here.`);
                setFound(null);
                setId("");
                onAdded();
              })
            }
          >
            {add.busy ? "Adding…" : "Add to community"}
          </button>
        </div>
      )}
    </Card>
  );
}
