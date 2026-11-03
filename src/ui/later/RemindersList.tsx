import { formatUnit } from "../../i18n/format";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { AlarmClock, Check, Lock, MoreHorizontal, Pencil, Plus, TriangleAlert } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { decodeRecoveryCode } from "../../crypto/recoveryCode";
import { groupReminders, type Reminder, type Snooze, snoozeUntil } from "../../sync/reminderRules";
import { Menu, useMenu } from "../components/Overlay";
import { ReminderEditor } from "./ReminderEditor";
import { whenLabel } from "./when";
const REPEAT_LABEL = {
  get daily() {
    return uiText("workspace.interface.every_day_ed28f6c");
  },
  weekdays: "weekdays",
  get weekly() {
    return uiText("workspace.interface.every_week_845e594");
  },
  get monthly() {
    return uiText("workspace.interface.every_month_b087b7b");
  },
} as const;
const SNOOZES: {
  choice: Snooze;
  label: string;
}[] = [
  {
    choice: "10m",
    get label() {
      return formatUnit(10, "minute");
    },
  },
  {
    choice: "1h",
    get label() {
      return formatUnit(1, "hour");
    },
  },
  {
    choice: "evening",
    get label() {
      return uiText("workspace.interface.this_evening_db7dd46");
    },
  },
  {
    choice: "tomorrow",
    get label() {
      return uiText("workspace.interface.tomorrow_morning_ea64c9f");
    },
  },
];
/**
 * Reminders kept and fired by the server (android Reminders screen, server docs/REMINDERS.md): Upcoming, Overdue (went
 * off, not dealt with) and Done. What each says is sealed with the account's reminder key.
 */
