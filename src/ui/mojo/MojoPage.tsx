import { BadgeCheck, Check, Gift, Loader2, Sparkles, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import type { MojoCatalog, PlanKey, PlanPerks } from "../../api/mojoSchemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { relative } from "../format";
import { GiftDialog, GiftsReceived } from "./MojoGifts";
import { money, planPrice, screenLabel, size } from "./mojoFormat";
import { SparkSection } from "./SparkSection";
import { MojoBadgeMark } from "./MojoBadge";

/** Comparison rows: the table is the full overview; cards only pick out what matters most (no bots: Meldiq has none yet). */
const ROWS: { label: string; value: (p: PlanPerks, c: MojoCatalog) => string }[] = [
  { label: "Characters in a message", value: (p) => p.messageChars.toLocaleString() },
  { label: "Largest file you share", value: (p) => size(p.uploadBytes) },
  { label: "Screen sharing", value: (p, c) => screenLabel(c, p.screen) },
  { label: "Meldiq Sparks included", value: (p) => String(p.sparks) },
  { label: "Custom emoji and stickers you add", value: (p) => String(p.customItems) },
  { label: "Name badge", value: (p) => (p.badge === "plus" ? "Plus, with Meldiq Check" : p.badge === "go" ? "Go" : "None") },
];

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
            {mojo.error}{" "}
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
  const onPlan = (k: PlanKey) => me.plan === k;
  const offline = !online;

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
            More room. More reach. <span className="mojo-glow">More Meldiq.</span>
          </h2>
          <p>Talking, calling, sharing and communities are free and stay free. Mojo adds bigger files, sharper screen shares, Sparks for the servers you love, and a badge.</p>
        </div>
        <div className="mojo-hero-plan" aria-label="Your plan">
          <span className="faint">You're on</span>
          <strong>{me.perks.name}</strong>
          {paid && <small>{paid.cancelAtPeriodEnd ? `Ends ${relative(paid.currentPeriodEnd ?? Date.now())}` : `Renews ${relative(paid.currentPeriodEnd ?? Date.now())}`}</small>}
        </div>
      </section>

      <div className="mojo-plans">
        {catalog.plans.map((p) => {
          const price = planPrice(catalog, p.key);
          const current = onPlan(p.key);
          return (
            <section key={p.key} className={`mojo-plan plan-${p.key}${current ? " current" : ""}`} aria-label={p.name}>
              <header>
                <h3>
                  {p.name} {p.badge && <MojoBadgeMark badge={p.badge} check={false} />}
                </h3>
                <div className="mojo-price">
                  <strong>{price.label}</strong>
                  {p.key !== "free" && <span>/month</span>}
                </div>
              </header>
              <ul>
                <li>
                  <Check size={14} aria-hidden="true" /> {p.messageChars.toLocaleString()} characters a message
                </li>
                <li>
                  <Check size={14} aria-hidden="true" /> Files up to {size(p.uploadBytes)}
                </li>
                <li>
                  <Check size={14} aria-hidden="true" /> Screen sharing at {screenLabel(catalog, p.screen)}
                </li>
                <li>
                  <Check size={14} aria-hidden="true" /> {p.sparks === 0 ? "Sparks: buy them separately" : `${p.sparks} Meldiq Spark${p.sparks === 1 ? "" : "s"} included`}
                </li>
              </ul>
              {p.key === "free" ? (
                <button className="btn btn-secondary" disabled>
                  {current ? "Your plan" : "Always free"}
                </button>
              ) : current && paid ? (
                <button className="btn btn-secondary" disabled={busy !== null || offline} onClick={() => void open("portal", () => engine.mojo.portal())}>
                  {busy === "portal" ? "Opening…" : "Manage subscription"}
                </button>
              ) : current ? (
                <button className="btn btn-secondary" disabled>
                  Your plan (a free period)
                </button>
              ) : (
                <button
                  className={`btn ${p.key === "plus" ? "btn-mojo" : "btn-primary"}`}
                  disabled={!price.onSale || busy !== null || offline || (!!paid && me.plan !== "free")}
                  onClick={() => void open(p.key, () => engine.mojo.checkout(p.key as "go" | "plus"))}
                >
                  {busy === p.key ? "Opening…" : !price.onSale ? "Not on sale yet" : paid ? `Switch from the billing page` : `Get ${p.name} for ${price.label}/month`}
                </button>
              )}
            </section>
          );
        })}
      </div>
      <p className="mojo-terms muted">
        Mojo renews every month at the price shown until you cancel. Cancel any time from Manage subscription: you keep Mojo until the end of the month you paid for, and nothing you made is deleted.
        Prices are in US dollars; your bank may add conversion fees.
      </p>

      <button className="mojo-gift-entry" disabled={!catalog.onSale.gifts || offline} onClick={() => setGifting(true)}>
        <Gift size={18} aria-hidden="true" />
        <span className="lines grow">
          <strong>Gift Mojo to a friend</strong>
          <small>{catalog.onSale.gifts ? "One payment for 1, 3 or 12 months, straight to their account, with a note from you." : "Gifts open when Mojo goes on sale."}</small>
        </span>
      </button>
      <GiftsReceived me={me} />

      <h2 className="mojo-h2">What Mojo Plus adds</h2>
      <div className="mojo-perks">
        <article>
          <Zap size={20} aria-hidden="true" />
          <h3>{PLUS(catalog).messageChars.toLocaleString()} character messages</h3>
          <p>Long stories, patch notes, a whole recipe, one message. Edits get the same room.</p>
        </article>
        <article>
          <Zap size={20} aria-hidden="true" />
          <h3>{size(PLUS(catalog).uploadBytes)} uploads</h3>
          <p>Full clips, big GIFs, whole albums.</p>
        </article>
        <article>
          <Zap size={20} aria-hidden="true" />
          <h3>{screenLabel(catalog, PLUS(catalog).screen)} screen sharing</h3>
          <p>Crisp and smooth for everyone watching.</p>
        </article>
        <article>
          <Sparkles size={20} aria-hidden="true" />
          <h3>{PLUS(catalog).sparks} Meldiq Sparks</h3>
          <p>Give a Spark to a server you love. Every Spark helps unlock more emoji slots, bigger uploads, and better voice and screen sharing for everyone there.</p>
        </article>
        <article>
          <BadgeCheck size={20} aria-hidden="true" />
          <h3>Plus badge and Meldiq Check</h3>
          <p>A small Plus next to your name so people know you keep the lights on. Hide it any time. Meldiq Check is a Plus perk, not identity verification.</p>
        </article>
        <article>
          <Zap size={20} aria-hidden="true" />
          <h3>{PLUS(catalog).customItems} custom emoji and stickers</h3>
          <p>Add more across your communities. If a plan ends, the oldest stay usable and the rest are kept, locked until you upgrade again: nothing is deleted.</p>
        </article>
      </div>

      <h2 className="mojo-h2">Compare plans</h2>
      <div className="mojo-table-wrap">
        <table className="mojo-table">
          <thead>
            <tr>
              <th scope="col">What you get</th>
              {catalog.plans.map((p) => (
                <th key={p.key} scope="col" className={onPlan(p.key) ? "current" : undefined}>
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.label}>
                <th scope="row">{r.label}</th>
                {catalog.plans.map((p) => (
                  <td key={p.key} className={onPlan(p.key) ? "current" : undefined}>
                    {r.value(p, catalog)}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <th scope="row">Price</th>
              {catalog.plans.map((p) => (
                <td key={p.key} className={onPlan(p.key) ? "current" : undefined}>
                  {p.key === "free" ? "Free" : `${planPrice(catalog, p.key).label} a month`}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <SparkSection onBuy={(q) => void open("sparks", () => engine.mojo.buySparks(q))} busy={busy === "sparks"} offline={offline} />

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

      <section className="card mojo-why" aria-labelledby="mojo-why">
        <h2 id="mojo-why">Why subscriptions?</h2>
        <p>
          Meldiq has no external investors. We pay for the infrastructure and tools that keep the service running, including servers, storage, voice and video bandwidth, and moderation and development
          tooling. Subscriptions help cover these real operating costs. Anything left after operating costs helps us keep improving Meldiq and is our thank-you for supporting it. Talking, calling and
          communities stay useful on the Free plan.
        </p>
      </section>
      {gifting && <GiftDialog catalog={catalog} onClose={() => setGifting(false)} onPay={(input) => open("gift", () => engine.mojo.gift(input))} busy={busy === "gift"} />}
      <p className="muted" style={{ fontSize: 12 }}>
        Mojo prices: Go {money(catalog.plans.find((p) => p.key === "go")?.listPriceMinor ?? 0, "USD")}, Plus {money(catalog.plans.find((p) => p.key === "plus")?.listPriceMinor ?? 0, "USD")}, each
        Spark {money(catalog.spark.listPriceMinor, "USD")}, monthly.
      </p>
    </div>
  );
}

const PLUS = (c: MojoCatalog) => c.plans.find((p) => p.key === "plus")!;
