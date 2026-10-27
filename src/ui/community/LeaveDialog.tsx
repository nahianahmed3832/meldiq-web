import { LogOut } from "lucide-react";
import { useState } from "react";
import { ApiError } from "../../api/client";
import { useEngine } from "../../application/orbit";
import { navigate } from "../../application/router";
import { leaveWorkspace } from "../../sync/workspaces";
import { Dialog } from "../components/Overlay";

/** Leaving a community (its menu's Leave community), with the reason when the server refuses. */
export function LeaveDialog({ orgId, name, onClose }: { orgId: string; name: string; onClose: () => void }) {
  const engine = useEngine();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog title={`Leave ${name}?`} onClose={onClose}>
      <div className="dialog-body">
        <p style={{ margin: 0 }}>You'll leave all its channels. You can come back with a new invitation, or from Discover if it's open.</p>
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-danger"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              leaveWorkspace(engine, orgId)
                .then(() => {
                  engine.notice("info", `You left ${name}.`);
                  onClose();
                  navigate({ section: "home" }, true);
                })
                .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Couldn't leave the community."))
                .finally(() => setBusy(false));
            }}
          >
            <LogOut size={15} /> Leave community
          </button>
        </div>
      </div>
    </Dialog>
  );
}
