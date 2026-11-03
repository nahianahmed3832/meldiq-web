import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
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
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const reqId = useMemo(requestId, []);
  const [typed, setTyped] = useState("");
  const del = useAction();
  return (
    <Dialog title={uiText("organization.interface.delete_value0_3d83de3", { value0: name })} onClose={onClose}>
      <div className="dialog-body">
        <div className="banner danger">
          <Localized k="organization.interface.this_deletes_the_community_s_channels_and_their_messages_and_file_420b89e" />
        </div>
        <p style={{ margin: 0 }}>
          <Localized k="organization.interface.people_s_accounts_direct_messages_and_groups_stay_type_the_commun_6ee685d" />
        </p>
        <input className="input" data-autofocus value={typed} onChange={(e) => setTyped(e.target.value)} aria-label={uiText("organization.interface.community_name_0565934")} placeholder={name} />
        {del.error && (
          <div className="banner danger" role="alert">
            {del.error}
          </div>
        )}
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button className="btn btn-secondary" onClick={onClose}>
            {l10n("common.actions.cancel")}
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
            {del.busy ? uiText("organization.interface.deleting_43b5894") : uiText("organization.interface.delete_community_755eaba")}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
