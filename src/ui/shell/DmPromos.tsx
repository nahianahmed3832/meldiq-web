import { Check, Copy, Sparkles, UserRoundPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useEngine, useOrbit } from "../../application/orbit";
import { navigate } from "../../application/router";

const zReferral = z.object({ available: z.boolean(), code: z.string(), invited: z.number(), daysEach: z.number() });
type Referral = z.infer<typeof zReferral>;

/** Your invite link to Meldiq itself: the web app's sign-up with your invite code (server docs/BILLING.md › invite links). */
export function inviteLink(origin: string, code: string | null): string {
  return code ? `${origin}/?ref=${encodeURIComponent(code)}` : `${origin}/`;
}

/**
 * Invite friends to Meldiq (the owner's request, 2026-10-28): on Home and messages, an invitation to the platform with
 * your own invite link; a community's invitations stay inside that community. Where the server runs trials, both of
 * you get the invite's free Mojo days, and the card says so.
 */
export function InviteToMeldiqCard() {
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
    const text = "Join me on Meldiq";
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
      engine.notice("error", "Couldn't copy the link. Copy it from the address bar instead.");
    }
  };
  const bonus = referral?.available && referral.daysEach > 0 ? `You both get ${referral.daysEach} days of Mojo free.` : null;
  return (
    <section className="invite-card" aria-labelledby="invite-card-title">
      <span className="invite-card-icon" aria-hidden="true">
        <UserRoundPlus size={18} />
      </span>
      <div className="invite-card-text">
        <strong id="invite-card-title">Invite friends to Meldiq</strong>
        <small>{bonus ?? (referral?.invited ? `${referral.invited} joined with your link` : "Share your link to get them chatting")}</small>
      </div>
      <button className="btn btn-primary btn-sm" onClick={() => void share()} aria-label="Share your Meldiq invite link">
        {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />} {copied ? "Copied" : "Invite"}
      </button>
    </section>
  );
}

/** Meldiq Mojo in the messages list: what it adds, for the Free plan; your plan, for subscribers. */
export function MojoPromoCard() {
  const plan = useOrbit((s) => s.mojo.me?.plan ?? null);
  const name = useOrbit((s) => s.mojo.me?.perks.name ?? null);
  const enabled = useOrbit((s) => s.server?.features.includes("mojo") ?? false);
  if (!enabled) return null;
  const free = plan === null || plan === "free";
  return (
    <button className="mojo-promo" onClick={() => navigate({ section: "settings", settingsPage: "mojo" })}>
      <span className="mojo-perk-icon" aria-hidden="true">
        <Sparkles size={18} />
      </span>
      <span className="lines grow">
        <strong>{free ? "Get Meldiq Mojo" : `You have ${name ?? "Mojo"}`}</strong>
        <small>{free ? "Bigger files, sharper streams and Sparks for your servers." : "Thanks for keeping Meldiq going. See your perks."}</small>
      </span>
    </button>
  );
}
