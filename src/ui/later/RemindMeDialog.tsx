import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { useState } from "react";
import { snoozeUntil } from "../../sync/reminderRules";
import { Dialog } from "../components/Overlay";
import { fromLocalInput, toLocalInput, whenLabel } from "./when";
const HOUR = 60 * 60000;
/**
 * When to be reminded of a saved message (android Later › Remind me): a few quick choices or a date and time. The time is
 * kept with the saved item; when the server keeps reminders, it fires on every device even with no tab open.
 */
export function RemindMeDialog({ title, current, onPick, onClear, onClose }: { title: string; current: number | null; onPick: (at: number) => void; onClear?: () => void; onClose: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const now = Date.now();
  const [custom, setCustom] = useState(toLocalInput(current ?? snoozeUntil("tomorrow", now)));
  const customAt = fromLocalInput(custom);
  const choices: {
    label: string;
    at: number;
  }[] = [
    {
      get label() {
        return uiText("workspace.interface.in_1_hour_698eab0");
      },
      at: now + HOUR,
    },
    {
      get label() {
        return uiText("workspace.interface.in_3_hours_f7a5792");
      },
      at: now + 3 * HOUR,
    },
    {
      get label() {
        return uiText("workspace.interface.this_evening_db7dd46");
      },
      at: snoozeUntil("evening", now),
    },
    {
      get label() {
        return uiText("workspace.interface.tomorrow_morning_ea64c9f");
      },
      at: snoozeUntil("tomorrow", now),
    },
  ];
  return (
    <Dialog
      title={title}
      onClose={onClose}
      footer={
        <>
          {onClear && current !== null && (
            <button className="btn btn-ghost" onClick={onClear}>
              <Localized k="workspace.interface.remove_reminder_aab6824" />
            </button>
          )}
          <span className="grow" />
          <button className="btn btn-secondary" onClick={onClose}>
            {l10n("common.actions.cancel")}
          </button>
          <button className="btn btn-primary" disabled={customAt === null || customAt <= now} onClick={() => customAt && onPick(customAt)}>
            <Localized k="workspace.interface.set_b6f6f3a" />
          </button>
        </>
      }
    >
      <div className="dialog-body">
        <div style={{ display: "grid", gap: 4 }}>
          {choices.map((c) => (
            <button key={c.label} className="list-row" onClick={() => onPick(c.at)}>
              <span className="lines">
                <span>{c.label}</span>
                <small>{whenLabel(c.at, now)}</small>
              </span>
            </button>
          ))}
        </div>
        <label className="field">
          <span>
            <Localized k="workspace.interface.or_pick_a_date_and_time_284cc05" />
          </span>
          <input className="input" type="datetime-local" value={custom} min={toLocalInput(now)} onChange={(e) => setCustom(e.target.value)} />
        </label>
      </div>
    </Dialog>
  );
}
