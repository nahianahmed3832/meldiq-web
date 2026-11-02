import { Gem, Minus, Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { money } from "./mojoFormat";
import { SparkLevelCards, SparkTrack } from "./SparkTrack";

/**
 * Meldiq Spark on the Meldiq Plus page (server docs/MOJO.md › Meldiq Spark): what the three levels unlock, the person's Sparks
 * and where each one is, and buying more. Giving one to a community is also on the community's menu (SparkDialog).
 */
export function SparkSection({ onBuy, busy, offline }: { onBuy: (quantity: number) => void; busy: boolean; offline: boolean }) {
  const engine = useEngine();
  const { catalog, me } = useOrbit((s) => s.mojo);
  const orgs = useOrbit((s) => s.orgs);
  const [quantity, setQuantity] = useState(1);
  const [giveTo, setGiveTo] = useState("");
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!catalog || !me) return null;
  const sparks = me.sparks;
  const price = catalog.onSale.spark;
  const act = async (key: string, fn: () => Promise<void>) => {
    setWorking(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't change that Spark.");
    } finally {
      setWorking(null);
    }
  };
  const levels = catalog.spark.levels.filter((l) => l.level > 0);
  return (
    <section className="mojo-sparks" aria-labelledby="mojo-sparks-title">
      <div className="spark-hero">
        <span className="mojo-banner-icon" aria-hidden="true">
          <Gem size={26} />
        </span>
        <h2 className="mojo-h2" id="mojo-sparks-title">
          Meldiq Spark
        </h2>
        <p>
          Give a Spark to a server you love. Every Spark helps unlock more emoji slots, bigger uploads, and better voice and screen sharing for everyone in it. Legacy Go includes one Spark, Meldiq Plus
          two, and anyone can add more for {money(catalog.spark.listPriceMinor, "USD")} per Spark as a one-time purchase.
        </p>
        <SparkTrack levels={levels} level={null} active={null} />
      </div>
      <SparkLevelCards catalog={catalog} levels={levels} level={null} />
      <p className="muted spark-note">
        A server&apos;s benefits never lower anyone&apos;s own plan. Level 1 takes {levels[0]?.sparks ?? 2} Sparks, Level 2 {levels[1]?.sparks ?? 5} and Level 3 {levels[2]?.sparks ?? 8}; past that,
        extra Sparks are better given to another server.
      </p>

      <div className="card setting-card spark-mine">
        <div className="setting-card-head">
          <span className="spark-count" aria-hidden="true">
            {sparks.total}
          </span>
          <span className="lines grow">
            <strong>Your Sparks</strong>
            <small>
              {sparks.total === 0 ? "You have no Sparks yet." : `${sparks.included} with your plan${sparks.purchased ? ` and ${sparks.purchased} bought` : ""}: ${sparks.free} free to give.`}
            </small>
          </span>
        </div>
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        {sparks.assignments.length > 0 && (
          <ul className="spark-list">
            {sparks.assignments.map((a) => (
              <li key={a.id}>
                <Sparkles size={15} aria-hidden="true" />
                <span className="grow">
                  {a.orgName ?? "A community"}
                  {a.paused && <span className="tag">Paused: your plan has fewer Sparks now</span>}
                  {!a.member && <span className="tag">You left this community: it doesn't count there</span>}
                </span>
                <select
                  className="input input-sm"
                  aria-label={`Move the Spark in ${a.orgName ?? "this community"}`}
                  value=""
                  disabled={working !== null || offline}
                  onChange={(e) => e.target.value && void act(a.id, () => engine.mojo.moveSpark(a.id, e.target.value))}
                >
                  <option value="">Move to…</option>
                  {orgs
                    .filter((o) => o.id !== a.orgId)
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                </select>
                <button className="btn btn-ghost btn-sm" disabled={working !== null || offline} onClick={() => void act(a.id, () => engine.mojo.removeSpark(a.id))}>
                  {working === a.id ? "…" : "Take back"}
                </button>
              </li>
            ))}
          </ul>
        )}
        {sparks.free > 0 && orgs.length > 0 && (
          <div className="row spark-give">
            <select className="input" aria-label="Community to give a Spark to" value={giveTo} onChange={(e) => setGiveTo(e.target.value)}>
              <option value="">Choose a community…</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <button className="btn btn-primary" disabled={!giveTo || working !== null || offline} onClick={() => void act("give", () => engine.mojo.giveSpark(giveTo))}>
              {working === "give" ? "Giving…" : "Give a Spark"}
            </button>
          </div>
        )}
        <div className="row spark-buy">
          <span className="grow">
            <strong>Get more Sparks</strong>
            <small className="muted" style={{ display: "block" }}>
              {price ? `${money(price.amountMinor, price.currency)} per Spark, paid once. No Meldiq Plus subscription or automatic renewal.` : "Sparks are purchased separately from Meldiq Plus."}
              {sparks.subscription ? ` Existing subscription: ${sparks.subscription.quantity} Sparks. Manage it in Billing.` : ""}
            </small>
          </span>
          {
            <>
              <div className="stepper" role="group" aria-label="How many Sparks">
                <button className="icon-btn" aria-label="One fewer" disabled={quantity <= 1} onClick={() => setQuantity((q) => Math.max(1, q - 1))}>
                  <Minus size={14} />
                </button>
                <span aria-live="polite">{quantity}</span>
                <button className="icon-btn" aria-label="One more" disabled={quantity >= catalog.spark.maxPurchase} onClick={() => setQuantity((q) => Math.min(catalog.spark.maxPurchase, q + 1))}>
                  <Plus size={14} />
                </button>
              </div>
              <button className="btn btn-mojo" disabled={!price || busy || offline} onClick={() => onBuy(quantity)}>
                {busy ? "Opening…" : price ? `Buy for ${money(price.amountMinor * quantity, price.currency)} once` : "Not on sale yet"}
              </button>
            </>
          }
        </div>
      </div>
    </section>
  );
}
