import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { useState } from "react";
import { useEngine } from "../../application/orbit";
import { type EveryoneDefaults, type RolesOverview, setEveryone } from "../../sync/roles";
import { Dialog } from "../components/Overlay";
import { PermissionChecklist } from "./RolePermissionsTab";
import { useAction } from "./useLoad";
import { ErrorLine } from "./WorkspaceView";
interface EveryoneDialogProps {
  orgId: string;
  overview: RolesOverview;
  everyone: EveryoneDefaults;
  onSaved: () => void;
  onClose: () => void;
}
/**
 * Default permissions (@everyone, community parity A1): what every member holds before any role. Only everyday
 * permissions can go here (administrative ones come from roles), and only the ones this person holds may change.
 */
export function EveryoneDialog({ orgId, overview, everyone, onSaved, onClose }: EveryoneDialogProps) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const [grants, setGrants] = useState<ReadonlySet<string>>(new Set(everyone.permissions));
  const act = useAction();
  const allowed = new Set(everyone.allowed);
  const catalog = overview.catalog.filter((p) => allowed.has(p.key));
  const holds = (key: string) => overview.me.base === "OWNER" || overview.me.permissions.includes(key);
  const editable = overview.me.canManage;
  const toggle = (key: string, on: boolean) => {
    const next = new Set(grants);
    if (on) next.add(key);
    else next.delete(key);
    setGrants(next);
  };
  return (
    <Dialog
      title={uiText("workspace.interface.default_permissions_everyone_c26337c")}
      onClose={onClose}
      wide
      footer={
        <>
          {editable && (
            <button className="btn btn-ghost" disabled={act.busy} onClick={() => setGrants(new Set(everyone.standard))}>
              <Localized k="workspace.interface.reset_to_meldiq_s_defaults_7f90998" />
            </button>
          )}
          <span className="grow" />
          <button className="btn btn-secondary" onClick={onClose}>
            {editable ? l10n("common.actions.cancel") : l10n("common.actions.close")}
          </button>
          {editable && (
            <button
              className="btn btn-primary"
              disabled={act.busy}
              onClick={() =>
                void act.act(async () => {
                  await setEveryone(engine, orgId, [...grants]);
                  onSaved();
                  onClose();
                })
              }
            >
              {act.busy ? l10n("common.common_saving") : l10n("common.actions.save")}
            </button>
          )}
        </>
      }
    >
      <div className="dialog-body">
        <p className="muted" style={{ margin: 0 }}>
          <Localized k="workspace.interface.every_member_has_these_whatever_their_roles_roles_add_to_them_a_c_4fb0f2a" />
        </p>
        <ErrorLine text={act.error} />
        <PermissionChecklist catalog={catalog} grants={grants} canChange={(p) => editable && holds(p.key)} onGrant={toggle} />
      </div>
    </Dialog>
  );
}
