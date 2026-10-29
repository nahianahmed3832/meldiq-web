import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { standardInvite } from "../../sync/communitySettings";
import { inviteLink } from "../../sync/inviteCodes";
import { useLoad } from "./useLoad";

/**
 * The invite dialog's link (community parity A3, the reference's "send a server invite link"): this person's standard
 * link, which never expires and is the same every time, and the community's custom link when it has one.
 */
export function StandardInvite({ orgId }: { orgId: string }) {
  const engine = useEngine();
  const slug = useOrbit((s) => s.orgs.find((o) => o.id === orgId)?.inviteSlug ?? null);
  const code = useLoad(() => standardInvite(engine, orgId), [engine, orgId]);
  return (
    <div className="quick-invite" aria-live="polite">
      {code.error && (
        <div className="banner danger" role="alert">
          {code.error}
        </div>
      )}
      <CopyRow label="Invitation link" link={code.data ? inviteLink(code.data) : ""} />
      {slug && <CopyRow label="Custom invite link" link={inviteLink(slug)} />}
      <small className="faint">Your invite link never expires.</small>
    </div>
  );
}

function CopyRow({ label, link }: { label: string; link: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () =>
    void navigator.clipboard?.writeText(link).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => undefined,
    );
  return (
    <div className="invite-link-row">
      <input className="input mono" readOnly value={link} placeholder="Making your link…" aria-label={label} onFocus={(e) => e.currentTarget.select()} />
      <button className="btn btn-primary" onClick={copy} disabled={!link} aria-label={`Copy ${label.toLowerCase()}`}>
        {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
