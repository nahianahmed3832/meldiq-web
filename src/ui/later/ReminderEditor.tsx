import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { type FormEvent, useState } from "react";
import { useEngine } from "../../application/orbit";
import { defaultTime, NOTE_MAX, type Recurrence, type Reminder, TITLE_MAX, validTitle } from "../../sync/reminderRules";
import { Dialog } from "../components/Overlay";
import { fromLocalInput, toLocalInput } from "./when";
const REPEATS: {
  value: Recurrence | "";
  label: string;
}[] = [
  {
    value: "",
    get label() {
      return uiText("workspace.interface.once_d88f6d8");
    },
  },
  {
    value: "daily",
    get label() {
      return uiText("workspace.interface.every_day_c4e42b9");
    },
  },
  {
    value: "weekdays",
    get label() {
      return uiText("workspace.interface.weekdays_6f4b602");
    },
  },
  {
    value: "weekly",
    get label() {
      return uiText("workspace.interface.every_week_1b7e185");
    },
  },
  {
    value: "monthly",
    get label() {
      return uiText("workspace.interface.every_month_24859dc");
    },
  },
];
/** A new reminder or a change to one (android Reminders › New reminder): title, note, time in this browser's zone, repeat. */
export function ReminderEditor({ reminder, onClose }: { reminder: Reminder | null; onClose: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const [title, setTitle] = useState(reminder?.content?.title ?? "");
  const [note, setNote] = useState(reminder?.content?.note ?? "");
  const [when, setWhen] = useState(toLocalInput(reminder?.dueAt ?? defaultTime(Date.now())));
  const [repeat, setRepeat] = useState<Recurrence | "">(reminder?.recurrence ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const at = fromLocalInput(when);
  const problem = !validTitle(title)
    ? uiText("workspace.interface.give_it_a_title_222621e")
    : at === null
      ? uiText("workspace.interface.pick_a_date_and_time_9af72ad")
      : !reminder && at <= Date.now()
        ? uiText("workspace.interface.pick_a_time_in_the_future_ebfef07")
        : null;
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
      setError(err instanceof Error ? err.message : uiText("workspace.interface.couldn_t_save_the_reminder_2a8638d"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      title={reminder ? uiText("workspace.interface.edit_reminder_1f1353b") : uiText("workspace.interface.new_reminder_70f22f4")}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            {l10n("common.actions.cancel")}
          </button>
          <button className="btn btn-primary" disabled={busy || !!problem} onClick={() => void save()}>
            {busy ? l10n("common.common_saving") : l10n("common.actions.save")}
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
          <span>
            <Localized k="messaging.interface.title_7e8cd20" />
          </span>
          <input className="input" value={title} maxLength={TITLE_MAX} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </label>
        <label className="field">
          <span>
            <Localized k="workspace.interface.note_d8da2c4" />
          </span>
          <textarea className="textarea" rows={3} value={note} maxLength={NOTE_MAX} onChange={(e) => setNote(e.target.value)} placeholder={uiText("workspace.interface.optional_59be713")} />
        </label>
        <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
          <label className="field" style={{ flex: "1 1 220px" }}>
            <span>
              <Localized k="workspace.interface.when_cf9c7aa" />
            </span>
            <input className="input" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </label>
          <label className="field" style={{ flex: "1 1 160px" }}>
            <span>
              <Localized k="workspace.interface.repeat_b6b7a00" />
            </span>
            <select className="input" value={repeat} onChange={(e) => setRepeat(e.target.value as Recurrence | "")}>
              {REPEATS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <span className="hint">
          <Localized k="workspace.interface.what_it_says_is_encrypted_on_this_browser_the_server_only_knows_w_27ce488" />
        </span>
      </form>
    </Dialog>
  );
}
