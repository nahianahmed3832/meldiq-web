import { useLocaleRender } from "../../../i18n/Localized";
import { text as uiText } from "../../../i18n";
import { Localized } from "../../../i18n/Localized";
import { useT as useLocalization } from "../../../i18n";
import { PauseCircle, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useEngine } from "../../../application/orbit";
import type { PanelChannel } from "../../../sync/communityRules";
import { ALERT_PLACEHOLDERS, alertSourceProblem, BOT_LIMITS } from "../../../sync/officialBotRules";
import { officialBotError } from "../../../sync/officialBots";
import { addAlertWatch, type AlertWatch, type AlertWatches as Watches, alertWatches, removeAlertWatch } from "../../../sync/officialBotTools";
import type { Role } from "../../../sync/roles";
import { useLoad } from "../useLoad";
import { BotField, ChannelSelect, Placeholders, PlusChip } from "./BotParts";
interface AlertsWatchesProps {
  orgId: string;
  channels: PanelChannel[];
  roles: Role[];
  botsPlus: boolean;
}
interface Adding {
  source: string;
  channelId: string;
  roleId: string | null;
  message: string;
}
const EMPTY: Adding = { source: "", channelId: "", roleId: null, message: "" };
/**
 * Alerts' YouTube channels (its own routes, not settings): "N of 3" (25 with Bots+), each posting new uploads in a
 * channel with an optional ping and line; a link or @handle, Post in…, Ping, Add. Ones beyond the free limit without
 * Bots+ are kept but paused.
 */
export function AlertsWatches({ orgId, channels, roles, botsPlus }: AlertsWatchesProps) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const loaded = useLoad(() => alertWatches(engine, orgId), [engine, orgId]);
  const [view, setView] = useState<Watches | null>(null);
  const [adding, setAdding] = useState<Adding>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setView(loaded.data), [loaded.data]);
  const channelName = (id: string) => channels.find((c) => c.id === id)?.name ?? uiText("workspace.interface.a_deleted_channel_a0db809");
  const roleName = (id: string | null) => (id ? (roles.find((r) => r.id === id)?.name ?? uiText("workspace.interface.a_deleted_role_956c066")) : null);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(officialBotError(e));
    } finally {
      setBusy(false);
    }
  };
  const add = () => {
    const problem = alertSourceProblem(adding.source) ?? (adding.channelId ? null : uiText("workspace.interface.pick_the_channel_to_post_in_946941e"));
    if (problem) return setError(problem);
    void run(async () => {
      const watch = await addAlertWatch(engine, orgId, { source: adding.source.trim(), channelId: adding.channelId, roleId: adding.roleId, message: adding.message.trim() || null });
      setView((v) => (v ? { ...v, watches: [...v.watches, watch] } : v));
      setAdding(EMPTY);
    });
  };
  const remove = (w: AlertWatch) =>
    void run(async () => {
      await removeAlertWatch(engine, orgId, w.id);
      setView((v) => (v ? { ...v, watches: v.watches.filter((x) => x.id !== w.id) } : v));
    });
  if (!view) return loaded.error ? <small className="field-error">{loaded.error}</small> : <div className="skeleton" style={{ height: 60 }} aria-busy="true" />;
  const full = view.watches.length >= view.limit;
  return (
    <section className="obot-section" aria-label={uiText("workspace.interface.youtube_channels_d014030")}>
      <h4>
        <Localized k="workspace.interface.youtube_channels_of_65d785e" slots={[view.watches.length, view.limit]} />
      </h4>
      <small className="faint">
        <Localized k="workspace.interface.checked_every_10_minutes_only_uploads_after_you_add_a_channel_are_ae7949f" />
      </small>
      <ul className="ws-list">
        {view.watches.map((w) => (
          <li key={w.id} className="ws-row">
            <span className="lines grow">
              <span className="ellipsis">
                {w.creator} <small className="faint">{w.source}</small>
              </span>
              <small>
                #{channelName(w.channelId)}
                {roleName(w.roleId) ? uiText("workspace.interface.pings_value0_a91791e", { value0: roleName(w.roleId) }) : ""}
                {w.message ? uiText("workspace.interface.own_line_fac9df0") : ""}
              </small>
              {!w.active && (
                <small className="obot-paused">
                  <Localized k="workspace.interface.paused_only_are_checked_without_bots_37a35b8" slots={[<PauseCircle size={13} aria-hidden="true" />, BOT_LIMITS.alertWatches.free]} />
                </small>
              )}
            </span>
            <button
              type="button"
              className="icon-btn icon-btn-xs"
              disabled={busy}
              aria-label={uiText("workspace.interface.stop_following_value0_b04e00d", { value0: w.creator })}
              onClick={() => remove(w)}
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>
      {full ? (
        <small className="faint">
          {botsPlus
            ? uiText("workspace.interface.that_s_as_many_as_a_community_can_follow_5e44d2b")
            : uiText("workspace.interface.free_communities_follow_value0_bots_follows_value1_3b8c802", { value0: BOT_LIMITS.alertWatches.free, value1: BOT_LIMITS.alertWatches.plus })}
          {!botsPlus && <PlusChip />}
        </small>
      ) : (
        <BotField label={uiText("workspace.interface.follow_a_channel_9faed11")} botsPlus={botsPlus}>
          <div className="obot-feed-add">
            <input
              className="input"
              aria-label={uiText("workspace.interface.youtube_channel_link_or_handle_56ce4de")}
              placeholder={"youtube.com/@channel"}
              value={adding.source}
              onChange={(e) => setAdding({ ...adding, source: e.target.value })}
            />
            <ChannelSelect
              id="alerts-channel"
              value={adding.channelId || null}
              channels={channels}
              none={uiText("organization.interface.post_in_47273b3")}
              onChange={(id) => setAdding({ ...adding, channelId: id ?? "" })}
            />
            <select
              className="input"
              aria-label={uiText("workspace.interface.ping_role_43e4792")}
              value={adding.roleId ?? ""}
              onChange={(e) => setAdding({ ...adding, roleId: e.target.value || null })}
            >
              <option value="">
                <Localized k="workspace.interface.no_ping_31efa06" />
              </option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  @{r.name}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={add}>
              <Plus size={14} /> {l10n("common.actions.add")}
            </button>
          </div>
          <textarea
            className="input"
            rows={2}
            maxLength={BOT_LIMITS.alertMessage}
            aria-label={uiText("workspace.interface.alert_message_6d7e992")}
            placeholder={view.defaultMessage}
            value={adding.message}
            onChange={(e) => setAdding({ ...adding, message: e.target.value })}
          />
          <Placeholders items={ALERT_PLACEHOLDERS} onPick={(p) => setAdding({ ...adding, message: `${adding.message}${p}` })} />
          <small className="hint">
            <Localized k="workspace.interface.empty_meldiq_s_line_the_channel_s_name_the_video_its_link_the_pin_4e7de95" slots={["{creator}", "{title}", "{url}", "{role}"]} />
          </small>
        </BotField>
      )}
      {error && (
        <small className="field-error" role="alert">
          {error}
        </small>
      )}
    </section>
  );
}
