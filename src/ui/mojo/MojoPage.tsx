import { Gem, Gift, HeartHandshake, Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import type { PlanPerks } from "../../api/mojoSchemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { relative } from "../format";
import { GiftDialog, GiftsReceived } from "./MojoGifts";
import { money, planPrice, screenLabel, size } from "./mojoFormat";
import { CompareTable, type PlanAction, PlanCards, PlusPerks } from "./MojoPlans";
import { navigate } from "../../application/router";
import { MojoBadgeMark } from "./MojoBadge";

/** Where a payment page sends the person back (?checkout= or ?gift=), read once. */
function returnedFrom(): "checkout" | "gift" | "canceled" | null {
  const q = new URLSearchParams(window.location.search);
  if (q.get("checkout") === "success") return "checkout";
  if (q.get("gift") === "success") return "gift";
  if (q.get("checkout") === "canceled" || q.get("gift") === "canceled") return "canceled";
  return null;
}

/**
 * Settings › Meldiq Mojo (server docs/MOJO.md): the plans, what each gives, Sparks, gifts and the badge. Every number
 * comes from the server's catalog, and every button asks the server, which asks the payment provider: nothing here
 * grants anything.
 */
export function MojoPage() {
  const engine = useEngine();
  const mojo = useOrbit((s) => s.mojo);
  const online = useOrbit((s) => s.connection === "online");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gifting, setGifting] = useState(false);
  const [confirming, setConfirming] = useState<"checkout" | "gift" | null>(null);

  useEffect(() => {
    const back = returnedFrom();
    if (back) {
      // The query is the payment page's; the plan itself arrives with the provider's signed event.
      window.history.replaceState(window.history.state, "", window.location.pathname);
      if (back === "canceled") engine.notice("info", "Nothing was charged.");
      else {
        setConfirming(back);
        void engine.mojo.afterReturn().finally(() => setConfirming(null));
      }
    } else void engine.mojo.refresh();
  }, [engine]);

  const open = async (what: string, start: () => Promise<string | null>) => {
    setBusy(what);
    setError(null);
    try {
      const url = await start();
      if (url) window.location.assign(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open the payment page. Nothing was charged.");
    } finally {
      setBusy(null);
    }
  };

  const { catalog, me, billing } = mojo;
  if (!catalog || !me) {
    return (
      <>
        <h1>Meldiq Mojo</h1>
        {mojo.error ? (
          <div className="banner danger" role="alert">
            <span className="grow">{mojo.error}</span>
            <button className="btn btn-secondary btn-sm" onClick={() => void engine.mojo.refresh()}>
              Try again
            </button>
          </div>
        ) : (
          <div className="mojo-loading" role="status">
            <Loader2 size={18} className="spin" aria-hidden="true" /> Loading Meldiq Mojo…
          </div>
        )}
      </>
    );
  }

  const paid = billing?.subscription ?? null;
  const offline = !online;
  const plus = catalog.plans.find((p) => p.key === "plus");
  const free = catalog.plans.find((p) => p.key === "free");
  const plusPrice = planPrice(catalog, "plus");

  /** The one button under a plan: buy it, manage it, or say why not. */
  const actionFor = (p: PlanPerks): PlanAction => {
    const price = planPrice(catalog, p.key);
    const current = me.plan === p.key;
    if (p.key === "free") return { label: current ? "Your plan" : "Always free", kind: "secondary", disabled: true };
    if (current && paid)
      return { label: busy === "portal" ? "Opening…" : "Manage subscription", kind: "secondary", disabled: busy !== null || offline, onClick: () => void open("portal", () => engine.mojo.portal()) };
    if (current) return { label: "Your plan (a free period)", kind: "secondary", disabled: true };
    return {
      label: busy === p.key ? "Opening…" : !price.onSale ? "Not on sale yet" : paid ? "Switch from the billing page" : `Get ${p.name} for ${price.label}/month`,
      kind: p.key === "plus" ? "mojo" : "primary",
      disabled: !price.onSale || busy !== null || offline || (!!paid && me.plan !== "free"),
      onClick: () => void open(p.key, () => engine.mojo.checkout(p.key as "go" | "plus")),
    };
  };
  const heroAction = plus && me.plan !== "plus" && plusPrice.onSale ? actionFor(plus) : null;

  return (
    <div className="mojo">
      <h1>Meldiq Mojo</h1>
      {confirming && (
        <div className="banner info" role="status">
          <Loader2 size={16} className="spin" aria-hidden="true" /> {confirming === "gift" ? "Confirming your gift with the payment provider…" : "Confirming your payment…"} Mojo applies the moment the
          payment provider confirms it.
        </div>
      )}
      {error && (
        <div className="banner danger" role="alert">
          {error}
        </div>
      )}
      {!catalog.onSale.go && !catalog.onSale.plus && (
        <div className="banner info" role="note">
          Mojo isn't on sale yet. Everything below is what each plan will include; nothing can be bought or charged until it is.
        </div>
      )}
      {catalog.onSale.mode === "test" && (
        <div className="banner info" role="note">
          Payments are in test mode: no real money is taken.
        </div>
      )}

      <section className="mojo-hero" aria-labelledby="mojo-hero-title">
        <div className="mojo-hero-text">
          <span className="mojo-eyebrow">
            <Sparkles size={15} aria-hidden="true" /> Meldiq Mojo
          </span>
          <h2 id="mojo-hero-title">
            Free to talk. <span className="mojo-glow">Mojo to go further.</span>
          </h2>
          <p>Talking, calling, sharing and communities are free and stay free. Mojo adds bigger files, sharper screen shares, Sparks for the servers you love, and a badge.</p>
        </div>
        <div className="mojo-hero-plan" aria-label="Your plan">
          <span className="faint">You're on</span>
          <strong>
            {me.perks.name} {me.badge.kind && <MojoBadgeMark badge={me.badge.kind} check={me.badge.check} />}
          </strong>
          <small>
            {paid
              ? paid.cancelAtPeriodEnd
                ? `Ends ${relative(paid.currentPeriodEnd ?? Date.now())}`
                : `Renews ${relative(paid.currentPeriodEnd ?? Date.now())}`
              : me.plan === "free"
                ? "Free for as long as you like"
                : "A free period: nothing renews"}
          </small>
        </div>
      </section>

      {heroAction && (
        <button className="btn btn-lg btn-mojo mojo-cta" disabled={heroAction.disabled} onClick={heroAction.onClick}>
          {heroAction.label}
        </button>
      )}
      <button className="mojo-gift-entry" disabled={!catalog.onSale.gifts || offline} onClick={() => setGifting(true)}>
        <span className="mojo-gift-icon" aria-hidden="true">
          <Gift size={18} />
        </span>
        <span className="lines grow">
          <strong>Gift Mojo to a friend</strong>
          <small>{catalog.onSale.gifts ? "One payment for 1, 3 or 12 months, straight to their account, with a note from you." : "Gifts open when Mojo goes on sale."}</small>
        </span>
      </button>
      <GiftsReceived me={me} />

      <h2 className="mojo-h2">Choose your plan</h2>
      <PlanCards catalog={catalog} me={me} actionFor={actionFor} />
      <p className="mojo-terms muted">
        Mojo renews every month at the price shown until you cancel. Cancel any time from Manage subscription: you keep Mojo until the end of the month you paid for, and nothing you made is deleted.
        Prices are in US dollars; your bank may add conversion fees.
      </p>

      <img className="mojo-poster" src="/meldling/plus.webp" alt="Meldiq Plus" width={1200} height={800} loading="lazy" />
      <h2 className="mojo-h2">What Mojo Plus adds</h2>
      <PlusPerks catalog={catalog} />

      <h2 className="mojo-h2">Compare plans</h2>
      <CompareTable catalog={catalog} me={me} />

      <section className="spark-hero spark-link" aria-labelledby="mojo-spark-link">
        <h2 className="mojo-h2" id="mojo-spark-link">
          <Gem size={20} aria-hidden="true" /> Meldiq Spark
        </h2>
        <p>
          Boost the servers you love: every Spark helps a community unlock more emoji slots, bigger uploads, and better voice and screen sharing for everyone there. Mojo Go includes one Spark, Mojo
          Plus two.
        </p>
        <div>
          <button className="btn btn-mojo" onClick={() => navigate({ section: "settings", settingsPage: "spark" })}>
            <Gem size={15} aria-hidden="true" /> Open Meldiq Spark
          </button>
        </div>
      </section>

      {me.badge.kind && (
        <section className="card setting-card" aria-label="Your badge">
          <div className="setting-card-head">
            <span className="lines grow">
              <strong>
                Your badge <MojoBadgeMark badge={me.badge.kind} check={me.badge.check} />
              </strong>
              <small>{me.badge.hidden ? "Hidden: people don't see it. Your plan doesn't change." : "Shown next to your name in member lists and on your profile."}</small>
            </span>
            <button className="btn btn-secondary btn-sm" disabled={busy !== null || offline} onClick={() => void open("badge", async () => (await engine.mojo.setBadgeHidden(!me.badge.hidden), null))}>
              {me.badge.hidden ? "Show it" : "Hide it"}
            </button>
          </div>
        </section>
      )}

      <section className="mojo-why" aria-labelledby="mojo-why">
        <span className="mojo-perk-icon" aria-hidden="true">
          <HeartHandshake size={20} />
        </span>
        <div className="lines">
          <h2 id="mojo-why">Why subscriptions?</h2>
          <p>
            Meldiq has no external investors. We pay for the infrastructure and tools that keep the service running, including servers, storage, voice and video bandwidth, and moderation and
            development tooling. Subscriptions help cover these real operating costs. Anything left after operating costs helps us keep improving Meldiq and is our thank-you for supporting it.
            Talking, calling and communities stay useful on the Free plan.
          </p>
        </div>
      </section>
      {free && (
        <p className="mojo-free-note muted">
          Still free for everyone: messages up to {free.messageChars.toLocaleString()} characters, files up to {size(free.uploadBytes)}, voice and video calls, screen sharing at{" "}
          {screenLabel(catalog, free.screen)}, {free.customItems} custom emoji and stickers, and communities of your own.
        </p>
      )}
      {gifting && <GiftDialog catalog={catalog} onClose={() => setGifting(false)} onPay={(input) => open("gift", () => engine.mojo.gift(input))} busy={busy === "gift"} />}
      <p className="muted mojo-footnote">
        Mojo prices: Go {money(catalog.plans.find((p) => p.key === "go")?.listPriceMinor ?? 0, "USD")}, Plus {money(plus?.listPriceMinor ?? 0, "USD")}, each Spark{" "}
        {money(catalog.spark.listPriceMinor, "USD")}, monthly.
      </p>
    </div>
  );
}
