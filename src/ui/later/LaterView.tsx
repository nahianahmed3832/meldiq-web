import { useState } from "react";
import { useOrbit } from "../../app/orbit";
import { PERSONAL, savedOpen } from "../../sync/navPrefs";
import { RemindersList } from "./RemindersList";
import { SavedList } from "./SavedList";

type Tab = "saved" | "reminders";

/** Later (android Home › Later and Reminders): saved messages and reminders, the same on every device of the person. */
export function LaterView() {
  const [tab, setTab] = useState<Tab>("saved");
  const saved = useOrbit((s) => savedOpen(s.nav[PERSONAL]).length);
  const overdue = useOrbit((s) => s.reminders.items.filter((r) => r.state === "fired").length);
  return (
    <section className="main" aria-label="Later">
      <div className="view scroll">
        <div className="view-inner" style={{ maxWidth: 760 }}>
          <div>
            <h1>Later</h1>
            <p className="view-sub">Messages you saved and reminders you set, on all your devices.</p>
          </div>
          <div className="segmented" role="tablist" aria-label="Later" style={{ justifySelf: "start" }}>
            <button role="tab" aria-selected={tab === "saved"} onClick={() => setTab("saved")}>
              Saved{saved ? ` (${saved})` : ""}
            </button>
            <button role="tab" aria-selected={tab === "reminders"} onClick={() => setTab("reminders")}>
              Reminders{overdue ? ` (${overdue} overdue)` : ""}
            </button>
          </div>
          <div role="tabpanel">{tab === "saved" ? <SavedList /> : <RemindersList />}</div>
        </div>
      </div>
    </section>
  );
}
