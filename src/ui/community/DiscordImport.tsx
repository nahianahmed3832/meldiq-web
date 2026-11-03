import { formatUiNumber } from "../../i18n/format";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
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
const POLL_MS = 1000;
/** The only place the server may send the browser to connect (it's Discord's own authorization page). */
const DISCORD_ORIGIN = "https://discord.com";
const IMPORTED = [
  uiText("organization.interface.the_server_icon_9afd1a8"),
  uiText("organization.interface.roles_names_and_colours_and_what_they_may_do_if_you_choose_9011ba5"),
  uiText("organization.interface.categories_and_channels_text_announcement_voice_and_forum_a5188de"),
  uiText("organization.interface.custom_emoji_1596e05"),
];
const KIND_LABEL: Record<DiscordItemKind, string> = {
  get icon() {
    return uiText("organization.interface.icon_a35abcd");
  },
  role: "Roles",
  get category() {
    return uiText("workspace.interface.categories_b8b1d89");
  },
  get channel() {
    return uiText("organization.channels");
  },
  get emoji() {
    return uiText("messaging.interface.emoji_61ad897");
  },
};
const KIND_ICON: Record<DiscordItemKind, ReactNode> = {
  icon: <Image size={14} aria-hidden="true" />,
  role: <Shield size={14} aria-hidden="true" />,
  category: <Hash size={14} aria-hidden="true" />,
  channel: <Volume2 size={14} aria-hidden="true" />,
  emoji: <Smile size={14} aria-hidden="true" />,
};
const DEFAULT_OPTIONS: DiscordImportOptions = { icon: true, roles: true, rolePermissions: false, channels: true, emojis: true };
type Step =
  | {
      kind: "loading";
    }
  | {
      kind: "start";
    }
  | {
      kind: "finishing";
    }
  | {
      kind: "review";
      connection: DiscordConnection;
    }
  | {
      kind: "importing";
      id: string;
    };
/**
 * Import from Discord (community-first brief §3D; meldiq docs/DISCORD_IMPORT.md): what moves and what never does, then
 * Discord's own page to add Meldiq's bot to a server you manage; back here, a preview of every item and where it goes,
 * an explicit Import, progress item by item, Retry for what failed, and an invitation for the members. Nothing is shown
 * as done that the server didn't report, and nothing at all works until the server has a Discord application.
 */
