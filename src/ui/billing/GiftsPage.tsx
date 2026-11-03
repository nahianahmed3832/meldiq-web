import { formatUnit } from "../../i18n/format";
import { billingState } from "../../i18n/billing";
import { interfaceLocale } from "../../i18n/format";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { Gift, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { zGifts, zGiftLink, zGiftPreview, zGiftRedemption, giftTokenFromLocation, type GiftView } from "../../api/giftSchemas";
import { useEngine } from "../../application/orbit";
import { navigate, ROUTE_EVENT } from "../../application/router";
import { useAction, useLoad } from "../workspace/useLoad";
import { money } from "../mojo/mojoFormat";
/** Tokens stay in this component's memory and the URL fragment; only explicit POSTs send them to the API. */
export function GiftsPage() {
  useLocaleRender();
  const engine = useEngine();
  const [token, setToken] = useState(giftTokenFromLocation);
  useEffect(() => {
    const update = () => setToken(giftTokenFromLocation());
    window.addEventListener("hashchange", update);
    window.addEventListener("popstate", update);
    window.addEventListener(ROUTE_EVENT, update);
    return () => {
      window.removeEventListener("hashchange", update);
      window.removeEventListener("popstate", update);
      window.removeEventListener(ROUTE_EVENT, update);
    };
  }, []);
  const gifts = useLoad(() => engine.api.json("GET", "/v2/billing/gifts", zGifts), [engine]);
  const preview = useLoad(() => (token ? engine.api.json("POST", "/v2/billing/gifts/preview", zGiftPreview, { body: { token }, auth: false }) : Promise.resolve(null)), [engine, token]);
  const action = useAction();
  const [message, setMessage] = useState<string | null>(null);
  const [link, setLink] = useState<{
    id: string;
    url: string;
  } | null>(null);
  const lock = useRef(false);
  const run = async (fn: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    try {
      await action.act(fn);
    } finally {
      lock.current = false;
    }
  };
  const redeem = (id?: string) =>
    run(async () => {
      const result = await engine.api.json("POST", id ? `/v2/billing/gifts/${encodeURIComponent(id)}/redeem` : "/v2/billing/gifts/redeem", zGiftRedemption, { body: id ? {} : { token } });
      setMessage(
        result.credited
          ? uiText("billing.interface.gift_credit_saved_it_starts_after_your_existing_renewal_ends_your_cu_ccee8f6")
          : uiText("billing.interface.gift_redeemed_your_plus_time_ends_1a34923", {
              value0: result.endsAt ? new Date(result.endsAt).toLocaleDateString(interfaceLocale()) : uiText("billing.interface.after_your_existing_time_7d318ed"),
            }),
      );
      if (!id) {
        history.replaceState(history.state, "", location.pathname);
        setToken(null);
      }
      gifts.reload();
      await engine.mojo.refresh();
    });
  const share = (id: string) =>
    run(async () => {
      const result = await engine.api.json("POST", `/v2/billing/gifts/${encodeURIComponent(id)}/link`, zGiftLink, { body: {} });
      // No clipboard access is attempted without a separate, explicit user action.
      setLink({ id, url: result.url });
      gifts.reload();
    });
  const row = (g: GiftView, sent: boolean) => (
    <article className="card" key={g.id}>
      <h3>
        <Localized k="billing.interface.plus_ad1cb4a" slots={[<Gift size={18} aria-hidden="true" />, g.months === 12 ? uiText("billing.interface.1_year_91647ba") : formatUnit(g.months, "month")]} />
      </h3>
      <p>
        {sent
          ? uiText("billing.interface.to_value0_75affae", {
              value0: g.recipientEmail ?? (g.recipientKind === "link" ? uiText("billing.interface.your_gift_link_recipient_ec68104") : uiText("billing.interface.your_friend_f06d230")),
            })
          : uiText("billing.interface.from_value0_489338e", { value0: g.sender ?? uiText("billing.interface.a_friend_908d415") })}
      </p>
      {g.note && <p>“{g.note}”</p>}
      <p className="muted">
        <Localized
          k="billing.interface.one_time_payment_676f180"
          slots={[g.credited ? uiText("billing.interface.credit_saved_waiting_for_your_current_renewal_to_end_e98d5a4") : billingState(g.status), money(g.amountMinor, g.currency)]}
        />
      </p>
      {g.expiresAt && g.status !== "redeemed" && (
        <small className="muted">
          <Localized k="billing.interface.redeem_by_80ff505" slots={[new Date(g.expiresAt).toLocaleDateString(interfaceLocale())]} />
        </small>
      )}
      {!["pending", "pending_payment", "failed", "expired", "refunded", "revoked", "redeemed"].includes(g.status) && (
        <div className="row wrap">
          {!sent && (
            <button className="btn btn-mojo" disabled={action.busy} onClick={() => void redeem(g.id)}>
              <Localized k="billing.interface.redeem_gift_64e3e32" />
            </button>
          )}
          {sent && (
            <button className="btn btn-secondary" disabled={action.busy} onClick={() => void share(g.id)}>
              {link?.id === g.id ? uiText("billing.interface.replace_gift_link_5d60219") : uiText("billing.interface.create_gift_link_5dc25d9")}
            </button>
          )}
          {sent && g.recipientKind === "email" && (
            <button
              className="btn btn-secondary"
              disabled={action.busy}
              onClick={() =>
                void run(async () => {
                  await engine.api.json("POST", `/v2/billing/gifts/${encodeURIComponent(g.id)}/resend`, z.object({ queued: z.literal(true) }), { body: {} });
                  setMessage(uiText("billing.interface.gift_email_queued_each_new_email_replaces_earlier_gift_links_c6cddef"));
                })
              }
            >
              <Localized k="billing.interface.resend_email_4f44603" />
            </button>
          )}
        </div>
      )}
      {link?.id === g.id && (
        <div className="field">
          <label htmlFor={`link-${g.id}`}>
            <Localized k="billing.interface.private_gift_link_37bc0df" />
          </label>
          <input id={`link-${g.id}`} className="input" readOnly value={link.url} onFocus={(e) => e.currentTarget.select()} />
          <small>
            <Localized k="billing.interface.keep_this_link_private_replacing_it_invalidates_the_previous_link_dbc06b3" />
          </small>
          <button
            className="btn btn-secondary"
            onClick={() =>
              void run(async () => {
                await navigator.clipboard.writeText(link.url);
                setMessage(uiText("billing.interface.gift_link_copied_b2b1b6a"));
              })
            }
          >
            <Localized k="messaging.fwd_copy_link" />
          </button>
        </div>
      )}
    </article>
  );
  return (
    <div className="billing-page">
      <header className="row">
        <div className="grow">
          <span className="checkout-kicker">
            <Localized k="billing.interface.your_account_cee7fd7" />
          </span>
          <h1>
            <Localized k="workspace.interface.gifts_67a025d" />
          </h1>
        </div>
        <button className="btn btn-secondary" disabled={gifts.loading} onClick={gifts.reload}>
          <Localized k="billing.interface.refresh_fe72b91" slots={[<RefreshCw size={16} />]} />
        </button>
      </header>
      <p>
        <Localized k="billing.interface.give_plus_with_one_payment_gifts_never_renew_or_charge_the_recipi_006fea6" />
      </p>
      {(gifts.error || action.error || preview.error) && (
        <p className="banner danger" role="alert">
          {action.error ?? preview.error ?? gifts.error}
        </p>
      )}
      {message && (
        <p className="banner" role="status">
          {message}
        </p>
      )}
      {token && (
        <section className="card">
          <h2>
            <Localized k="billing.interface.a_gift_for_you_0dde3cc" />
          </h2>
          {preview.loading ? (
            <p role="status">
              <Localized k="billing.interface.checking_your_gift_5295c26" />
            </p>
          ) : (
            preview.data && (
              <>
                <p>
                  <Localized k="billing.interface.native_count_f9092cfad" slots={[preview.data.sender ?? uiText("billing.interface.a_friend_6c274d2"), formatUnit(preview.data.months, "month"), ""]} />
                </p>
                {preview.data.note && <p>“{preview.data.note}”</p>}
                <p>
                  <Localized k="billing.interface.your_existing_plus_time_stays_available_an_ongoing_renewal_keeps_0187304" />
                </p>
                {preview.data.requiresVerifiedEmail && (
                  <p>
                    <Localized k="billing.interface.use_the_verified_email_that_received_this_gift_40231a0" />
                  </p>
                )}
                <button className="btn btn-mojo" disabled={action.busy} onClick={() => void redeem()}>
                  <Localized k="billing.interface.redeem_gift_64e3e32" />
                </button>
              </>
            )
          )}
        </section>
      )}
      <button className="btn btn-mojo" onClick={() => navigate({ section: "settings", settingsPage: "mojo" })}>
        <Localized k="billing.interface.give_plus_23c0866" />
      </button>
      <h2>
        <Localized k="messaging.interface.received_49f19be" />
      </h2>
      {gifts.loading ? (
        <p role="status">
          <Localized k="billing.interface.loading_gifts_20fc594" />
        </p>
      ) : gifts.data?.received.length ? (
        gifts.data.received.map((g) => row(g, false))
      ) : (
        <p className="muted">
          <Localized k="billing.interface.gifts_for_you_appear_here_7315285" />
        </p>
      )}
      <h2>
        <Localized k="messaging.interface.sent_c16bc82" />
      </h2>
      {gifts.data?.sent.length ? (
        gifts.data.sent.map((g) => row(g, true))
      ) : (
        <p className="muted">
          <Localized k="billing.interface.your_gift_purchases_appear_here_after_checkout_6ca29d5" />
        </p>
      )}
    </div>
  );
}
