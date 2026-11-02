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
  const [link, setLink] = useState<{ id: string; url: string } | null>(null);
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
          ? "Gift credit saved. It starts after your existing renewal ends. Your current subscription has not changed."
          : `Gift redeemed. Your Plus time ends ${result.endsAt ? new Date(result.endsAt).toLocaleDateString() : "after your existing time"}.`,
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
        <Gift size={18} aria-hidden="true" /> Plus · {g.months === 12 ? "1 year" : `${g.months} month${g.months === 1 ? "" : "s"}`}
      </h3>
      <p>{sent ? `To ${g.recipientEmail ?? (g.recipientKind === "link" ? "your gift-link recipient" : "your friend")}` : `From ${g.sender ?? "a friend"}`}</p>
      {g.note && <p>“{g.note}”</p>}
      <p className="muted">
        {g.credited ? "Credit saved · waiting for your current renewal to end" : g.status.replaceAll("_", " ")} · {money(g.amountMinor, g.currency)} · one-time payment
      </p>
      {g.expiresAt && g.status !== "redeemed" && <small className="muted">Redeem by {new Date(g.expiresAt).toLocaleDateString()}</small>}
      {!["pending", "pending_payment", "failed", "expired", "refunded", "revoked", "redeemed"].includes(g.status) && (
        <div className="row wrap">
          {!sent && (
            <button className="btn btn-mojo" disabled={action.busy} onClick={() => void redeem(g.id)}>
              Redeem gift
            </button>
          )}
          {sent && (
            <button className="btn btn-secondary" disabled={action.busy} onClick={() => void share(g.id)}>
              {link?.id === g.id ? "Replace gift link" : "Create gift link"}
            </button>
          )}
          {sent && g.recipientKind === "email" && (
            <button
              className="btn btn-secondary"
              disabled={action.busy}
              onClick={() =>
                void run(async () => {
                  await engine.api.json("POST", `/v2/billing/gifts/${encodeURIComponent(g.id)}/resend`, z.object({ queued: z.literal(true) }), { body: {} });
                  setMessage("Gift email queued. Each new email replaces earlier gift links.");
                })
              }
            >
              Resend email
            </button>
          )}
        </div>
      )}
      {link?.id === g.id && (
        <div className="field">
          <label htmlFor={`link-${g.id}`}>Private gift link</label>
          <input id={`link-${g.id}`} className="input" readOnly value={link.url} onFocus={(e) => e.currentTarget.select()} />
          <small>Keep this link private. Replacing it invalidates the previous link. A friend or email gift still belongs to its chosen recipient.</small>
          <button
            className="btn btn-secondary"
            onClick={() =>
              void run(async () => {
                await navigator.clipboard.writeText(link.url);
                setMessage("Gift link copied.");
              })
            }
          >
            Copy link
          </button>
        </div>
      )}
    </article>
  );
  return (
    <div className="billing-page">
      <header className="row">
        <div className="grow">
          <span className="checkout-kicker">YOUR ACCOUNT</span>
          <h1>Gifts</h1>
        </div>
        <button className="btn btn-secondary" disabled={gifts.loading} onClick={gifts.reload}>
          <RefreshCw size={16} /> Refresh
        </button>
      </header>
      <p>Give Plus with one payment. Gifts never renew or charge the recipient.</p>
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
          <h2>A gift for you</h2>
          {preview.loading ? (
            <p role="status">Checking your gift…</p>
          ) : (
            preview.data && (
              <>
                <p>
                  {preview.data.sender ?? "A friend"} sent you {preview.data.months} month{preview.data.months === 1 ? "" : "s"} of Plus.
                </p>
                {preview.data.note && <p>“{preview.data.note}”</p>}
                <p>Your existing Plus time stays available. An ongoing renewal keeps this gift as credit until that renewal ends.</p>
                {preview.data.requiresVerifiedEmail && <p>Use the verified email that received this gift.</p>}
                <button className="btn btn-mojo" disabled={action.busy} onClick={() => void redeem()}>
                  Redeem gift
                </button>
              </>
            )
          )}
        </section>
      )}
      <button className="btn btn-mojo" onClick={() => navigate({ section: "settings", settingsPage: "mojo" })}>
        Give Plus
      </button>
      <h2>Received</h2>
      {gifts.loading ? <p role="status">Loading gifts…</p> : gifts.data?.received.length ? gifts.data.received.map((g) => row(g, false)) : <p className="muted">Gifts for you appear here.</p>}
      <h2>Sent</h2>
      {gifts.data?.sent.length ? gifts.data.sent.map((g) => row(g, true)) : <p className="muted">Your gift purchases appear here after checkout.</p>}
    </div>
  );
}
