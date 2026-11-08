import { useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { updateHistory } from "../../application/personalHistory";
import { navigate } from "../../application/router";
import { useT } from "../../i18n";
import { formatDate } from "../../i18n/format";
import { conversationTitle } from "../format";
import { useAction } from "../workspace/useLoad";
import { usePersonalHistory } from "./usePersonalHistory";

export function RecentActivity({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const engine = useEngine();
  const loaded = usePersonalHistory(engine.store);
  const act = useAction();
  const conversations = useOrbit((s) => s.conversations);
  const me = useOrbit((s) => s.me);
  const users = useOrbit((s) => s.users);
  const [kind, setKind] = useState("all");
  const [limit, setLimit] = useState(15);
  const data = loaded.data;
  if (compact && !data?.visits.length) return null;
  const rows = (data?.visits ?? []).flatMap(({ id, at }) => {
    const c = conversations[id];
    if (!c || !me || (kind !== "all" && c.type !== kind)) return [];
    return [{ id, at, c, title: conversationTitle(c, me.userId, users) }];
  });
  if (compact && !rows.length) return null;
  return (
    <section className="card experience-panel" aria-busy={loaded.loading && !data}>
      <h2>{t("workspace.experience.continue")}</h2>
      {!compact && <p className="muted">{t("workspace.experience.activityHelp")}</p>}
      {!compact && data?.activityOn && (
        <div className="experience-controls">
          <label>
            {t("messaging.interface.show_0df6f1c")}
            <select
              className="input input-sm"
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                setLimit(15);
              }}
            >
              <option value="all">{t("settings.ap_all")}</option>
              <option value="DM">{t("workspace.experience.direct")}</option>
              <option value="GROUP">{t("workspace.interface.groups_39bbb71")}</option>
              <option value="CHANNEL">{t("organization.channels")}</option>
            </select>
          </label>
          <button className="btn btn-secondary btn-sm" disabled={!data.visits.length || act.busy} onClick={() => void act.act(() => updateHistory(engine.store, { type: "clearActivity" }))}>
            {t("workspace.experience.clearActivity")}
          </button>
        </div>
      )}
      {loaded.loading && !data && <div className="experience-skeleton" />}
      {(loaded.error || act.error) && (
        <div className="banner danger" role="alert">
          {loaded.error ?? act.error}{" "}
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              act.clear();
              loaded.reload();
            }}
          >
            {t("workspace.experience.retry")}
          </button>
        </div>
      )}
      {!compact && data && !data.activityOn && (
        <button className="btn btn-secondary btn-sm" disabled={act.busy} onClick={() => void act.act(() => updateHistory(engine.store, { type: "activity", enabled: true }))}>
          {t("workspace.experience.enableActivity")}
        </button>
      )}
      {data?.activityOn && rows.length === 0 && <p className="muted">{t("workspace.experience.noVisits")}</p>}
      {rows.slice(0, compact ? 3 : limit).map(({ id, at, title, c }) => (
        <div className="experience-list-row" key={id}>
          <button className="list-row" onClick={() => navigate({ section: c.type === "CHANNEL" ? "home" : "dms", conversationId: id })}>
            <span className="lines grow">
              <strong className="ellipsis">{title}</strong>
              <time dateTime={new Date(at).toISOString()}>{formatDate(at, { dateStyle: "medium", timeStyle: "short" })}</time>
            </span>
          </button>
          {!compact && (
            <button className="btn btn-ghost btn-sm" disabled={act.busy} onClick={() => void act.act(() => updateHistory(engine.store, { type: "removeVisit", id }))}>
              {t("common.actions.remove")}
            </button>
          )}
        </div>
      ))}
      {!compact && rows.length > limit && (
        <button className="btn btn-secondary btn-sm" onClick={() => setLimit(limit + 15)}>
          {t("workspace.discover_more")}
        </button>
      )}
      {compact && <a href="/activity">{t("workspace.activity")}</a>}
    </section>
  );
}
