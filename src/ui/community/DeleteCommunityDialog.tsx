import { useMemo, useState } from "react";
import { useEngine } from "../../application/orbit";
import { setPrefs } from "../../application/prefs";
import { navigate } from "../../application/router";
import { deleteWorkspace, requestId } from "../../sync/workspaces";
import { Dialog } from "../components/Overlay";
import { useAction } from "../workspace/useLoad";

interface DeleteCommunityDialogProps {
  orgId: string;
  name: string;
  onClose: () => void;
}

/**
 * Deleting a community (owners only, from Profile or the community menu), after typing its exact name. Removes channels,
 * roles and invitations for everyone; accounts, direct messages and groups stay.
 */
export function DeleteCommunityDialog({ orgId, name, onClose }: DeleteCommunityDialogProps) {
  const engine = useEngine();
  const reqId = useMemo(requestId, []);
  const [typed, setTyped] = useState("");
  const del = useAction();
  return (
    <Dialog title={`Delete ${name}?`} onClose={onClose}>
      <div className="dialog-body">
        <div className="banner danger">This deletes the community's channels and their messages and files, its roles and invitations, for every member. It can't be undone.</div>
        <p style={{ margin: 0 }}>People's accounts, direct messages and groups stay. Type the community's name to confirm.</p>
        <input className="input" data-autofocus value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Community name" placeholder={name} />
        {del.error && (
          <div className="banner danger" role="alert">
            {del.error}
          </div>
        )}
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-danger"
            disabled={typed !== name || del.busy}
            onClick={() =>
              void del.act(async () => {
                await deleteWorkspace(engine, orgId, typed, reqId);
                onClose();
                setPrefs({ orgId: null });
                navigate({ section: "home" });
              })
            }
          >
            {del.busy ? "Deleting…" : "Delete community"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
