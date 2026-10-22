import { AlarmClock, Check, Lock, MoreHorizontal, Pencil, Plus, TriangleAlert } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { decodeRecoveryCode } from "../../crypto/recoveryCode";
import { groupReminders, type Reminder, type Snooze, snoozeUntil } from "../../sync/reminderRules";
import { Menu, useMenu } from "../components/Overlay";
import { ReminderEditor } from "./ReminderEditor";
import { whenLabel } from "./when";

const REPEAT_LABEL = { daily: "every day", weekdays: "weekdays", weekly: "every week", monthly: "every month" } as const;
const SNOOZES: { choice: Snooze; label: string }[] = [
  { choice: "10m", label: "10 minutes" },
  { choice: "1h", label: "1 hour" },
  { choice: "evening", label: "This evening" },
  { choice: "tomorrow", label: "Tomorrow morning" },
];

/**
 * Reminders kept and fired by the server (android Reminders screen, server docs/REMINDERS.md): Upcoming, Overdue (went
 * off, not dealt with) and Done. What each says is sealed with the account's reminder key.
 */
export function RemindersList() {
  const state = useOrbit((s) => s.reminders);
  const [editing, setEditing] = useState<Reminder | "new" | null>(null);
  if (!state.available) return <p className="faint">This Meldiq server doesn't keep reminders yet.</p>;
  if (state.locked) return <UnlockReminders />;
  const g = groupReminders(state.items);
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <button className="btn btn-primary btn-sm" style={{ justifySelf: "start" }} onClick={() => setEditing("new")}>
        <Plus size={15} /> New reminder
      </button>
      <Group title="Overdue" items={g.overdue} onEdit={setEditing} />
      <Group title="Upcoming" items={g.upcoming} onEdit={setEditing} empty="Nothing coming up." />
      <Group title="Done" items={g.done.slice(0, 20)} onEdit={setEditing} />
      {editing && <ReminderEditor reminder={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function Group({ title, items, onEdit, empty }: { title: string; items: Reminder[]; onEdit: (r: Reminder) => void; empty?: string }) {
  if (!items.length && !empty) return null;
  return (
    <section style={{ display: "grid", gap: 6 }} aria-label={title}>
      <div className="panel-section-title">
        <span>{title}</span>
        <span>{items.length || ""}</span>
      </div>
      {items.length === 0 && (
        <p className="faint" style={{ margin: 0 }}>
          {empty}
        </p>
      )}
      {items.map((r) => (
        <ReminderRow key={r.id} r={r} onEdit={() => onEdit(r)} />
      ))}
    </section>
  );
}

function ReminderRow({ r, onEdit }: { r: Reminder; onEdit: () => void }) {
  const engine = useEngine();
  const snooze = useMenu();
  const more = useMenu();
  const [error, setError] = useState<string | null>(null);
  const act = (p: Promise<unknown>) => void p.then(() => setError(null)).catch((e: unknown) => setError(e instanceof Error ? e.message : "Couldn't change it."));
  const finished = r.state === "done" || r.state === "dismissed";
  return (
    <div className={`card later-row${finished ? " done" : ""}`}>
      <div className="row" style={{ gap: 10, alignItems: "flex-start" }}>
        <AlarmClock size={16} className="faint" style={{ marginTop: 2 }} />
        <div className="lines grow" style={{ display: "grid", gap: 2, minWidth: 0 }}>
          <strong className="ellipsis">{r.content?.title ?? "A reminder this browser can't read"}</strong>
          {r.content?.note && <span className="muted later-text">{r.content.note}</span>}
          <small className="faint">
            {r.state === "fired" ? `Went off ${whenLabel(r.firedAt ?? r.dueAt)}` : finished ? (r.state === "done" ? "Done" : "Stopped") : whenLabel(r.dueAt)}
            {r.recurrence ? ` · ${REPEAT_LABEL[r.recurrence]}` : ""}
            {r.content?.source === "later" ? " · saved message" : ""}
          </small>
          {r.deliveryFailed && (
            <small style={{ color: "var(--warning)" }}>
              <TriangleAlert size={12} /> Couldn't reach every device when it went off.
            </small>
          )}
          {error && <small style={{ color: "var(--danger)" }}>{error}</small>}
        </div>
      </div>
      {!finished && (
        <div className="row" style={{ gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button className="btn btn-ghost btn-sm" onClick={(e) => snooze.open(e.currentTarget)} aria-haspopup="menu">
            Snooze
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => act(engine.reminders.complete(r.id))}>
            <Check size={14} /> Done
          </button>
          <button className="btn btn-ghost btn-sm" aria-label={`More for ${r.content?.title ?? "reminder"}`} onClick={(e) => more.open(e.currentTarget)} aria-haspopup="menu">
            <MoreHorizontal size={15} />
          </button>
        </div>
      )}
      {finished && (
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="btn btn-ghost btn-sm" onClick={() => act(engine.reminders.remove(r.id))}>
            Delete
          </button>
        </div>
      )}
      {snooze.anchor && (
        <Menu
          anchor={snooze.anchor}
          label="Snooze"
          align="end"
          onClose={snooze.close}
          entries={SNOOZES.map((s) => ({ label: s.label, onSelect: () => act(engine.reminders.reschedule(r.id, snoozeUntil(s.choice, Date.now()))) }))}
        />
      )}
      {more.anchor && (
        <Menu
          anchor={more.anchor}
          label="Reminder"
          align="end"
          onClose={more.close}
          entries={[
            ...(r.content ? [{ label: "Edit", icon: <Pencil size={16} />, onSelect: onEdit }] : []),
            { label: "Stop reminding", onSelect: () => act(engine.reminders.dismiss(r.id)) },
            "separator" as const,
            { label: "Delete", danger: true, onSelect: () => act(engine.reminders.remove(r.id)) },
          ]}
        />
      )}
    </div>
  );
}

/** Browsers set up before reminders existed: the recovery key, once, gives them the reminder key (it isn't kept). */
function UnlockReminders() {
  const engine = useEngine();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const seed = await decodeRecoveryCode(code);
      if (!seed) throw new Error("That isn't a recovery key. Check it and try again.");
      try {
        await engine.unlockReminders(seed);
      } finally {
        seed.fill(0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't unlock reminders.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="card" style={{ padding: 20, display: "grid", gap: 12 }} onSubmit={(e) => void submit(e)}>
      <div className="row" style={{ gap: 10, alignItems: "flex-start" }}>
        <Lock size={18} className="faint" style={{ marginTop: 2 }} />
        <div style={{ display: "grid", gap: 4 }}>
          <strong>Unlock reminders on this browser</strong>
          <span className="muted" style={{ fontSize: 13 }}>
            Reminders are encrypted with a key from your encryption recovery key. This browser was set up before reminders existed, so it needs your recovery key once. It stays here and is never sent.
          </span>
        </div>
      </div>
      {error && (
        <div className="banner danger" role="alert">
          {error}
        </div>
      )}
      <textarea className="textarea mono" rows={2} value={code} onChange={(e) => setCode(e.target.value)} aria-label="Recovery key" autoComplete="off" spellCheck={false} />
      <button className="btn btn-primary btn-sm" style={{ justifySelf: "start" }} disabled={busy || !code.trim()}>
        {busy ? "Unlocking…" : "Unlock reminders"}
      </button>
    </form>
  );
}
