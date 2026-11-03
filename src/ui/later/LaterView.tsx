import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { useState } from "react";
import { useOrbit } from "../../application/orbit";
import { PERSONAL, savedOpen } from "../../sync/navPrefs";
import { RemindersList } from "./RemindersList";
import { SavedList } from "./SavedList";
type Tab = "saved" | "reminders";
/** Later (android Home › Later and Reminders): saved messages and reminders, the same on every device of the person. */
export function LaterView() {
  useLocaleRender();
  const l10n = useLocalization();
  const [tab, setTab] = useState<Tab>("saved");
  const saved = useOrbit((s) => savedOpen(s.nav[PERSONAL]).length);
  const overdue = useOrbit((s) => s.reminders.items.filter((r) => r.state === "fired").length);
  return (
    <section className="main" aria-label={l10n("workspace.nav_later")}>
      <div className="view scroll">
        <div className="view-inner" style={{ maxWidth: 760 }}>
          <div>
            <h1>{l10n("workspace.nav_later")}</h1>
            <p className="view-sub">
              <Localized k="workspace.interface.messages_you_saved_and_reminders_you_set_on_all_your_devices_fe690b5" />
            </p>
          </div>
          <div className="segmented" role="tablist" aria-label={l10n("workspace.nav_later")} style={{ justifySelf: "start" }}>
            <button role="tab" aria-selected={tab === "saved"} onClick={() => setTab("saved")}>
              <Localized k="workspace.interface.saved_54a9f8d" slots={[saved ? uiText("workspace.interface.value0_c9bd7bc", { value0: saved }) : ""]} />
            </button>
            <button role="tab" aria-selected={tab === "reminders"} onClick={() => setTab("reminders")}>
              <Localized k="workspace.interface.reminders_fd8be28" slots={[overdue ? uiText("workspace.interface.value0_overdue_35417f7", { value0: overdue }) : ""]} />
            </button>
          </div>
          <div role="tabpanel">{tab === "saved" ? <SavedList /> : <RemindersList />}</div>
        </div>
      </div>
    </section>
  );
}
