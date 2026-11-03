import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
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
  useLocaleRender();
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
      <CopyRow label={uiText("workspace.interface.invitation_link_88c3be3")} link={code.data ? inviteLink(code.data) : ""} />
      {slug && <CopyRow label={uiText("files.interface.custom_invite_link_6c09fd6")} link={inviteLink(slug)} />}
      <small className="faint">
        <Localized k="workspace.interface.your_invite_link_never_expires_b64801a" />
      </small>
    </div>
  );
}
function CopyRow({ label, link }: { label: string; link: string }) {
  useLocaleRender();
  const l10n = useLocalization();
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
      <input className="input mono" readOnly value={link} placeholder={uiText("workspace.interface.making_your_link_cb9ae30")} aria-label={label} onFocus={(e) => e.currentTarget.select()} />
      <button className="btn btn-primary" onClick={copy} disabled={!link} aria-label={uiText("workspace.interface.copy_value0_8d6cc3e", { value0: label.toLowerCase() })}>
        {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? l10n("common.common_copied") : l10n("common.actions.copy")}
      </button>
    </div>
  );
}
