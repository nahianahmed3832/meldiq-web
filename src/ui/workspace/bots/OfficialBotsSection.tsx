import { BotTag } from "../../components/BotTag";
import { ChevronRight, Code2, SmilePlus, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import type { OrgAdminDetail } from "../../../api/workspaceSchemas";
import { useEngine, useOrbit } from "../../../application/orbit";
import { navigate } from "../../../application/router";
import { botStatusLine } from "../../../sync/officialBotRules";
import {
  type CatalogBot,
  type CommunityOfficialBots,
  communityOfficialBots,
  type OfficialBot,
  officialBotError,
  officialBotsCatalog,
  OFFICIAL_BOTS_FEATURE,
  updateOfficialBot,
} from "../../../sync/officialBots";
import { POSTING_FEATURES } from "../../../sync/posting/api";
import { Toggle } from "../../components/Toggle";
import { useLoad } from "../useLoad";
import { Card, ErrorLine } from "../WorkspaceView";
import { BotIcon, GetBotsPlusButton, PlusChip } from "./BotParts";
import { BotWindow } from "./BotWindow";

/** Whether this server runs Meldiq's official bots. */
export function useOfficialBotsOffered(): boolean {
  return useOrbit((s) => s.server?.features.includes(OFFICIAL_BOTS_FEATURE) ?? false);
}

const untilText = (t: number | null) => (t ? `until ${new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}` : "with no end date");

/**
 * Settings › Bots, the official part (docs/MELDIQ_COMMUNITY_PARITY.md §1 Bots): Meldiq's bots, each with its picture,
 * name and BOT tag, tagline, "Off · FREE · tap for details" and a switch; "Your own bot"; and Bots+ with its perks.
 */
export function OfficialBotsSection({ detail }: { detail: OrgAdminDetail }) {
  const engine = useEngine();
  const orgId = detail.org.id;
  const catalog = useLoad(() => officialBotsCatalog(engine), [engine]);
  const here = useLoad(() => communityOfficialBots(engine, orgId), [engine, orgId]);
  const [view, setView] = useState<CommunityOfficialBots | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setView(here.data), [here.data]);

  const replace = (bot: OfficialBot) => setView((v) => (v ? { ...v, bots: v.bots.map((b) => (b.key === bot.key ? bot : b)) } : v));
  const toggle = async (key: string, enabled: boolean) => {
    setBusyKey(key);
    setError(null);
    try {
      replace(await updateOfficialBot(engine, orgId, key, { enabled }));
    } catch (e) {
      setError(officialBotError(e));
    } finally {
      setBusyKey(null);
    }
  };

  const loadError = catalog.error ?? here.error;
  const bots = catalog.data?.bots ?? [];
  const perks = catalog.data?.botsPlus.perks ?? [];
  const opened = bots.find((b) => b.key === open);
  const stateOf = (c: CatalogBot) => view?.bots.find((b) => b.key === c.key) ?? null;

  return (
    <>
      <Card title="Official bots" sub="Made by Meldiq and free to turn on. Each one joins as a member with a BOT tag, under the name and picture you give it here.">
        <ErrorLine text={loadError ?? error} />
        {!loadError && (!catalog.data || !view) && <div className="skeleton" style={{ height: 120 }} aria-busy="true" />}
        {catalog.data && view && (
          <ul className="ws-list obot-list">
            {bots.map((c) => {
              const bot = stateOf(c);
              const available = c.available && bot?.available !== false;
              return (
                <li key={c.key} className="ws-row obot-row">
                  <button type="button" className="obot-row-open" onClick={() => setOpen(c.key)} aria-label={`${c.name}: details`}>
                    <BotIcon bot={bot} catalog={c} size={40} />
                    <span className="lines grow">
                      <span className="ellipsis">
                        {bot?.look.displayName ?? c.name} <BotTag />
                      </span>
                      <small className="ellipsis">{c.tagline}</small>
                      <small className={`obot-status${bot?.enabled ? " on" : ""}`}>
                        {botStatusLine({ enabled: bot?.enabled ?? false, available, unavailableReason: bot?.unavailableReason ?? c.unavailableReason }, view.botsPlus)}
                      </small>
                    </span>
                    <ChevronRight size={16} className="faint" aria-hidden="true" />
                  </button>
                  {view.canEdit && <Toggle checked={bot?.enabled ?? false} disabled={!available || busyKey === c.key} onChange={(v) => void toggle(c.key, v)} label={`${c.name} on`} />}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <OwnBotCard />
      {catalog.data && view && <BotsPlusCard orgId={orgId} info={catalog.data.botsPlus} active={view.botsPlus} until={view.botsPlusUntil} />}
      {opened && view && (
        <BotWindow
          key={opened.key}
          orgId={orgId}
          orgName={detail.org.name}
          memberCount={detail.stats.members}
          catalog={opened}
          bot={stateOf(opened)}
          botsPlus={view.botsPlus}
          perks={perks}
          canEdit={view.canEdit}
          onChanged={replace}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}

/** "Your own bot": made in the person's Settings › Developer, then added here by its ID. */
function OwnBotCard() {
  return (
    <Card title="Your own bot" sub="Build one in a few minutes, with no hosting: make it in Settings › Developer, then add it here by its ID.">
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate({ section: "settings", settingsPage: "developer" })}>
        <Code2 size={14} /> Open Developer settings
      </button>
    </Card>
  );
}

function BotsPlusCard({ info, active, until, orgId }: { orgId: string; info: { name: string; description: string; perks: string[] }; active: boolean; until: number | null }) {
  return (
    <Card title={info.name} sub={info.description} actions={<PlusChip />}>
      <ul className="obot-perks">
        {info.perks.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      {active ? (
        <p className="obot-plus-on">
          <Sparkles size={14} aria-hidden="true" /> This community has {info.name} {untilText(until)}.
        </p>
      ) : (
        <GetBotsPlusButton orgId={orgId} />
      )}
    </Card>
  );
}

/** "Also built in": Meldiq's own tools that do what other apps need a bot for. */
export function AlsoBuiltIn() {
  const reactionRoles = useOrbit((s) => s.server?.features.includes(POSTING_FEATURES.reactionRoles) ?? false);
  if (!reactionRoles) return null;
  return (
    <Card title="Also built in">
      <div className="ws-row">
        <SmilePlus size={18} className="faint" aria-hidden="true" />
        <span className="lines grow">
          <span>Reaction roles</span>
          <small>Right-click a message and pick Reaction roles… to give a role to everyone who reacts with an emoji.</small>
        </span>
      </div>
    </Card>
  );
}
