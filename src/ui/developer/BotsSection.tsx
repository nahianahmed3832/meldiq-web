import { SERVER_REFERENCE } from "../../i18n/syntax";
import { countLabel } from "../../i18n/counts";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
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
  if (!(e instanceof ApiError)) return uiText("workspace.interface.couldn_t_make_the_bot_try_again_6c02b4c");
  if (e.code !== "limit_reached") return e.message;
  const d = e.details as
    | {
        limit?: unknown;
      }
    | null
    | undefined;
  return typeof d?.limit === "number" ? uiText("workspace.interface.your_plan_allows_value0_bots_delete_one_or_upgrade_with_meldiq_pl_2282b65", { value0: d.limit }) : e.message;
}
/**
 * Developer › Bots (API 0.65.0 batch B): make a bot, rename it, make it public or private, replace its token (shown
 * once), delete it, and how to add it to a community. The quota comes from the server (it follows your plan).
 */
export function BotsSection({ apiOrigin }: { apiOrigin: string }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const [version, setVersion] = useState(0);
  const list = useLoad(() => developerBots(engine), [engine, version]);
  const [name, setName] = useState("");
  const [making, setMaking] = useState(false);
  const [secret, setSecret] = useState<{
    title: string;
    value: string;
  } | null>(null);
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
      setSecret({ title: uiText("workspace.interface.value0_s_token_001a6c5", { value0: made.bot.displayName }), value: made.token });
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
    <section className="card ws-card" aria-label={l10n("messaging.people_bots")}>
      <header className="ws-card-head">
        <div className="grow">
          <h3>
            {l10n("messaging.people_bots")} {list.data ? uiText("workspace.interface.value0_value1_ad0489a", { value0: bots.length, value1: limit }) : ""}
          </h3>
          <p className="muted">
            <Localized k="workspace.interface.a_bot_is_an_account_of_its_own_that_your_code_runs_it_posts_in_ch_40129a3" />
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" disabled={!list.data || bots.length >= limit} onClick={() => setMaking(true)}>
          <Localized k="workspace.interface.new_bot_857dd32" slots={[<Plus size={14} />]} />
        </button>
      </header>
      {secret && <SecretBox title={secret.title} secret={secret.value} onDone={() => setSecret(null)} />}
      {making && (
        <form className="ws-form" onSubmit={(e) => void submit(e)} aria-label={uiText("workspace.interface.new_bot_b88293a")}>
          <label className="field">
            <span>
              <Localized k="workspace.interface.bot_name_718ce8b" />
            </span>
            <input className="input" autoFocus maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="ws-form-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMaking(false)}>
              {l10n("common.actions.cancel")}
            </button>
            <button className="btn btn-primary btn-sm" disabled={busy || !name.trim()}>
              {busy ? uiText("workspace.interface.making_398c838") : uiText("workspace.interface.make_bot_a26a5d5")}
            </button>
          </div>
        </form>
      )}
      {(list.error || problem) && (
        <div className="banner danger" role="alert">
          {problem ?? list.error}
        </div>
      )}
      {list.data && bots.length === 0 && !making && (
        <p className="faint">
          <Localized k="workspace.interface.no_bots_yet_make_one_to_try_the_bot_api_2f3c997" />
        </p>
      )}
      <ul className="ws-list dev-list">
        {bots.map((b) => (
          <BotRow key={b.id} bot={b} onChanged={reload} onSecret={(value) => setSecret({ title: uiText("workspace.interface.value0_s_new_token_c060c8e", { value0: b.displayName }), value })} />
        ))}
      </ul>
      <HowBotsWork apiOrigin={apiOrigin} />
    </section>
  );
}
function BotRow({ bot, onChanged, onSecret }: { bot: DeveloperBot; onChanged: () => void; onSecret: (token: string) => void }) {
  useLocaleRender();
  const l10n = useLocalization();
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
            <Localized
              k="workspace.interface.native_count_9d0e6d4ee"
              slots={[bot.username, countLabel(bot.commands, "commands"), "", countLabel(bot.communities, "communities"), "", relative(bot.tokenRotatedAt)]}
            />
          </small>
        </span>
        <Toggle
          label={uiText("workspace.interface.value0_is_public_ef79dbe", { value0: bot.displayName })}
          checked={bot.public}
          disabled={act.busy}
          onChange={(v) => run(() => updateBot(engine, bot.id, { public: v }))}
        />
        <small className="faint">{bot.public ? uiText("workspace.interface.public_591935b") : uiText("workspace.interface.private_c63eb67")}</small>
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
          <input className="input input-sm grow" aria-label={uiText("workspace.interface.bot_name_718ce8b")} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn btn-primary btn-sm" disabled={act.busy || !name.trim()}>
            {l10n("common.actions.save")}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRenaming(false)}>
            {l10n("common.actions.cancel")}
          </button>
        </form>
      ) : (
        <div className="row dev-actions">
          <span className="faint">
            <Localized k="workspace.interface.bot_id_d09dbb7" />
          </span>
          <code className="ellipsis">{bot.id}</code>
          <CopyButton text={bot.id} label={uiText("workspace.interface.copy_value0_s_id_eab0c72", { value0: bot.displayName })} />
          <span className="grow" />
          <button className="btn btn-ghost btn-sm" onClick={() => setRenaming(true)}>
            <Localized k="workspace.interface.rename_3ed8be9" slots={[<Pencil size={14} />]} />
          </button>
          <button
            className="btn btn-ghost btn-sm"
            disabled={act.busy}
            onClick={() => {
              if (!window.confirm(uiText("workspace.interface.replace_value0_s_token_the_current_one_stops_working_at_once_80621ab", { value0: bot.displayName }))) return;
              void act.act(async () => onSecret((await rotateBotToken(engine, bot.id)).token));
            }}
          >
            <Localized k="workspace.interface.new_token_1b72387" slots={[<KeyRound size={14} />]} />
          </button>
          <button
            className="btn btn-danger-quiet btn-sm"
            disabled={act.busy}
            onClick={() => {
              if (window.confirm(uiText("workspace.interface.delete_value0_it_leaves_every_community_and_what_it_sent_shows_as_364bd31", { value0: bot.displayName })))
                run(() => deleteBot(engine, bot.id));
            }}
          >
            <Trash2 size={14} /> {l10n("common.actions.delete")}
          </button>
        </div>
      )}
      <small className="faint">
        {bot.public
          ? uiText("workspace.interface.anyone_who_can_edit_a_community_can_add_it_with_its_id_cdf209f")
          : uiText("workspace.interface.only_you_can_add_it_open_a_community_you_can_edit_then_community_2ea783c")}
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
  useLocaleRender();
  return (
    <details className="dev-how">
      <summary>
        <Localized k="workspace.interface.how_bots_work_1e041ef" />
      </summary>
      <ol>
        <li>
          <Localized k="workspace.interface.make_a_bot_and_copy_its_token_treat_it_like_a_password_256a5bf" />
        </li>
        <li>
          <Localized k="workspace.interface.your_code_sends_it_as_to_e31a6e9" slots={[<code>{"Authorization: Bot <token>"}</code>, <code>{apiOrigin}/v2/bot/…</code>]} />
        </li>
        <li>
          <Localized
            k="workspace.interface.register_slash_commands_with_then_wait_for_people_to_run_them_wit_ee8f002"
            slots={[<code>{"PUT /v2/bot/commands"}</code>, <code>{"GET /v2/bot/interactions?wait=25"}</code>, <code>{"POST /v2/bot/interactions/<id>/reply"}</code>]}
          />
        </li>
        <li>
          <Localized k="workspace.interface.add_the_bot_to_a_community_in_community_settings_bots_with_its_id_9edfc37" />
        </li>
      </ol>
      <small className="faint">
        <Localized
          k="workspace.interface.the_full_reference_is_the_log_in_with_meldiq_section_of_docs_sett_dd2bca4"
          slots={[<code dir="ltr">{SERVER_REFERENCE.bots}</code>, <code dir="ltr">{SERVER_REFERENCE.path}</code>]}
        />
      </small>
    </details>
  );
}
