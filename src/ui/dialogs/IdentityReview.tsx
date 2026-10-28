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
  const engine = useEngine();
  const name = useOrbit((s) => s.users[userId]?.displayName ?? "This person");
  const alert = useOrbit((s) => s.identityAlerts.find((a) => a.userId === userId));
  const [busy, setBusy] = useState(false);

  if (!alert) return null;
  return (
    <Dialog
      title={`${name}'s security key changed`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Not now
          </button>
          <button
            className="btn btn-primary"
            disabled={busy || !alert.changedTo}
            onClick={() => {
              setBusy(true);
              void engine
                .acceptIdentity(userId)
                .then(onClose)
                .catch((e: unknown) => engine.notice("error", e instanceof Error ? e.message : "Couldn't accept the key"))
                .finally(() => setBusy(false));
            }}
          >
            Continue with the new key
          </button>
        </>
      }
    >
      <div className="dialog-body">
        <div className="banner warn">
          <ShieldAlert size={16} />
          <span className="grow">Messages to and from {name} are paused. This happens when someone reinstalls Meldiq without their recovery key, and it's also what an attacker would cause.</span>
        </div>
        <p style={{ margin: 0 }}>If you weren't expecting this, ask {name} in person or on a call you trust whether they set Meldiq up again before you continue.</p>
        <p className="faint" style={{ margin: 0, fontSize: 12.5 }}>
          Continuing trusts exactly this key. If the server presents yet another key later, you'll be asked again.
        </p>
      </div>
    </Dialog>
  );
}