export function DiscordImport({ returned, onClose }: { returned: DiscordReturn | null; onClose: () => void }) {
  useLocaleRender();
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
        if (returned?.kind === "cancelled") setError(uiText("organization.interface.discord_wasn_t_connected_the_bot_wasn_t_added_you_can_try_again_c8b01ee"));
        setStep({ kind: "start" });
      } catch (e) {
        if (!live) return;
        setError(errorText(e, uiText("settings.interface.couldn_t_reach_the_server_try_again_4fd19de")));
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
      if (new URL(url).origin !== DISCORD_ORIGIN) throw new Error(uiText("organization.interface.unexpected_address_f24f137"));
      window.location.assign(url);
    } catch (e) {
      setError(errorText(e, uiText("organization.interface.couldn_t_start_connecting_discord_try_again_932a4d7")));
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
      setError(errorText(e, uiText("organization.interface.couldn_t_disconnect_try_again_f88d82d")));
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
          <Localized k="organization.interface.checking_with_discord_that_you_manage_this_server_f906bc4" />
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
  useLocaleRender();
  return (
    <>
      {!props.configured ? (
        <div className="banner info" role="status">
          <Localized k="organization.interface.importing_from_discord_isn_t_set_up_on_this_server_yet_its_admini_c37a44c" />
        </div>
      ) : (
        <ol className="discord-steps">
          <li>
            <span>
              <Localized
                k="organization.interface.and_pick_your_server_discord_asks_to_add_meldiq_s_bot_which_only_a67f20c"
                slots={[
                  <strong>
                    <Localized k="organization.interface.connect_discord_7ac8482" />
                  </strong>,
                ]}
              />
            </span>
            <span className="discord-step-actions">
              <button className="btn btn-primary discord-connect" disabled={props.busy} onClick={props.onConnect}>
                <ExternalLink size={16} aria-hidden="true" /> {props.busy ? uiText("organization.interface.opening_discord_ab42d3b") : uiText("organization.interface.connect_discord_7ac8482")}
              </button>
              {props.connections.map((c) => (
                <button key={c.id} className="btn btn-secondary" onClick={() => props.onChoose(c)}>
                  <Localized k="organization.interface.continue_with_0cf4ada" slots={[c.guildName]} />
                </button>
              ))}
            </span>
          </li>
          <li>
            <Localized k="organization.interface.meldiq_checks_that_you_own_that_server_or_have_manage_server_ther_de1b3ef" />
          </li>
          <li>
            <Localized k="organization.interface.you_see_every_channel_role_and_emoji_that_would_be_made_and_choos_30c2bef" />
          </li>
        </ol>
      )}
      <div className="discord-lists">
        <section aria-labelledby="di-yes">
          <h3 id="di-yes" className="invite-or-title">
            <Localized k="organization.interface.comes_over_3d6ad47" />
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
            <Localized k="organization.interface.never_copied_ee31960" />
          </h3>
          <ul className="discord-bullets faint">
            <li>
              <Localized k="organization.interface.messages_and_history_4712375" />
            </li>
            <li>
              <Localized k="organization.interface.members_their_accounts_and_dms_e2d37ec" />
            </li>
            <li>
              <Localized k="organization.interface.bots_webhooks_stickers_and_events_a4e598b" />
            </li>
          </ul>
        </section>
      </div>
      <p className="faint discord-footnote">
        <Localized k="organization.interface.discord_doesn_t_allow_copying_messages_or_members_you_can_remove_bd9fdae" />
      </p>
    </>
  );
}
function Review({ connection, onBack, onDisconnect, onStarted }: { connection: DiscordConnection; onBack: () => void; onDisconnect: (leave: boolean) => void; onStarted: (id: string) => void }) {
  useLocaleRender();
  const l10n = useLocalization();
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
      .catch((e: unknown) => live && setError(errorText(e, uiText("organization.interface.couldn_t_read_the_discord_server_0a1073c"))));
    return () => {
      live = false;
    };
  }, [engine, connection.id, target]);
  const shown = useMemo(() => (preview ? previewFor(preview.items, options) : []), [preview, options]);
  const making = shown.filter((i) => i.action === "create").length;
  const nothingChosen = !options.icon && !options.roles && !options.channels && !options.emojis;
  const start = async () => {
    const destination: DiscordDestination = mode === "existing" ? { orgId } : { name: name.trim() };
    if (mode === "new" && !name.trim()) return setError(uiText("organization.interface.give_the_community_a_name_789d631"));
    if (mode === "existing" && !orgId) return setError(uiText("organization.interface.choose_a_community_66b588e"));
    setBusy(true);
    setError(null);
    try {
      onStarted((await startDiscordImport(engine, connection.id, destination, options)).id);
    } catch (e) {
      setError(errorText(e, uiText("organization.interface.couldn_t_start_the_import_try_again_ba41c4b")));
      setBusy(false);
    }
  };
  const toggle = (k: keyof DiscordImportOptions) => setOptions((o) => ({ ...o, [k]: !o[k], ...(k === "roles" && o.roles ? { rolePermissions: false } : {}) }));
  return (
    <>
      <p style={{ margin: 0 }}>
        <Localized k="organization.interface.connected_87a2b43" slots={[<strong>{connection.guildName}</strong>]} />
      </p>
      {error && (
        <div className="banner danger" role="alert">
          {error}
        </div>
      )}
      <div className="field">
        <span className="label">
          <Localized k="organization.interface.import_into_99153be" />
        </span>
        <div className="segmented" role="radiogroup" aria-label={uiText("organization.interface.import_into_99153be")}>
          <button type="button" role="radio" aria-checked={mode === "new"} aria-pressed={mode === "new"} onClick={() => setMode("new")}>
            <Localized k="organization.interface.a_new_community_74d1b24" />
          </button>
          <button type="button" role="radio" aria-checked={mode === "existing"} aria-pressed={mode === "existing"} disabled={runs.length === 0} onClick={() => setMode("existing")}>
            <Localized k="organization.interface.one_i_run_45ab97c" />
          </button>
        </div>
      </div>
      {mode === "new" ? (
        <div className="field">
          <label htmlFor="di-name">
            <Localized k="organization.interface.name_on_meldiq_80ff0b5" />
          </label>
          <input id="di-name" className="input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          <span className="hint">
            <Localized k="organization.interface.private_and_invite_only_to_start_you_can_list_it_in_discover_late_dd01c90" />
          </span>
        </div>
      ) : (
        <div className="field">
          <label htmlFor="di-org">{l10n("organization.community")}</label>
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
        <legend className="label">
          <Localized k="organization.interface.what_to_bring_over_7c82fe7" />
        </legend>
        <Toggle on={options.icon} onChange={() => toggle("icon")} label={uiText("organization.interface.server_icon_ab84351")} />
        <Toggle on={options.roles} onChange={() => toggle("roles")} label={uiText("organization.interface.roles_names_and_colours_6210fab")} />
        <Toggle
          on={options.rolePermissions}
          disabled={!options.roles}
          onChange={() => toggle("rolePermissions")}
          label={uiText("organization.interface.also_what_each_role_may_do_never_administrator_d75246b")}
        />
        <Toggle on={options.channels} onChange={() => toggle("channels")} label={uiText("organization.interface.categories_and_channels_4dc8430")} />
        <Toggle on={options.emojis} onChange={() => toggle("emojis")} label={uiText("organization.interface.custom_emoji_1596e05")} />
      </fieldset>
      <section aria-labelledby="di-preview" className="discord-preview">
        <h3 id="di-preview" className="invite-or-title">
          {preview ? uiText("organization.interface.preview_value0_to_make_8848a3c", { value0: making }) : uiText("organization.interface.preview_324b134")}
        </h3>
        {!preview && !error && <span className="skeleton" style={{ height: 120 }} aria-busy="true" />}
        {preview && <ItemList items={shown.map((i) => ({ key: i.key, kind: i.kind, name: i.name, state: i.action === "create" ? "create" : "skip", note: i.note }))} />}
        {preview && (
          <p className="faint discord-excluded">
            <Localized k="organization.interface.never_imported_4531e16" slots={[<CircleAlert size={13} aria-hidden="true" />, preview.excluded.join("; ")]} />
          </p>
        )}
      </section>
      <div className="discord-actions">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>
          {l10n("common.actions.back")}
        </button>
        <span className="grow" />
        <label className="discord-leave">
          <input type="checkbox" checked={leave} onChange={(e) => setLeave(e.target.checked)} />
          <Localized k="organization.interface.remove_the_bot_from_discord_f421a01" />
        </label>
        <button className="btn btn-secondary btn-sm" onClick={() => onDisconnect(leave)}>
          <Localized k="organization.interface.disconnect_b7715da" slots={[<Unplug size={14} aria-hidden="true" />]} />
        </button>
        <button className="btn btn-primary" disabled={busy || !preview || making === 0 || nothingChosen} onClick={() => void start()}>
          {busy ? uiText("organization.interface.starting_bbe5fc3") : uiText("organization.counts.importQuantity", { quantity: uiText("common.counts.items", { count: making }) })}
        </button>
      </div>
    </>
  );
}
function Progress({ id, onClose }: { id: string; onClose: () => void }) {
  useLocaleRender();
  const engine = useEngine();
  const [view, setView] = useState<{
    import: ImportView;
    items: DiscordImportItem[];
  } | null>(null);
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
        setError(errorText(e, uiText("organization.interface.lost_track_of_the_import_it_carries_on_check_again_4a197aa")));
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
      setError(errorText(e, uiText("organization.interface.couldn_t_retry_try_again_32e906f")));
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
            <Localized k="organization.interface.check_again_fb7099a" />
          </button>
        </div>
      )}
      {!view && !error && <span className="skeleton" style={{ height: 120 }} aria-busy="true" />}
      {imp && c && (
        <>
          <div aria-live="polite">
            <strong>{STATUS_TEXT[imp.status]}</strong>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              <Localized
                k="organization.interface.made_left_out_failed_5484bbe"
                slots={[c.done, c.skipped, c.failed, c.pending ? uiText("organization.interface.value0_to_go_447743c", { value0: c.pending }) : ""]}
              />
            </p>
          </div>
          <progress className="discord-progress" max={Math.max(c.total, 1)} value={settled} aria-label={uiText("organization.interface.import_progress_d3d5b27")} />
          {imp.error && <div className="banner danger">{imp.error}</div>}
          <ItemList items={view.items.map((i) => ({ key: i.key, kind: i.kind, name: i.name, state: i.status, note: i.note }))} />
          {finished && (c.failed > 0 || imp.status === "interrupted" || imp.status === "failed") && (
            <button className="btn btn-secondary" onClick={() => void retry()}>
              <Localized k="organization.interface.retry_what_didn_t_finish_d142770" slots={[<RotateCw size={16} aria-hidden="true" />]} />
            </button>
          )}
          {finished && imp.orgId && (
            <section className="invite-or" aria-labelledby="di-invite">
              <h3 id="di-invite" className="invite-or-title">
                <Localized k="organization.interface.invite_your_members_4fcde15" />
              </h3>
              <p className="muted">
                <Localized k="organization.interface.share_this_link_in_your_discord_server_so_people_can_join_on_meld_3984b6c" />
              </p>
              <QuickInvite orgId={imp.orgId} />
              <button className="btn btn-primary" onClick={open}>
                <Localized k="organization.interface.open_the_community_3466e69" />
              </button>
            </section>
          )}
        </>
      )}
    </>
  );
}
const STATUS_TEXT: Record<ImportView["status"], string> = {
  get running() {
    return uiText("organization.interface.importing_c01c432");
  },
  get completed() {
    return uiText("organization.interface.import_finished_2194340");
  },
  get completed_with_errors() {
    return uiText("organization.interface.finished_with_some_items_that_failed_0109f88");
  },
  get failed() {
    return uiText("organization.interface.the_import_stopped_ef251b4");
  },
  get interrupted() {
    return uiText("organization.interface.the_import_was_interrupted_3b09fb0");
  },
};
const STATE_TEXT: Record<string, string> = {
  get create() {
    return uiText("organization.interface.will_be_made_f4a5c7d");
  },
  get skip() {
    return uiText("organization.interface.left_out_d9287c9");
  },
  get pending() {
    return uiText("organization.interface.waiting_6e293a8");
  },
  get done() {
    return uiText("organization.interface.made_45a5300");
  },
  get failed() {
    return uiText("messaging.interface.failed_031a8f0");
  },
  get skipped() {
    return uiText("organization.interface.left_out_d9287c9");
  },
};
function ItemList({
  items,
}: {
  items: {
    key: string;
    kind: DiscordItemKind;
    name: string;
    state: string;
    note: string | null;
  }[];
}) {
  useLocaleRender();
  const groups = (Object.keys(KIND_LABEL) as DiscordItemKind[]).map((k) => ({ kind: k, items: items.filter((i) => i.kind === k) })).filter((g) => g.items.length > 0);
  if (groups.length === 0)
    return (
      <p className="faint">
        <Localized k="organization.interface.nothing_to_import_with_these_choices_9047e00" />
      </p>
    );
  return (
    <div className="discord-items">
      {groups.map((g) => (
        <div key={g.kind} role="group" aria-label={KIND_LABEL[g.kind]}>
          <h4 className="discord-kind">
            {KIND_ICON[g.kind]} {KIND_LABEL[g.kind]} ({formatUiNumber(g.items.length)})
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
  useLocaleRender();
  return (
    <label className={`discord-toggle${disabled ? " disabled" : ""}`}>
      <input type="checkbox" checked={on} disabled={disabled} onChange={onChange} /> {label}
    </label>
  );
}
const errorText = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);
