import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { useState } from "react";
import type { OrgAdminDetail } from "../../api/workspaceSchemas";
import { useEngine } from "../../application/orbit";
import { setGuestPolicy } from "../../sync/workspaceC5";
import { useAction } from "./useLoad";
import { Card, ErrorLine } from "./WorkspaceView";
/** Guests (android round 7 C5): allowed or not, and the longest a guest may stay. A shorter maximum brings end dates forward. */
export function GuestPolicyCard({ detail, onChanged }: { detail: OrgAdminDetail; onChanged: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const [allowed, setAllowed] = useState(detail.org.guestsAllowed);
  const [days, setDays] = useState(detail.org.guestMaxDays ? String(detail.org.guestMaxDays) : "");
  const act = useAction();
  const max = days.trim() ? Number(days) : null;
  const valid = max === null || (Number.isInteger(max) && max >= 1 && max <= 365);
  return (
    <Card title={uiText("workspace.interface.guests_3c8e0fd")} sub={uiText("workspace.interface.guests_see_only_the_channels_they_re_added_to_and_can_t_create_do_16e6719")}>
      <label className="row" style={{ gap: 8 }}>
        <input type="checkbox" checked={allowed} onChange={(e) => setAllowed(e.target.checked)} />
        <Localized k="workspace.interface.allow_guests_4dd7451" />
      </label>
      <label className="field">
        <span>
          <Localized k="workspace.interface.longest_a_guest_may_stay_days_34624c9" />
        </span>
        <input className="input" type="number" min={1} max={365} value={days} onChange={(e) => setDays(e.target.value)} placeholder={uiText("workspace.interface.no_limit_f7fcff0")} />
      </label>
      <small className="faint">
        <Localized k="workspace.interface.a_shorter_maximum_brings_current_guests_end_dates_forward_turning_34f02e5" />
      </small>
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
          {l10n("common.actions.save")}
        </button>
      </div>
    </Card>
  );
}
