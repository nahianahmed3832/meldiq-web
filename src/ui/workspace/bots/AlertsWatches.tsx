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
  const engine = useEngine();
  const loaded = useLoad(() => alertWatches(engine, orgId), [engine, orgId]);
  const [view, setView] = useState<Watches | null>(null);
  const [adding, setAdding] = useState<Adding>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setView(loaded.data), [loaded.data]);

  const channelName = (id: string) => channels.find((c) => c.id === id)?.name ?? "a deleted channel";
  const roleName = (id: string | null) => (id ? (roles.find((r) => r.id === id)?.name ?? "a deleted role") : null);
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
    const problem = alertSourceProblem(adding.source) ?? (adding.channelId ? null : "Pick the channel to post in.");
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
    <section className="obot-section" aria-label="YouTube channels">
      <h4>
        YouTube channels · {view.watches.length} of {view.limit}
      </h4>
      <small className="faint">Checked every 10 minutes; only uploads after you add a channel are posted.</small>
      <ul className="ws-list">
        {view.watches.map((w) => (
          <li key={w.id} className="ws-row">
            <span className="lines grow">
              <span className="ellipsis">
                {w.creator} <small className="faint">{w.source}</small>
              </span>
              <small>
                #{channelName(w.channelId)}
                {roleName(w.roleId) ? ` · pings @${roleName(w.roleId)}` : ""}
                {w.message ? " · own line" : ""}
              </small>
              {!w.active && (
                <small className="obot-paused">
                  <PauseCircle size={13} aria-hidden="true" /> Paused: only {BOT_LIMITS.alertWatches.free} are checked without Bots+.
                </small>
              )}
            </span>
            <button type="button" className="icon-btn icon-btn-xs" disabled={busy} aria-label={`Stop following ${w.creator}`} onClick={() => remove(w)}>
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>
      {full ? (
        <small className="faint">
          {botsPlus ? "That's as many as a community can follow." : `Free communities follow ${BOT_LIMITS.alertWatches.free}; Bots+ follows ${BOT_LIMITS.alertWatches.plus}.`}
          {!botsPlus && <PlusChip />}
        </small>
      ) : (
        <BotField label="Follow a channel" botsPlus={botsPlus}>
          <div className="obot-feed-add">
            <input
              className="input"
              aria-label="YouTube channel link or @handle"
              placeholder="youtube.com/@channel"
              value={adding.source}
              onChange={(e) => setAdding({ ...adding, source: e.target.value })}
            />
            <ChannelSelect id="alerts-channel" value={adding.channelId || null} channels={channels} none="Post in…" onChange={(id) => setAdding({ ...adding, channelId: id ?? "" })} />
            <select className="input" aria-label="Ping role" value={adding.roleId ?? ""} onChange={(e) => setAdding({ ...adding, roleId: e.target.value || null })}>
              <option value="">No ping</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  @{r.name}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={add}>
              <Plus size={14} /> Add
            </button>
          </div>
          <textarea
            className="input"
            rows={2}
            maxLength={BOT_LIMITS.alertMessage}
            aria-label="Alert message"
            placeholder={view.defaultMessage}
            value={adding.message}
            onChange={(e) => setAdding({ ...adding, message: e.target.value })}
          />
          <Placeholders items={ALERT_PLACEHOLDERS} onPick={(p) => setAdding({ ...adding, message: `${adding.message}${p}` })} />
          <small className="hint">
            Empty: Meldiq's line. {"{creator}"} the channel's name, {"{title}"} the video, {"{url}"} its link, {"{role}"} the ping.
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
