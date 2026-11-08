import { useLocaleRender } from "../../../i18n/Localized";
import { catalogText, localizeOfficialBot } from "../../../i18n/catalog";
import { text as uiText } from "../../../i18n";
import { Localized } from "../../../i18n/Localized";
import { interfaceLocale } from "../../../i18n/format";
import { BotTag } from "../../components/BotTag";
import { ChevronRight, Code2, SmilePlus, Sparkles } from "lucide-react";
import { type CSSProperties, useEffect, useState } from "react";
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
import { Card, ErrorLine } from "../../components/SettingsCard";
import { BotIcon, GetBotsPlusButton, PlusChip } from "./BotParts";
import { BotWindow } from "./BotWindow";
/** Whether this server runs Meldiq's official bots. */
export function useOfficialBotsOffered(): boolean {
  return useOrbit((s) => s.server?.features.includes(OFFICIAL_BOTS_FEATURE) ?? false);
}
const untilText = (t: number | null) =>
  t
    ? uiText("workspace.interface.until_value0_d8f4501", { value0: new Date(t).toLocaleDateString(interfaceLocale(), { day: "numeric", month: "short", year: "numeric" }) })
    : uiText("workspace.interface.with_no_end_date_7809ba6");
/**
 * Settings › Bots, the official part (docs/MELDIQ_COMMUNITY_PARITY.md §1 Bots): Meldiq's bots, each with its picture,
 * name and BOT tag, tagline, "Off · FREE · tap for details" and a switch; "Your own bot"; and Bots+ with its perks.
 */
export function OfficialBotsSection({ detail }: { detail: OrgAdminDetail }) {
  useLocaleRender();
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
  const bots = catalog.data?.bots.map(localizeOfficialBot) ?? [];
  const perks = catalog.data?.botsPlus.perks.map((value, index) => catalogText(`organization.builtIn.officialBots.plus.perk_${index}`, value)) ?? [];
  const opened = bots.find((b) => b.key === open);
  const stateOf = (c: CatalogBot) => view?.bots.find((b) => b.key === c.key) ?? null;
  return (
    <>
      <Card title={uiText("workspace.interface.official_bots_b6ab58f")} sub={uiText("workspace.interface.made_by_meldiq_and_free_to_turn_on_each_one_joins_as_a_member_wit_8699148")}>
        <ErrorLine text={loadError ?? error} />
        {!loadError && (!catalog.data || !view) && <div className="skeleton" style={{ height: 120 }} aria-busy="true" />}
        {catalog.data && view && (
          <ul className="ws-list obot-list">
            {bots.map((c) => {
              const bot = stateOf(c);
              const available = c.available && bot?.available !== false;
              return (
                <li key={c.key} className="ws-row obot-row" style={{ "--bot-color": c.color } as CSSProperties}>
                  <button type="button" className="obot-row-open" onClick={() => setOpen(c.key)} aria-label={uiText("messaging.interface.value0_details_ffe0248", { value0: c.name })}>
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
                  {view.canEdit && (
                    <Toggle
                      checked={bot?.enabled ?? false}
                      disabled={!available || busyKey === c.key}
                      onChange={(v) => void toggle(c.key, v)}
                      label={uiText("workspace.interface.value0_on_8a88fed", { value0: c.name })}
                    />
                  )}
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
  useLocaleRender();
  return (
    <Card title={uiText("workspace.interface.your_own_bot_9f018ed")} sub={uiText("workspace.interface.build_one_in_a_few_minutes_with_no_hosting_make_it_in_settings_de_fb6c9fc")}>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate({ section: "settings", settingsPage: "developer" })}>
        <Localized k="workspace.interface.open_developer_settings_f9c9210" slots={[<Code2 size={14} />]} />
      </button>
    </Card>
  );
}
function BotsPlusCard({
  info,
  active,
  until,
  orgId,
}: {
  orgId: string;
  info: {
    name: string;
    description: string;
    perks: string[];
  };
  active: boolean;
  until: number | null;
}) {
  useLocaleRender();
  return (
    <Card title={info.name} sub={catalogText("organization.builtIn.officialBots.plus.description", info.description)} actions={<PlusChip />}>
      <ul className="obot-perks">
        {info.perks.map((p, index) => (
          <li key={p}>{catalogText(`organization.builtIn.officialBots.plus.perk_${index}`, p)}</li>
        ))}
      </ul>
      {active ? (
        <p className="obot-plus-on">
          <Localized k="workspace.interface.this_community_has_4bfd362" slots={[<Sparkles size={14} aria-hidden="true" />, info.name, untilText(until)]} />
        </p>
      ) : (
        <GetBotsPlusButton orgId={orgId} />
      )}
    </Card>
  );
}
/** "Also built in": Meldiq's own tools that do what other apps need a bot for. */
export function AlsoBuiltIn() {
  useLocaleRender();
  const reactionRoles = useOrbit((s) => s.server?.features.includes(POSTING_FEATURES.reactionRoles) ?? false);
  if (!reactionRoles) return null;
  return (
    <Card title={uiText("workspace.interface.also_built_in_6b62d7a")}>
      <div className="ws-row">
        <SmilePlus size={18} className="faint" aria-hidden="true" />
        <span className="lines grow">
          <span>
            <Localized k="organization.interface.reaction_roles_ef9205a" />
          </span>
          <small>
            <Localized k="workspace.interface.right_click_a_message_and_pick_reaction_roles_to_give_a_role_to_e_78c71dd" />
          </small>
        </span>
      </div>
    </Card>
  );
}
