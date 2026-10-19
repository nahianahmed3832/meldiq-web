import { type FormEvent, useState } from "react";
import { useEngine } from "../../app/orbit";
import { defaultTime, NOTE_MAX, type Recurrence, type Reminder, TITLE_MAX, validTitle } from "../../sync/reminderRules";
import { Dialog } from "../components/Overlay";
import { fromLocalInput, toLocalInput } from "./when";

const REPEATS: { value: Recurrence | ""; label: string }[] = [
  { value: "", label: "Once" },
  { value: "daily", label: "Every day" },
  { value: "weekdays", label: "Weekdays" },
  { value: "weekly", label: "Every week" },
  { value: "monthly", label: "Every month" },
];

/** A new reminder or a change to one (android Reminders › New reminder): title, note, time in this browser's zone, repeat. */
export function ReminderEditor({ reminder, onClose }: { reminder: Reminder | null; onClose: () => void }) {
  const engine = useEngine();
  const [title, setTitle] = useState(reminder?.content?.title ?? "");
  const [note, setNote] = useState(reminder?.content?.note ?? "");
  const [when, setWhen] = useState(toLocalInput(reminder?.dueAt ?? defaultTime(Date.now())));
  const [repeat, setRepeat] = useState<Recurrence | "">(reminder?.recurrence ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const at = fromLocalInput(when);
  const problem = !validTitle(title) ? "Give it a title." : at === null ? "Pick a date and time." : !reminder && at <= Date.now() ? "Pick a time in the future." : null;

  const save = async (e?: FormEvent) => {
    e?.preventDefault();
    if (problem || at === null) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      if (reminder?.content) await engine.reminders.edit(reminder.id, { ...reminder.content, title: title.trim(), note: note.trim() || null }, at, repeat || null);
      else await engine.reminders.create({ title, note, dueAt: at, recurrence: repeat || null });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the reminder.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      title={reminder ? "Edit reminder" : "New reminder"}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy || !!problem} onClick={() => void save()}>
            {busy ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <form className="dialog-body" onSubmit={(e) => void save(e)}>
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        <label className="field">
          <span>Title</span>
          <input className="input" value={title} maxLength={TITLE_MAX} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </label>
        <label className="field">
          <span>Note</span>
          <textarea className="textarea" rows={3} value={note} maxLength={NOTE_MAX} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
        </label>
        <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
          <label className="field" style={{ flex: "1 1 220px" }}>
            <span>When</span>
            <input className="input" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </label>
          <label className="field" style={{ flex: "1 1 160px" }}>
            <span>Repeat</span>
            <select className="input" value={repeat} onChange={(e) => setRepeat(e.target.value as Recurrence | "")}>
              {REPEATS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <span className="hint">What it says is encrypted on this browser; the server only knows when it's due. It goes off on all your devices.</span>
      </form>
    </Dialog>
  );
}
