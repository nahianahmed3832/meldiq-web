import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
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
  useLocaleRender();
  const [open, setOpen] = useState(false);
  if (!detail.permissions.canTransferOwnership) return null;
  return (
    <Card title={uiText("workspace.interface.ownership_c7d3acc")} sub={uiText("workspace.interface.hand_this_community_to_another_member_they_become_the_owner_and_y_6f7eefa")}>
      <button className="btn btn-secondary btn-sm" style={{ justifySelf: "start" }} onClick={() => setOpen(true)}>
        <Localized k="workspace.interface.transfer_ownership_bfb5554" slots={[<Crown size={14} />]} />
      </button>
      {open && <TransferDialog detail={detail} onDone={onChanged} onClose={() => setOpen(false)} />}
    </Card>
  );
}
function TransferDialog({ detail, onDone, onClose }: { detail: OrgAdminDetail; onDone: () => void; onClose: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const [q, setQ] = useState("");
  const [to, setTo] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [typed, setTyped] = useState("");
  const people = useLoad(() => directory(engine, detail.org.id, q), [engine, detail.org.id, q]);
  const act = useAction();
  const candidates = (people.data ?? []).filter((p) => p.orgRole !== "OWNER" && p.orgRole !== "GUEST" && p.id !== engine.device.userId).slice(0, 8);
  const matches = typed.trim() === detail.org.name.trim();
  return (
    <Dialog
      title={uiText("workspace.interface.transfer_ownership_3667f93")}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            {l10n("common.actions.cancel")}
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
            <Localized k="workspace.interface.transfer_dde8bef" />
          </button>
        </>
      }
    >
      <div className="dialog-body">
        <ErrorLine text={act.error} />
        {to ? (
          <div className="row" style={{ gap: 8 }}>
            <span className="grow">
              <Localized k="workspace.interface.new_owner_a732d96" slots={[<strong>{to.name}</strong>]} />
            </span>
            <button className="btn btn-ghost btn-sm" onClick={() => setTo(null)}>
              <Localized k="workspace.interface.change_c0bf75b" />
            </button>
          </div>
        ) : (
          <>
            <input
              className="input"
              placeholder={uiText("workspace.interface.search_members_6497fc6")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label={uiText("workspace.interface.search_members_6497fc6")}
              autoFocus
            />
            <ul className="ws-list">
              {candidates.map((p) => (
                <li key={p.id} className="ws-row">
                  <span className="lines grow">
                    <span>{p.displayName}</span>
                    <small>@{p.username}</small>
                  </span>
                  <button className="btn btn-secondary btn-sm" onClick={() => setTo({ id: p.id, name: p.displayName })}>
                    <Localized k="workspace.interface.choose_c7f9378" />
                  </button>
                </li>
              ))}
              {people.data && candidates.length === 0 && (
                <li className="faint">
                  <Localized k="workspace.interface.no_members_found_guests_must_be_made_members_first_d0d06eb" />
                </li>
              )}
            </ul>
          </>
        )}
        <label className="field">
          <span>
            <Localized k="workspace.interface.type_the_community_s_name_to_confirm_80a874d" />
          </span>
          <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={detail.org.name} />
        </label>
      </div>
    </Dialog>
  );
}
