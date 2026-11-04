import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { Check, Copy, UserRoundPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useEngine } from "../../application/orbit";
const zReferral = z.object({ available: z.boolean(), code: z.string(), invited: z.number(), daysEach: z.number() });
type Referral = z.infer<typeof zReferral>;
/** Your invite link to Meldiq itself: the web app's sign-up with your invite code (server docs/BILLING.md › invite links). */
export function inviteLink(origin: string, code: string | null): string {
  return code ? `${origin}/?ref=${encodeURIComponent(code)}` : `${origin}/`;
}
/**
 * Invite friends to Meldiq (the owner's request, 2026-10-28): on Home and messages, an invitation to the platform with
 * your own invite link; a community's invitations stay inside that community. Where the server runs trials, both of
 * you get the invite's free Meldiq Plus days, and the card says so.
 */
export function InviteToMeldiqCard() {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const account = !!engine.device.account;
  const [referral, setReferral] = useState<Referral | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!account) return;
    let live = true;
    void engine.api
      .json("GET", "/v2/billing/referral", zReferral)
      .then((r) => live && setReferral(r))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [engine, account]);
  const link = inviteLink(window.location.origin, referral?.code ?? null);
  const share = async () => {
    const text = uiText("workspace.interface.join_me_on_meldiq_4414540");
    try {
      if (navigator.share) {
        await navigator.share({ title: "Meldiq", text, url: link });
        return;
      }
    } catch {
      /* closed, or not allowed here: copy instead */
    }
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      engine.notice("error", uiText("workspace.interface.couldn_t_copy_the_link_copy_it_from_the_address_bar_instead_e5ceaf5"));
    }
  };
  const bonus = referral?.available && referral.daysEach > 0 ? uiText("workspace.interface.you_both_get_value0_days_of_meldiq_plus_free_5104535", { value0: referral.daysEach }) : null;
  return (
    <section className="invite-card" aria-labelledby="invite-card-title">
      <span className="invite-card-icon" aria-hidden="true">
        <UserRoundPlus size={18} />
      </span>
      <div className="invite-card-text">
        <strong id="invite-card-title">
          <Localized k="workspace.interface.invite_friends_to_meldiq_3f12646" />
        </strong>
        <small>
          {bonus ??
            (referral?.invited
              ? uiText("workspace.interface.value0_joined_with_your_link_09857cd", { value0: referral.invited })
              : uiText("workspace.interface.share_your_link_to_get_them_chatting_92cbfba"))}
        </small>
      </div>
      <button className="btn btn-primary btn-sm" onClick={() => void share()} aria-label={uiText("workspace.interface.share_your_meldiq_invite_link_fa7fe2f")}>
        {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />} {copied ? l10n("common.common_copied") : uiText("workspace.interface.invite_1fd9ae1")}
      </button>
    </section>
  );
}