export function RemindersList() {
  useLocaleRender();
  const l10n = useLocalization();
  const state = useOrbit((s) => s.reminders);
  const [editing, setEditing] = useState<Reminder | "new" | null>(null);
  if (!state.available)
    return (
      <p className="faint">
        <Localized k="workspace.interface.this_meldiq_server_doesn_t_keep_reminders_yet_b2b1636" />
      </p>
    );
  if (state.locked) return <UnlockReminders />;
  const g = groupReminders(state.items);
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <button className="btn btn-primary btn-sm" style={{ justifySelf: "start" }} onClick={() => setEditing("new")}>
        <Localized k="workspace.interface.new_reminder_a779191" slots={[<Plus size={15} />]} />
      </button>
      <Group title={uiText("workspace.interface.overdue_d660945")} items={g.overdue} onEdit={setEditing} />
      <Group title={uiText("workspace.interface.upcoming_5f1a254")} items={g.upcoming} onEdit={setEditing} empty={uiText("workspace.interface.nothing_coming_up_0c2860c")} />
      <Group title={l10n("common.actions.done")} items={g.done.slice(0, 20)} onEdit={setEditing} />
      {editing && <ReminderEditor reminder={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
function Group({ title, items, onEdit, empty }: { title: string; items: Reminder[]; onEdit: (r: Reminder) => void; empty?: string }) {
  useLocaleRender();
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
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const snooze = useMenu();
  const more = useMenu();
  const [error, setError] = useState<string | null>(null);
  const act = (p: Promise<unknown>) => void p.then(() => setError(null)).catch((e: unknown) => setError(e instanceof Error ? e.message : uiText("workspace.interface.couldn_t_change_it_3af772f")));
  const finished = r.state === "done" || r.state === "dismissed";
  return (
    <div className={`card later-row${finished ? " done" : ""}`}>
      <div className="row" style={{ gap: 10, alignItems: "flex-start" }}>
        <AlarmClock size={16} className="faint" style={{ marginTop: 2 }} />
        <div className="lines grow" style={{ display: "grid", gap: 2, minWidth: 0 }}>
          <strong className="ellipsis">{r.content?.title ?? uiText("workspace.interface.a_reminder_this_browser_can_t_read_6304a9d")}</strong>
          {r.content?.note && <span className="muted later-text">{r.content.note}</span>}
          <small className="faint">
            {r.state === "fired"
              ? uiText("workspace.interface.went_off_value0_631223a", { value0: whenLabel(r.firedAt ?? r.dueAt) })
              : finished
                ? r.state === "done"
                  ? l10n("common.actions.done")
                  : uiText("workspace.interface.stopped_1a4f630")
                : whenLabel(r.dueAt)}
            {r.recurrence ? uiText("calls.interface.value0_9402340", { value0: REPEAT_LABEL[r.recurrence] }) : ""}
            {r.content?.source === "later" ? uiText("workspace.interface.saved_message_076f144") : ""}
          </small>
          {r.deliveryFailed && (
            <small style={{ color: "var(--warning)" }}>
              <Localized k="workspace.interface.couldn_t_reach_every_device_when_it_went_off_e9c406f" slots={[<TriangleAlert size={12} />]} />
            </small>
          )}
          {error && <small style={{ color: "var(--danger)" }}>{error}</small>}
        </div>
      </div>
      {!finished && (
        <div className="row" style={{ gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button className="btn btn-ghost btn-sm" onClick={(e) => snooze.open(e.currentTarget)} aria-haspopup="menu">
            <Localized k="workspace.interface.snooze_5210294" />
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => act(engine.reminders.complete(r.id))}>
            <Check size={14} /> {l10n("common.actions.done")}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            aria-label={uiText("organization.interface.more_for_value0_87b81e8", { value0: r.content?.title ?? uiText("workspace.interface.reminder_348be0e") })}
            onClick={(e) => more.open(e.currentTarget)}
            aria-haspopup="menu"
          >
            <MoreHorizontal size={15} />
          </button>
        </div>
      )}
      {finished && (
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="btn btn-ghost btn-sm" onClick={() => act(engine.reminders.remove(r.id))}>
            {l10n("common.actions.delete")}
          </button>
        </div>
      )}
      {snooze.anchor && (
        <Menu
          anchor={snooze.anchor}
          label={uiText("workspace.interface.snooze_5210294")}
          align="end"
          onClose={snooze.close}
          entries={SNOOZES.map((s) => ({ label: s.label, onSelect: () => act(engine.reminders.reschedule(r.id, snoozeUntil(s.choice, Date.now()))) }))}
        />
      )}
      {more.anchor && (
        <Menu
          anchor={more.anchor}
          label={uiText("workspace.interface.reminder_31757bb")}
          align="end"
          onClose={more.close}
          entries={[
            ...(r.content ? [{ label: l10n("common.actions.edit"), icon: <Pencil size={16} />, onSelect: onEdit }] : []),
            {
              get label() {
                return uiText("workspace.interface.stop_reminding_c02bc39");
              },
              onSelect: () => act(engine.reminders.dismiss(r.id)),
            },
            "separator" as const,
            { label: l10n("common.actions.delete"), danger: true, onSelect: () => act(engine.reminders.remove(r.id)) },
          ]}
        />
      )}
    </div>
  );
}
/** Browsers set up before reminders existed: the recovery key, once, gives them the reminder key (it isn't kept). */
function UnlockReminders() {
  useLocaleRender();
  const l10n = useLocalization();
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
      if (!seed) throw new Error(uiText("workspace.interface.that_isn_t_a_recovery_key_check_it_and_try_again_cbfde37"));
      try {
        await engine.unlockReminders(seed);
      } finally {
        seed.fill(0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : uiText("workspace.interface.couldn_t_unlock_reminders_9f6a0fb"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="card" style={{ padding: 20, display: "grid", gap: 12 }} onSubmit={(e) => void submit(e)}>
      <div className="row" style={{ gap: 10, alignItems: "flex-start" }}>
        <Lock size={18} className="faint" style={{ marginTop: 2 }} />
        <div style={{ display: "grid", gap: 4 }}>
          <strong>
            <Localized k="workspace.interface.unlock_reminders_on_this_browser_b83b74f" />
          </strong>
          <span className="muted" style={{ fontSize: 13 }}>
            <Localized k="workspace.interface.reminders_are_encrypted_with_a_key_from_your_encryption_recovery_afef8ec" />
          </span>
        </div>
      </div>
      {error && (
        <div className="banner danger" role="alert">
          {error}
        </div>
      )}
      <textarea className="textarea mono" rows={2} value={code} onChange={(e) => setCode(e.target.value)} aria-label={l10n("common.common_recovery_key")} autoComplete="off" spellCheck={false} />
      <button className="btn btn-primary btn-sm" style={{ justifySelf: "start" }} disabled={busy || !code.trim()}>
        {busy ? l10n("onboarding.setup_unlocking") : uiText("workspace.interface.unlock_reminders_d1e8172")}
      </button>
    </form>
  );
}
