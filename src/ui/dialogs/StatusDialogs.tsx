import { BellOff, Clock } from "lucide-react";
import { type FormEvent, useState } from "react";
import { ApiError } from "../../api/client";
import { useEngine, useOrbit } from "../../app/orbit";
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

const errorText = (e: unknown) => (e instanceof ApiError ? e.message : "Couldn't save. Check the connection and try again.");
const clock = (t: number) => new Date(t).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" });

/** "Set a status" (round 3, the reference's status screen): suggestions, your own text and emoji, and when it clears. */
export function StatusDialog({ onClose }: { onClose: () => void }) {
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
    <Dialog title="Set a status" onClose={onClose}>
      <form className="dialog-body" onSubmit={submit} noValidate>
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        <div className="row" style={{ gap: 8 }}>
          <div className="field" style={{ width: 88 }}>
            <label htmlFor="st-emoji">Emoji</label>
            <input id="st-emoji" className="input" value={emoji} maxLength={EMOJI_MAX_LENGTH} onChange={(e) => setEmoji(e.target.value)} placeholder="💬" />
          </div>
          <div className="field grow">
            <label htmlFor="st-text">What's your status?</label>
            <input id="st-text" className="input" data-autofocus value={text} maxLength={STATUS_MAX_LENGTH} onChange={(e) => setText(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="st-clear">Clear after</label>
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
            Suggestions
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
              Clear status
            </button>
          )}
          <button className="btn btn-primary" disabled={busy || (!text.trim() && !emoji.trim())}>
            {busy ? "Saving…" : "Save status"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/** "Pause notifications": for a while or until tomorrow morning, on every device; or resume. */
export function PauseDialog({ onClose }: { onClose: () => void }) {
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
    <Dialog title="Pause notifications" onClose={onClose}>
      <div className="dialog-body">
        <p className="muted" style={{ margin: 0 }}>
          Messages still arrive; your devices stay quiet. Calls still ring.
        </p>
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        {isPaused && until !== null && (
          <div className="banner" role="status">
            <BellOff size={16} aria-hidden /> Notifications paused until {clock(until)}
            <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void set(null)} style={{ marginInlineStart: "auto" }}>
              Resume
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
