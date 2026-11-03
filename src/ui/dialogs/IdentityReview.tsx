import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { ShieldAlert } from "lucide-react";
import { useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { Dialog } from "../components/Overlay";
/**
 * A contact's identity key changed (docs/SECURITY.md §3): messages with them stay paused until this is reviewed.
 * Continuing pins exactly the new key, sends what was paused and opens what was held; a later change asks again. (It
 * used to show a safety number to compare; safety numbers were retired in brief v4 §13, the pause was not.)
 */
export function IdentityReview({ userId, onClose }: { userId: string; onClose: () => void }) {
  useLocaleRender();
  const engine = useEngine();
  const name = useOrbit((s) => s.users[userId]?.displayName ?? uiText("workspace.interface.this_person_75a4906"));
  const alert = useOrbit((s) => s.identityAlerts.find((a) => a.userId === userId));
  const [busy, setBusy] = useState(false);
  if (!alert) return null;
  return (
    <Dialog
      title={uiText("workspace.interface.value0_s_security_key_changed_241b724", { value0: name })}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            <Localized k="workspace.interface.not_now_a0e63d7" />
          </button>
          <button
            className="btn btn-primary"
            disabled={busy || !alert.changedTo}
            onClick={() => {
              setBusy(true);
              void engine
                .acceptIdentity(userId)
                .then(onClose)
                .catch((e: unknown) => engine.notice("error", e instanceof Error ? e.message : uiText("workspace.interface.couldn_t_accept_the_key_acf6507")))
                .finally(() => setBusy(false));
            }}
          >
            <Localized k="workspace.interface.continue_with_the_new_key_9fbcc9a" />
          </button>
        </>
      }
    >
      <div className="dialog-body">
        <div className="banner warn">
          <ShieldAlert size={16} />
          <span className="grow">
            <Localized k="workspace.interface.messages_to_and_from_are_paused_this_happens_when_someone_reinsta_3847164" slots={[name]} />
          </span>
        </div>
        <p style={{ margin: 0 }}>
          <Localized k="workspace.interface.if_you_weren_t_expecting_this_ask_in_person_or_on_a_call_you_trus_43fbf4b" slots={[name]} />
        </p>
        <p className="faint" style={{ margin: 0, fontSize: 12.5 }}>
          <Localized k="workspace.interface.continuing_trusts_exactly_this_key_if_the_server_presents_yet_ano_4956aa6" />
        </p>
      </div>
    </Dialog>
  );
}
