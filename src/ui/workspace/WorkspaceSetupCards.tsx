import { useState } from "react";
import type { OrgAdminDetail } from "../../api/workspaceSchemas";
import { useEngine } from "../../app/orbit";
import { applyWorkspaceTemplate, setGuestPolicy, workspaceTemplates } from "../../sync/workspaceC5";
import { useAction, useLoad } from "./useLoad";
import { Card, ErrorLine } from "./WorkspaceView";

/**
 * Workspace templates (android round 7 C5): channels a kind of team usually needs and a welcome document. Applying one
 * adds only what's missing; it never adds people, apps or private channels. Owners and admins.
 */
export function TemplatesCard({ detail, onChanged }: { detail: OrgAdminDetail; onChanged: () => void }) {
  const engine = useEngine();
  const templates = useLoad(() => workspaceTemplates(engine), [engine]);
  const act = useAction();
  const [done, setDone] = useState<string | null>(null);
  return (
    <Card title="Workspace templates" sub="Add the channels a kind of team usually needs, and a welcome document. Only what's missing is added; running one again changes nothing.">
      <ErrorLine text={templates.error ?? act.error} />
      {done && (
        <p className="banner info" role="status" style={{ margin: 0 }}>
          {done}
        </p>
      )}
      <ul className="ws-list">
        {(templates.data ?? []).map((t) => (
          <li key={t.id} className="ws-row">
            <span className="lines grow">
              <strong>{t.name}</strong>
              <small>
                {t.description} {t.channels.map((c) => `#${c.name}`).join(", ")}
              </small>
            </span>
            <button
              className="btn btn-secondary btn-sm"
              disabled={act.busy}
              onClick={() =>
                void act.act(async () => {
                  const r = await applyWorkspaceTemplate(engine, detail.org.id, t.id);
                  const n = r.channels.length;
                  setDone(
                    n === 0 && !r.document ? `${t.name}: nothing to add, it's all here.` : `${t.name}: added ${n === 1 ? "1 channel" : `${n} channels`}${r.document ? " and a welcome document" : ""}.`,
                  );
                  await engine.refreshAll();
                  onChanged();
                })
              }
            >
              Add
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Guests (android round 7 C5): allowed or not, and the longest a guest may stay. A shorter maximum brings end dates forward. */
export function GuestPolicyCard({ detail, onChanged }: { detail: OrgAdminDetail; onChanged: () => void }) {
  const engine = useEngine();
  const [allowed, setAllowed] = useState(detail.org.guestsAllowed);
  const [days, setDays] = useState(detail.org.guestMaxDays ? String(detail.org.guestMaxDays) : "");
  const act = useAction();
  const max = days.trim() ? Number(days) : null;
  const valid = max === null || (Number.isInteger(max) && max >= 1 && max <= 365);
  return (
    <Card title="Guests" sub="Guests see only the channels they're added to and can't create documents or meetings.">
      <label className="row" style={{ gap: 8 }}>
        <input type="checkbox" checked={allowed} onChange={(e) => setAllowed(e.target.checked)} /> Allow guests
      </label>
      <label className="field">
        <span>Longest a guest may stay (days)</span>
        <input className="input" type="number" min={1} max={365} value={days} onChange={(e) => setDays(e.target.value)} placeholder="No limit" />
      </label>
      <small className="faint">A shorter maximum brings current guests' end dates forward. Turning guests off refuses new guest invitations but removes nobody.</small>
      <ErrorLine text={act.error} />
      <div>
        <button
          className="btn btn-primary btn-sm"
          disabled={!valid || act.busy}
          onClick={() =>
            void act.act(() =>
              setGuestPolicy(engine, detail.org.id, allowed, max)
                .then(() => engine.refreshAll())
                .then(onChanged),
            )
          }
        >
          Save
        </button>
      </div>
    </Card>
  );
}
