import { useState } from "react";
import { snoozeUntil } from "../../sync/reminderRules";
import { Dialog } from "../components/Overlay";
import { fromLocalInput, toLocalInput, whenLabel } from "./when";

const HOUR = 60 * 60_000;

/**
 * When to be reminded of a saved message (android Later › Remind me): a few quick choices or a date and time. The time is
 * kept with the saved item; when the server keeps reminders, it fires on every device even with no tab open.
 */
export function RemindMeDialog({ title, current, onPick, onClear, onClose }: { title: string; current: number | null; onPick: (at: number) => void; onClear?: () => void; onClose: () => void }) {
  const now = Date.now();
  const [custom, setCustom] = useState(toLocalInput(current ?? snoozeUntil("tomorrow", now)));
  const customAt = fromLocalInput(custom);
  const choices: { label: string; at: number }[] = [
    { label: "In 1 hour", at: now + HOUR },
    { label: "In 3 hours", at: now + 3 * HOUR },
    { label: "This evening", at: snoozeUntil("evening", now) },
    { label: "Tomorrow morning", at: snoozeUntil("tomorrow", now) },
  ];
  return (
    <Dialog
      title={title}
      onClose={onClose}
      footer={
        <>
          {onClear && current !== null && (
            <button className="btn btn-ghost" onClick={onClear}>
              Remove reminder
            </button>
          )}
          <span className="grow" />
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={customAt === null || customAt <= now} onClick={() => customAt && onPick(customAt)}>
            Set
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
          <span>Or pick a date and time</span>
          <input className="input" type="datetime-local" value={custom} min={toLocalInput(now)} onChange={(e) => setCustom(e.target.value)} />
        </label>
      </div>
    </Dialog>
  );
}
