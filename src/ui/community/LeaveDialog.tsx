import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { LogOut } from "lucide-react";
import { useState } from "react";
import { ApiError } from "../../api/client";
import { useEngine } from "../../application/orbit";
import { navigate } from "../../application/router";
import { leaveWorkspace } from "../../sync/workspaces";
import { Dialog } from "../components/Overlay";
/** Leaving a community (its menu's Leave community), with the reason when the server refuses. */
export function LeaveDialog({ orgId, name, onClose }: { orgId: string; name: string; onClose: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog title={uiText("organization.interface.leave_value0_9c1e1f8", { value0: name })} onClose={onClose}>
      <div className="dialog-body">
        <p style={{ margin: 0 }}>
          <Localized k="organization.interface.you_ll_leave_all_its_channels_you_can_come_back_with_a_new_invita_94605f6" />
        </p>
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button className="btn btn-secondary" onClick={onClose}>
            {l10n("common.actions.cancel")}
          </button>
          <button
            className="btn btn-danger"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              leaveWorkspace(engine, orgId)
                .then(() => {
                  engine.notice("info", uiText("organization.interface.you_left_value0_5513c34", { value0: name }));
                  onClose();
                  navigate({ section: "home" }, true);
                })
                .catch((e: unknown) => setError(e instanceof ApiError ? e.message : uiText("organization.interface.couldn_t_leave_the_community_ea05103")))
                .finally(() => setBusy(false));
            }}
          >
            <Localized k="organization.interface.leave_community_6187cbc" slots={[<LogOut size={15} />]} />
          </button>
        </div>
      </div>
    </Dialog>
  );
}
