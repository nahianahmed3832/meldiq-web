import { useState } from "react";
import { useEngine } from "../../application/orbit";
import { text as t } from "../../i18n";
import { rolesOverview } from "../../sync/roles";
import { bulkRoleMembers } from "../../sync/workspaces";
import { Dialog } from "../components/Overlay";
import { ErrorLine } from "../components/SettingsCard";
import { useAction, useLoad } from "./useLoad";
export function BulkMemberRoles({ orgId, userIds, onClose, onSaved }: { orgId: string; userIds: string[]; onClose: () => void; onSaved: () => void }) {
  const engine = useEngine(),
    roles = useLoad(() => rolesOverview(engine, orgId), [engine, orgId]),
    act = useAction();
  const [roleId, setRoleId] = useState(""),
    [add, setAdd] = useState(true);
  return (
    <Dialog
      title={t("workspace.part3.bulkRoles")}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" disabled={act.busy} onClick={onClose}>
            {t("common.actions.cancel")}
          </button>
          <button
            className="btn btn-primary"
            disabled={!roleId || act.busy || !roles.data?.me.canAssign}
            onClick={() =>
              void act.act(async () => {
                await bulkRoleMembers(engine, roleId, userIds, add);
                onSaved();
                onClose();
              })
            }
          >
            {t("common.actions.save")}
          </button>
        </>
      }
    >
      <div className="dialog-body">
        <p>{t("workspace.part3.selectionScope")}</p>
        <ul>
          {userIds.map((id) => (
            <li className="mono" key={id}>
              {id}
            </li>
          ))}
        </ul>
        <ErrorLine text={roles.error ?? act.error} />
        <label className="field">
          <span>{t("messaging.interface.role_14736a2")}</span>
          <select className="input" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
            <option value="">—</option>
            {roles.data?.roles
              .filter((r) => !r.archived)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
          </select>
        </label>
        <div className="segmented" role="group" aria-label={t("workspace.part3.bulkRoles")}>
          <button aria-pressed={add} onClick={() => setAdd(true)}>
            {t("common.actions.add")}
          </button>
          <button aria-pressed={!add} onClick={() => setAdd(false)}>
            {t("common.actions.remove")}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
