import { useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { navigate } from "../../application/router";
import { communityMutedUntil, levelOf, mutedUntil, workspaceOf } from "../../sync/navPrefs";
import { setNotificationsPaused } from "../../sync/status";
import { useAction } from "../workspace/useLoad";
import { CommunityNotificationsDialog, LEVEL_NAME } from "../community/NotifyDialogs";
import { conversationTitle } from "../format";
export function NotificationOverview() {
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
      <h2 className="settings-group">Notification overview</h2>
      <div className="card setting-card">
        <p className="hint">
          Account pause applies on every device. Conversation rules follow channel → category → community. A direct @mention can still notify in a muted conversation; account pause silences message
          notifications.
        </p>
        <strong>{pause && pause > now ? `Paused until ${new Date(pause).toLocaleString()}` : "Account notifications active"}</strong>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-secondary" disabled={action.busy} onClick={() => void action.act(() => setNotificationsPaused(engine, Date.now() + 3600000))}>
            Pause all for 1 hour
          </button>
          {pause && pause > now && (
            <button className="btn btn-secondary" disabled={action.busy} onClick={() => void action.act(() => setNotificationsPaused(engine, null))}>
              Resume all
            </button>
          )}
        </div>
        {action.error && <p role="alert">{action.error}</p>}
        {state.orgs.map((o) => (
          <button key={o.id} className="list-row" onClick={() => setOrgId(o.id)}>
            <span className="grow">{o.name}</span>
            <small>{communityMutedUntil(state.nav[o.id]) !== null ? "Temporarily muted" : LEVEL_NAME[state.nav[o.id]?.community?.level ?? "all"]}</small>
          </button>
        ))}
        <label className="field">
          <span>Find a conversation’s notification rules</span>
          <input className="input" type="search" aria-label="Find notification rules" value={q} maxLength={80} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div style={{ maxHeight: 340, overflow: "auto" }}>
          {rows.map((c) => {
            const prefs = state.nav[workspaceOf(c.orgId)];
            const own = prefs?.notify[c.id];
            const source =
              mutedUntil(prefs, c.id, now) !== null
                ? "Conversation pause"
                : communityMutedUntil(prefs, now) !== null
                  ? "Community pause"
                  : own !== undefined
                    ? "Conversation override"
                    : c.categoryId && prefs?.categoryNotify?.[c.categoryId]
                      ? "Category default"
                      : c.orgId
                        ? "Community default"
                        : "Default";
            return (
              <button key={c.id} className="list-row" onClick={() => navigate({ section: "activity", conversationId: c.id })}>
                <span className="lines grow">
                  <strong>{conversationTitle(c, state.me!.userId, state.users)}</strong>
                  <small>
                    {source}
                    {pause && pause > now ? " · Account paused" : ""}
                  </small>
                </span>
                <small>{LEVEL_NAME[levelOf(prefs, c.id, c.categoryId ?? null, now)]}</small>
              </button>
            );
          })}
        </div>
        {!rows.length && <p className="hint">No matching conversations.</p>}
      </div>
      {selected && <CommunityNotificationsDialog orgId={selected.id} name={selected.name} onClose={() => setOrgId(null)} />}
    </>
  );
}
