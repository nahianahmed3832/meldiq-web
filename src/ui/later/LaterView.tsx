import { useEngine, useOrbit } from "../../application/orbit";
import { useT } from "../../i18n";
import { formatUiNumber } from "../../i18n/format";
import { PERSONAL, savedOpen } from "../../sync/navPrefs";
import { ExperienceHeader } from "../experience/ExperienceHeader";
import { RemindersList } from "./RemindersList";
import { SavedList } from "./SavedList";
import { useLaterView } from "./useLaterView";

/** Synced saved messages and reminders; the view itself belongs to this account on this browser. */
export function LaterView({ onSearch }: { onSearch: () => void }) {
  const t = useT();
  const engine = useEngine();
  const remembered = useLaterView(engine.store);
  const saved = useOrbit((s) => savedOpen(s.nav[PERSONAL]).length);
  const overdue = useOrbit((s) => s.reminders.items.filter((r) => r.state === "fired").length);
  const view = remembered.view;
  const tabs = [
    { id: "saved" as const, label: t("workspace.experience.savedTab"), count: saved },
    { id: "reminders" as const, label: t("workspace.experience.remindersTab"), count: overdue },
  ];
  return (
    <section className="main later-view" aria-label={t("workspace.nav_later")}>
      <div className="view scroll">
        <div className="view-inner">
          <ExperienceHeader
            title={t("workspace.nav_later")}
            description={t("workspace.experience.laterIntro")}
            actions={
              <button
                className="btn btn-secondary"
                onClick={(event) => {
                  event.currentTarget.focus();
                  onSearch();
                }}
              >
                {t("workspace.interface.search_meldiq_7c5a6e1")}
              </button>
            }
          />
          {!view ? (
            <div className="saved-loading" role="status" aria-label={t("workspace.experience.loading")}>
              <div className="experience-skeleton" />
              <div className="experience-skeleton" />
            </div>
          ) : (
            <>
              <div className="later-navigation">
                <div className="segmented" role="tablist" aria-label={t("workspace.nav_later")}>
                  {tabs.map(({ id, label, count }, index) => (
                    <button
                      key={id}
                      id={`later-tab-${id}`}
                      role="tab"
                      aria-selected={view.tab === id}
                      aria-controls={`later-panel-${id}`}
                      tabIndex={view.tab === id ? 0 : -1}
                      onClick={() => remembered.update({ tab: id })}
                      onKeyDown={(event) => {
                        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                        event.preventDefault();
                        const next = event.key === "Home" ? 0 : event.key === "End" ? 1 : 1 - index;
                        remembered.update({ tab: tabs[next].id });
                        document.getElementById(`later-tab-${tabs[next].id}`)?.focus();
                      }}
                    >
                      {label}
                      {count > 0 && <span className="count">{formatUiNumber(count)}</span>}
                    </button>
                  ))}
                </div>
                <p className="later-view-status" role="status">
                  {t(
                    remembered.status === "saving"
                      ? "workspace.experience.rememberingView"
                      : remembered.status === "loadError" || remembered.status === "saveError"
                        ? "workspace.experience.viewNotRemembered"
                        : "workspace.experience.viewScope",
                  )}
                </p>
              </div>
              {(remembered.status === "loadError" || remembered.status === "saveError") && (
                <div className="banner danger" role="alert">
                  {t(remembered.status === "loadError" ? "workspace.experience.viewLoadError" : "workspace.experience.viewSaveError")}
                  <button className="btn btn-secondary btn-sm" onClick={remembered.retry}>
                    {t("workspace.experience.retry")}
                  </button>
                </div>
              )}
              <div id={`later-panel-${view.tab}`} role="tabpanel" aria-labelledby={`later-tab-${view.tab}`} tabIndex={0}>
                {view.tab === "saved" ? <SavedList view={view} onViewChange={remembered.update} onSearch={onSearch} /> : <RemindersList />}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
