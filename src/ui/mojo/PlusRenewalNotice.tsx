import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { useEngine, useOrbit } from "../../application/orbit";
import { navigate, useRoute } from "../../application/router";
import { communicationBusy } from "../../application/updates";
import { transfersOf } from "../../sync/transfers";
import { money } from "./mojoFormat";

const response = z.object({
  notice: z
    .object({ id: z.string(), autoRenew: z.boolean(), endsAt: z.number(), amountMinor: z.number().nullable(), currency: z.string().nullable(), months: z.number().nullable(), expiresAt: z.number() })
    .nullable(),
});
type Notice = NonNullable<z.infer<typeof response>["notice"]>;
/** Billing information, distinct from Free-to-Plus campaigns. Never asks an auto-renewing subscriber to buy twice. */
export function PlusRenewalNotice({ blocked }: { blocked: boolean }) {
  const engine = useEngine(),
    route = useRoute();
  const ready = useOrbit((s) => s.phase === "ready" && s.synced && s.connection === "online" && s.mojo.me?.plan === "plus");
  const calling = useOrbit((s) => s.call.phase !== "idle" && s.call.phase !== "ended");
  const paused = useOrbit((s) => (s.me?.notificationsPausedUntil ?? 0) > Date.now());
  const notices = useOrbit((s) => s.notices.length > 0);
  const [notice, setNotice] = useState<Notice | null>(null);
  const shown = useRef(false),
    session = useRef(crypto.randomUUID());
  const quiet = ready && !blocked && !calling && !notices && !paused && route.section === "home" && !route.conversationId;
  const context = useRef(quiet);
  useEffect(() => {
    context.current = quiet;
  }, [quiet]);
  const current = useRef(notice);
  useEffect(() => {
    current.current = notice;
  }, [notice]);
  useEffect(() => {
    let alive = true,
      pending = false;
    const tick = async () => {
      if (pending || !context.current) return;
      const safe = () =>
        context.current &&
        document.visibilityState === "visible" &&
        document.hasFocus() &&
        !communicationBusy() &&
        !transfersOf(engine)
          .list()
          .some((t) => t.status === "running") &&
        !document.querySelector("[role='dialog'],[role='menu'],[role='progressbar'],[data-recording='true']") &&
        !document.activeElement?.matches("input,textarea,[contenteditable='true']");
      if (!safe()) {
        setNotice(null);
        return;
      }
      if (shown.current && !current.current) return;
      pending = true;
      try {
        const r = await engine.api.json("POST", "/v2/billing/reminders/renewal", response, { body: { sessionId: session.current, claim: !shown.current } });
        if (r.notice) shown.current = true;
        if (alive && safe()) setNotice(r.notice);
      } catch {
        if (alive) setNotice(null);
      } finally {
        pending = false;
      }
    };
    const timer = setInterval(() => void tick(), 5_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [engine]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), Math.max(0, notice.expiresAt - Date.now()));
    return () => clearTimeout(t);
  }, [notice]);
  if (!quiet || !notice) return null;
  const date = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(notice.endsAt);
  return (
    <aside className="plus-support-notice plus-promotion plus-promotion-card" role="status" aria-label="Plus billing reminder">
      <header className="plus-promotion-header">
        <button className="icon-btn plus-promotion-close" onClick={() => setNotice(null)} aria-label="Dismiss billing reminder">
          ×
        </button>
        <h2>{notice.autoRenew ? "Your Plus renewal is coming up" : "Your Plus time ends soon"}</h2>
        <p>{notice.autoRenew ? `Your existing agreement renews on ${date}.` : `Your current Plus access ends on ${date}.`}</p>
      </header>
      <div className="plus-promotion-body">
        <p>
          {notice.autoRenew && notice.amountMinor !== null && notice.currency
            ? `${money(notice.amountMinor, notice.currency)} every ${notice.months === 1 ? "month" : `${notice.months} months`}. You don’t need to purchase again. Manage or cancel your renewal in Billing.`
            : "Review your billing status and renewal options. Your current access remains available through the date shown."}
        </p>
        <button
          className="btn plus-promotion-upgrade"
          onClick={() => {
            setNotice(null);
            navigate({ section: "settings", settingsPage: "billing" });
          }}
        >
          Manage billing
        </button>
        <button className="btn btn-ghost" onClick={() => setNotice(null)}>
          Dismiss
        </button>
      </div>
    </aside>
  );
}
