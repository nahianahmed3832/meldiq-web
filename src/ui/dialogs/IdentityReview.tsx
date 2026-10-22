import { ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { safetyNumber } from "../../crypto/identity";
import { Dialog } from "../components/Overlay";

/**
 * A contact's identity key changed (docs/SECURITY.md §3). Shows the safety number for the new key; accepting pins exactly
 * that key, sends what was paused and opens what was held.
 */
export function IdentityReview({ userId, onClose }: { userId: string; onClose: () => void }) {
  const engine = useEngine();
  const me = useOrbit((s) => s.me);
  const name = useOrbit((s) => s.users[userId]?.displayName ?? "This person");
  const alert = useOrbit((s) => s.identityAlerts.find((a) => a.userId === userId));
  const [number, setNumber] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (me && alert?.changedTo) void safetyNumber(me.identityKey, alert.changedTo).then(setNumber);
  }, [me, alert]);

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
            disabled={busy || !number}
            onClick={() => {
              setBusy(true);
              void engine
                .acceptIdentity(userId)
                .then(onClose)
                .catch((e: unknown) => engine.notice("error", e instanceof Error ? e.message : "Couldn't accept the key"))
                .finally(() => setBusy(false));
            }}
          >
            I compared it: accept the new key
          </button>
        </>
      }
    >
      <div className="dialog-body">
        <div className="banner warn">
          <ShieldAlert size={16} />
          <span className="grow">Messages to and from {name} are paused. This happens when someone reinstalls Meldiq without their recovery key, and it's also what an attacker would cause.</span>
        </div>
        <p style={{ margin: 0 }}>Ask {name} to open your conversation on their phone and compare this safety number with theirs, in person or on a call you trust:</p>
        <span className="fingerprint" style={{ whiteSpace: "pre-line", fontSize: 16 }}>
          {number ?? "…"}
        </span>
        <p className="faint" style={{ margin: 0, fontSize: 12.5 }}>
          Accepting trusts exactly this key. If the server presents yet another key later, you'll be asked again.
        </p>
      </div>
    </Dialog>
  );
}
