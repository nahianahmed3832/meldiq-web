import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { interfaceLocale } from "../../i18n/format";
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
  useLocaleRender();
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
    const timer = setInterval(() => void tick(), 5000);
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
  const date = new Intl.DateTimeFormat(interfaceLocale(), { dateStyle: "medium" }).format(notice.endsAt);
  return (
    <aside className="plus-support-notice plus-promotion plus-promotion-card" role="status" aria-label={uiText("billing.interface.plus_billing_reminder_e36a54a")}>
      <header className="plus-promotion-header">
        <button className="icon-btn plus-promotion-close" onClick={() => setNotice(null)} aria-label={uiText("billing.interface.dismiss_billing_reminder_7b38a20")}>
          ×
        </button>
        <h2>{notice.autoRenew ? uiText("billing.interface.your_plus_renewal_is_coming_up_2c56e4d") : uiText("billing.interface.your_plus_time_ends_soon_8487b2e")}</h2>
        <p>
          {notice.autoRenew
            ? uiText("billing.interface.your_existing_agreement_renews_on_value0_fb81ef9", { value0: date })
            : uiText("billing.interface.your_current_plus_access_ends_on_value0_833c612", { value0: date })}
        </p>
      </header>
      <div className="plus-promotion-body">
        <p>
          {notice.autoRenew && notice.amountMinor !== null && notice.currency
            ? uiText("billing.interface.value0_every_value1_you_don_t_need_to_purchase_again_manage_or_ca_eb2a24d", {
                value0: money(notice.amountMinor, notice.currency),
                value1: notice.months === 1 ? uiText("billing.interface.month_a5c7d17") : uiText("billing.interface.value0_months_9a9a6ea", { value0: notice.months }),
              })
            : uiText("billing.interface.review_your_billing_status_and_renewal_options_your_current_acces_4d61faa")}
        </p>
        <button
          className="btn plus-promotion-upgrade"
          onClick={() => {
            setNotice(null);
            navigate({ section: "settings", settingsPage: "billing" });
          }}
        >
          <Localized k="billing.interface.manage_billing_7ea27c6" />
        </button>
        <button className="btn btn-ghost" onClick={() => setNotice(null)}>
          <Localized k="calls.interface.dismiss_48845bf" />
        </button>
      </div>
    </aside>
  );
}
