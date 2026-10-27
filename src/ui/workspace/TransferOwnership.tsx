import { Crown } from "lucide-react";
import { useState } from "react";
import type { OrgAdminDetail } from "../../api/workspaceSchemas";
import { useEngine } from "../../application/orbit";
import { transferOwnership } from "../../sync/roles";
import { directory } from "../../sync/workspaces";
import { Dialog } from "../components/Overlay";
import { useAction, useLoad } from "./useLoad";
import { Card, ErrorLine } from "./WorkspaceView";

/**
 * Handing the workspace to someone else (server docs/WORKSPACE_ROLES.md §3, owners only): a member (not a guest) becomes
 * the owner after you type the workspace's exact name; you become an admin. The server checks all of it again.
 */
export function TransferOwnership({ detail, onChanged }: { detail: OrgAdminDetail; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  if (!detail.permissions.canTransferOwnership) return null;
  return (
    <Card title="Ownership" sub="Hand this community to another member. They become the owner and you become an admin.">
      <button className="btn btn-secondary btn-sm" style={{ justifySelf: "start" }} onClick={() => setOpen(true)}>
        <Crown size={14} /> Transfer ownership…
      </button>
      {open && <TransferDialog detail={detail} onDone={onChanged} onClose={() => setOpen(false)} />}
    </Card>
  );
}

function TransferDialog({ detail, onDone, onClose }: { detail: OrgAdminDetail; onDone: () => void; onClose: () => void }) {
  const engine = useEngine();
  const [q, setQ] = useState("");
  const [to, setTo] = useState<{ id: string; name: string } | null>(null);
  const [typed, setTyped] = useState("");
  const people = useLoad(() => directory(engine, detail.org.id, q), [engine, detail.org.id, q]);
  const act = useAction();
  const candidates = (people.data ?? []).filter((p) => p.orgRole !== "OWNER" && p.orgRole !== "GUEST" && p.id !== engine.device.userId).slice(0, 8);
  const matches = typed.trim() === detail.org.name.trim();
  return (
    <Dialog
      title="Transfer ownership"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-danger"
            disabled={!to || !matches || act.busy}
            onClick={() =>
              void act.act(async () => {
                await transferOwnership(engine, detail.org.id, to!.id, typed);
                onDone();
                onClose();
              })
            }
          >
            Transfer
          </button>
        </>
      }
    >
      <div className="dialog-body">
        <ErrorLine text={act.error} />
        {to ? (
          <div className="row" style={{ gap: 8 }}>
            <span className="grow">
              New owner: <strong>{to.name}</strong>
            </span>
            <button className="btn btn-ghost btn-sm" onClick={() => setTo(null)}>
              Change
            </button>
          </div>
        ) : (
          <>
            <input className="input" placeholder="Search members" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search members" autoFocus />
            <ul className="ws-list">
              {candidates.map((p) => (
                <li key={p.id} className="ws-row">
                  <span className="lines grow">
                    <span>{p.displayName}</span>
                    <small>@{p.username}</small>
                  </span>
                  <button className="btn btn-secondary btn-sm" onClick={() => setTo({ id: p.id, name: p.displayName })}>
                    Choose
                  </button>
                </li>
              ))}
              {people.data && candidates.length === 0 && <li className="faint">No members found (guests must be made members first).</li>}
            </ul>
          </>
        )}
        <label className="field">
          <span>Type the community's name to confirm</span>
          <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={detail.org.name} />
        </label>
      </div>
    </Dialog>
  );
}
