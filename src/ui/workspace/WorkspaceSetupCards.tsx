import { useState } from "react";
import type { OrgAdminDetail } from "../../api/workspaceSchemas";
import { useEngine } from "../../app/orbit";
import { setGuestPolicy } from "../../sync/workspaceC5";
import { useAction } from "./useLoad";
import { Card, ErrorLine } from "./WorkspaceView";

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
