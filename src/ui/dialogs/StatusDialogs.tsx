import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { interfaceLocale } from "../../i18n/format";
import { useT as useLocalization } from "../../i18n";
import { BellOff, Clock } from "lucide-react";
import { type FormEvent, useState } from "react";
import { ApiError } from "../../api/client";
import { currentPresence, PRESENCE_DURATIONS, PRESENCE_LABEL, PRESENCE_MODES, type PresenceMode, setPresence } from "../../sync/social";
import { useEngine, useOrbit } from "../../application/orbit";
import {
  CLEAR_AFTER_LABEL,
  type ClearAfter,
  EMOJI_MAX_LENGTH,
  expiresAt,
  PAUSE_LABEL,
  type Pause,
  paused,
  pauseUntil,
  PRESETS,
  setNotificationsPaused,
  setStatus,
  STATUS_MAX_LENGTH,
  statusLine,
} from "../../sync/status";
import { Dialog } from "../components/Overlay";
import { hourCycle } from "../format";
import { getPrefs } from "../../application/prefs";
const errorText = (e: unknown) => (e instanceof ApiError ? e.message : uiText("workspace.interface.couldn_t_save_check_the_connection_and_try_again_695ad69"));
const clock = (t: number) => new Date(t).toLocaleString(interfaceLocale(), { weekday: "short", hour: "numeric", minute: "2-digit", ...hourCycle(getPrefs().timeFormat) });
/** "Set a status" (round 3, the reference's status screen): suggestions, your own text and emoji, and when it clears. */
export function StatusDialog({ onClose }: { onClose: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const me = useOrbit((s) => s.me);
  const live = statusLine(me, Date.now()) !== null;
  const [text, setText] = useState(live ? (me?.statusText ?? "") : "");
  const [emoji, setEmoji] = useState(live ? (me?.statusEmoji ?? "") : "");
  const [clearAfter, setClearAfter] = useState<ClearAfter>("never");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async (t: string | null, e: string | null, until: number | null) => {
    setBusy(true);
    setError(null);
    try {
      await setStatus(engine, t, e, until);
      onClose();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    if (!text.trim() && !emoji.trim()) return;
    void save(text.trim() || null, emoji.trim() || null, expiresAt(clearAfter, Date.now()));
  };
  return (
    <Dialog title={uiText("workspace.interface.set_a_status_aadfb22")} onClose={onClose}>
      <form className="dialog-body" onSubmit={submit} noValidate>
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        <div className="row" style={{ gap: 8 }}>
          <div className="field" style={{ width: 88 }}>
            <label htmlFor="st-emoji">
              <Localized k="messaging.interface.emoji_61ad897" />
            </label>
            <input id="st-emoji" className="input" value={emoji} maxLength={EMOJI_MAX_LENGTH} onChange={(e) => setEmoji(e.target.value)} placeholder="💬" />
          </div>
          <div className="field grow">
            <label htmlFor="st-text">
              <Localized k="workspace.interface.what_s_your_status_8723283" />
            </label>
            <input id="st-text" className="input" data-autofocus value={text} maxLength={STATUS_MAX_LENGTH} onChange={(e) => setText(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="st-clear">
            <Localized k="workspace.interface.clear_after_f54b750" />
          </label>
          <select id="st-clear" className="input" value={clearAfter} onChange={(e) => setClearAfter(e.target.value as ClearAfter)}>
            {(Object.keys(CLEAR_AFTER_LABEL) as ClearAfter[]).map((k) => (
              <option key={k} value={k}>
                {CLEAR_AFTER_LABEL[k]}
              </option>
            ))}
          </select>
        </div>
        <div role="group" aria-labelledby="st-suggestions" className="status-presets">
          <h3 id="st-suggestions" className="ws-subhead">
            <Localized k="workspace.interface.suggestions_16c1d60" />
          </h3>
          {PRESETS.map((p) => (
            <button key={p.text} type="button" className="side-item" disabled={busy} onClick={() => void save(p.text, p.emoji, expiresAt(p.clearAfter, Date.now()))}>
              <span className="glyph" aria-hidden>
                {p.emoji}
              </span>
              <span className="grow">{p.text}</span>
              <span className="faint">{CLEAR_AFTER_LABEL[p.clearAfter]}</span>
            </button>
          ))}
        </div>
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          {live && (
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void save(null, null, null)}>
              <Localized k="workspace.interface.clear_status_9a48efe" />
            </button>
          )}
          <button className="btn btn-primary" disabled={busy || (!text.trim() && !emoji.trim())}>
            {busy ? l10n("common.common_saving") : uiText("workspace.interface.save_status_a371cfd")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
/** "Pause notifications": for a while or until tomorrow morning, on every device; or resume. */
export function PauseDialog({ onClose }: { onClose: () => void }) {
  useLocaleRender();
  const engine = useEngine();
  const until = useOrbit((s) => s.me?.notificationsPausedUntil ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isPaused = paused(until, Date.now());
  const set = async (value: number | null) => {
    setBusy(true);
    setError(null);
    try {
      await setNotificationsPaused(engine, value);
      onClose();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog title={uiText("workspace.interface.pause_notifications_8761757")} onClose={onClose}>
      <div className="dialog-body">
        <p className="muted" style={{ margin: 0 }}>
          <Localized k="workspace.interface.messages_still_arrive_your_devices_stay_quiet_calls_still_ring_24bb63c" />
        </p>
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        {isPaused && until !== null && (
          <div className="banner" role="status">
            <Localized k="workspace.interface.notifications_paused_until_6f28fd6" slots={[<BellOff size={16} aria-hidden />, clock(until)]} />
            <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void set(null)} style={{ marginInlineStart: "auto" }}>
              <Localized k="messaging.interface.resume_d640c74" />
            </button>
          </div>
        )}
        {(Object.keys(PAUSE_LABEL) as Pause[]).map((k) => (
          <button key={k} type="button" className="side-item" disabled={busy} onClick={() => void set(pauseUntil(k, Date.now()))}>
            <span className="glyph">
              <Clock size={16} />
            </span>
            <span className="grow">{PAUSE_LABEL[k]}</span>
          </button>
        ))}
      </div>
    </Dialog>
  );
}
/**
 * Presence (batch B6b, android PresenceSheet): Online (automatic), Idle, Do not disturb (also pauses notifications on
 * every device for as long), Invisible (offline to everyone, last seen unchanged); for 1 hour to 7 days or until changed.
 */
export function PresenceDialog({ onClose }: { onClose: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const me = useOrbit((s) => s.me);
  const current = currentPresence(me?.presenceMode, me?.presenceUntil, Date.now());
  const [mode, setMode] = useState<PresenceMode>(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const choose = (ms: number | null) => {
    setBusy(true);
    setError(null);
    setPresence(engine, mode, mode === "auto" || ms === null ? null : Date.now() + ms, current === "dnd")
      .then(onClose)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : uiText("workspace.interface.couldn_t_change_your_presence_482753e")))
      .finally(() => setBusy(false));
  };
  return (
    <Dialog title={uiText("workspace.interface.presence_d6b3e8c")} onClose={onClose}>
      <div className="dialog-body">
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        <div role="radiogroup" aria-label={uiText("workspace.interface.how_you_appear_4853397")} style={{ display: "grid", gap: 2 }}>
          {PRESENCE_MODES.map((m) => (
            <button key={m} role="radio" aria-checked={mode === m} aria-pressed={mode === m} className="list-row" onClick={() => setMode(m)}>
              <span className={`presence-line`}>
                <span className={`dot${m === "idle" ? " idle" : m === "dnd" ? " dnd" : ""}`} style={m === "invisible" ? { background: "var(--presence-off)" } : undefined} aria-hidden />
              </span>
              <span className="lines">
                <span style={{ fontWeight: 600 }}>{PRESENCE_LABEL[m].label}</span>
                <small>{PRESENCE_LABEL[m].hint}</small>
              </span>
            </button>
          ))}
        </div>
        {mode === "auto" ? (
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="btn btn-primary" disabled={busy} onClick={() => choose(null)}>
              {l10n("common.actions.save")}
            </button>
          </div>
        ) : (
          <>
            <h3 className="ws-subhead">
              <Localized k="workspace.interface.for_how_long_99a013a" />
            </h3>
            <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
              {PRESENCE_DURATIONS.map((d) => (
                <button key={d.label} className="btn btn-secondary btn-sm" disabled={busy} onClick={() => choose(d.ms)}>
                  {d.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
