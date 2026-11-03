import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { interfaceLocale } from "../../i18n/format";
import { useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { navigate } from "../../application/router";
import { communityMutedUntil, levelOf, mutedUntil, workspaceOf } from "../../sync/navPrefs";
import { setNotificationsPaused } from "../../sync/status";
import { useAction } from "../workspace/useLoad";
import { CommunityNotificationsDialog, LEVEL_NAME } from "../community/NotifyDialogs";
import { conversationTitle } from "../format";
export function NotificationOverview() {
  useLocaleRender();
  const engine = useEngine();
  const state = useOrbit((s) => s);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const action = useAction();
  const now = Date.now();
  const pause = state.me?.notificationsPausedUntil;
  const rows = Object.values(state.conversations)
    .filter((c) => state.me && conversationTitle(c, state.me.userId, state.users).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.id.localeCompare(b.id));
  const selected = state.orgs.find((o) => o.id === orgId);
  return (
    <>
      <h2 className="settings-group">
        <Localized k="settings.interface.notification_overview_75e4009" />
      </h2>
      <div className="card setting-card">
        <p className="hint">
          <Localized k="settings.interface.account_pause_applies_on_every_device_conversation_rules_follow_c_97ce391" />
        </p>
        <strong>
          {pause && pause > now
            ? uiText("settings.interface.paused_until_value0_b11a5f5", { value0: new Date(pause).toLocaleString(interfaceLocale()) })
            : uiText("settings.interface.account_notifications_active_eb04852")}
        </strong>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-secondary" disabled={action.busy} onClick={() => void action.act(() => setNotificationsPaused(engine, Date.now() + 3600000))}>
            <Localized k="settings.interface.pause_all_for_1_hour_4a012f4" />
          </button>
          {pause && pause > now && (
            <button className="btn btn-secondary" disabled={action.busy} onClick={() => void action.act(() => setNotificationsPaused(engine, null))}>
              <Localized k="settings.interface.resume_all_43e673c" />
            </button>
          )}
        </div>
        {action.error && <p role="alert">{action.error}</p>}
        {state.orgs.map((o) => (
          <button key={o.id} className="list-row" onClick={() => setOrgId(o.id)}>
            <span className="grow">{o.name}</span>
            <small>{communityMutedUntil(state.nav[o.id]) !== null ? uiText("settings.interface.temporarily_muted_c438c05") : LEVEL_NAME[state.nav[o.id]?.community?.level ?? "all"]}</small>
          </button>
        ))}
        <label className="field">
          <span>
            <Localized k="settings.interface.find_a_conversation_s_notification_rules_9dace68" />
          </span>
          <input className="input" type="search" aria-label={uiText("settings.interface.find_notification_rules_e008cee")} value={q} maxLength={80} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div style={{ maxHeight: 340, overflow: "auto" }}>
          {rows.map((c) => {
            const prefs = state.nav[workspaceOf(c.orgId)];
            const own = prefs?.notify[c.id];
            const source =
              mutedUntil(prefs, c.id, now) !== null
                ? uiText("settings.interface.conversation_pause_fa8f8ac")
                : communityMutedUntil(prefs, now) !== null
                  ? uiText("settings.interface.community_pause_14dd195")
                  : own !== undefined
                    ? uiText("settings.interface.conversation_override_f350fce")
                    : c.categoryId && prefs?.categoryNotify?.[c.categoryId]
                      ? uiText("settings.interface.category_default_1e05916")
                      : c.orgId
                        ? uiText("settings.interface.community_default_2f70fd8")
                        : uiText("settings.ap_default");
            return (
              <button key={c.id} className="list-row" onClick={() => navigate({ section: "activity", conversationId: c.id })}>
                <span className="lines grow">
                  <strong>{conversationTitle(c, state.me!.userId, state.users)}</strong>
                  <small>
                    {source}
                    {pause && pause > now ? uiText("settings.interface.account_paused_e751ded") : ""}
                  </small>
                </span>
                <small>{LEVEL_NAME[levelOf(prefs, c.id, c.categoryId ?? null, now)]}</small>
              </button>
            );
          })}
        </div>
        {!rows.length && (
          <p className="hint">
            <Localized k="settings.interface.no_matching_conversations_d478832" />
          </p>
        )}
      </div>
      {selected && <CommunityNotificationsDialog orgId={selected.id} name={selected.name} onClose={() => setOrgId(null)} />}
    </>
  );
}
