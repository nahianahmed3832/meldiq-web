import { formatUiNumber } from "../../i18n/format";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
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
  useLocaleRender();
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
  useLocaleRender();
  const l10n = useLocalization();
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
      <Card
        title={uiText("workspace.interface.bots_here_value0_dced6ba", { value0: installed.length })}
        sub={uiText("workspace.interface.bots_are_members_give_them_roles_to_choose_which_channels_they_se_da0bbe6")}
      >
        <ErrorLine text={members.error ?? remove.error} />
        {!members.data && !members.error && <div className="skeleton" style={{ height: 60 }} aria-busy="true" />}
        {members.data && installed.length === 0 && (
          <p className="faint">
            <Localized k="workspace.interface.no_bots_in_this_community_yet_20581db" />
          </p>
        )}
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
                  if (window.confirm(uiText("workspace.interface.remove_value0_from_value1_505f4b4", { value0: b.displayName, value1: detail.org.name })))
                    void remove.act(() => removeBot(engine, orgId, b.id).then(reload));
                }}
              >
                <Trash2 size={14} /> {l10n("common.actions.remove")}
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
  useLocaleRender();
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
    if (!BOT_ID.test(botId)) return setNote(uiText("workspace.interface.a_bot_id_is_letters_digits_and_as_its_maker_copied_it_from_develo_6b6c7cf"));
    void look.act(async () => setFound(await botProfile(engine, botId)));
  };
  return (
    <Card title={uiText("workspace.interface.add_a_bot_12fa6ea")} sub={uiText("workspace.interface.ask_the_bot_s_maker_for_its_id_only_bots_their_makers_made_public_8d3be37")}>
      <form className="row" style={{ gap: 8 }} onSubmit={find}>
        <input
          className="input grow"
          aria-label={uiText("workspace.interface.bot_id_d09dbb7")}
          placeholder={uiText("workspace.interface.bot_id_d09dbb7")}
          maxLength={64}
          value={id}
          onChange={(e) => setId(e.target.value)}
        />
        <button className="btn btn-secondary btn-sm" disabled={look.busy || !id.trim()}>
          <Search size={14} /> {look.busy ? uiText("workspace.interface.looking_2eaf1f9") : uiText("workspace.interface.look_up_504101b")}
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
              {found.owner ? uiText("workspace.interface.made_by_value0_7b63dc8", { value0: found.owner.username }) : ""} · {formatUiNumber(found.commands)}{" "}
              {found.commands === 1 ? uiText("workspace.interface.command_5d347fd") : uiText("workspace.interface.commands_10f5f77")} ·{" "}
              {found.public ? uiText("workspace.interface.public_efa1f37") : uiText("workspace.interface.private_715dc84")}
            </small>
          </span>
          <button
            className="btn btn-primary btn-sm"
            disabled={add.busy}
            onClick={() =>
              void add.act(async () => {
                const added = await installBot(engine, orgId, found.id);
                setNote(added ? null : uiText("workspace.interface.value0_is_already_here_b6429fa", { value0: found.displayName }));
                setFound(null);
                setId("");
                onAdded();
              })
            }
          >
            {add.busy ? uiText("messaging.interface.adding_c6de6f4") : uiText("workspace.interface.add_to_community_60c8a67")}
          </button>
        </div>
      )}
    </Card>
  );
}
