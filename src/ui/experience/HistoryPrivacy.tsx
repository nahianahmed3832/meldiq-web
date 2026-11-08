import { useEngine } from "../../application/orbit";
import { updateHistory } from "../../application/personalHistory";
import { useT } from "../../i18n";
import { openSpark } from "../../application/experienceNavigation";
import { useAction } from "../workspace/useLoad";
import { usePersonalHistory } from "./usePersonalHistory";

export function HistoryPrivacy() {
  const { store, device } = useEngine();
  const t = useT();
  const loaded = usePersonalHistory(store);
  const action = useAction();
  const data = loaded.data;
  return (
    <section className="card experience-panel" aria-busy={!data && loaded.loading}>
      <h2>{t("workspace.experience.historyPrivacy")}</h2>
      <p className="muted">{t("workspace.experience.historyPrivacyHelp")}</p>
      {!data && loaded.loading && <div className="experience-skeleton" />}
      {(loaded.error || action.error) && (
        <p className="banner danger" role="alert">
          {loaded.error ?? action.error}{" "}
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              action.clear();
              loaded.reload();
            }}
          >
            {t("workspace.experience.retry")}
          </button>
        </p>
      )}
      {data && (
        <>
          <label className="spark-consent">
            <input
              type="checkbox"
              checked={data.activityOn}
              disabled={action.busy}
              onChange={(e) => {
                const enabled = e.target.checked;
                void action.act(() => updateHistory(store, { type: "activity", enabled }));
              }}
            />
            {t("workspace.experience.activityPreference")}
          </label>
          <label className="spark-consent">
            <input
              type="checkbox"
              checked={data.searchOn}
              disabled={action.busy}
              onChange={(e) => {
                const enabled = e.target.checked;
                void action.act(() => updateHistory(store, { type: "search", enabled }));
              }}
            />
            {t("workspace.experience.searchPreference")}
          </label>
          <div className="experience-controls">
            <button className="btn btn-secondary btn-sm" disabled={action.busy || !data.visits.length} onClick={() => void action.act(() => updateHistory(store, { type: "clearActivity" }))}>
              {t("workspace.experience.clearActivity")}
            </button>
            <button className="btn btn-secondary btn-sm" disabled={action.busy || !data.searches.length} onClick={() => void action.act(() => updateHistory(store, { type: "clearSearch" }))}>
              {t("workspace.experience.clearSearch")}
            </button>
          </div>
        </>
      )}
      <p className="muted">{t("workspace.experience.serverPrivacy")}</p>
      <div className="experience-controls">
        <button className="btn btn-secondary btn-sm" onClick={openSpark}>
          {t("workspace.experience.manageSpark")}
        </button>
        {device.account && (
          <a className="btn btn-secondary btn-sm" href="/settings/account">
            {t("workspace.experience.manageAccountData")}
          </a>
        )}
      </div>
    </section>
  );
}
