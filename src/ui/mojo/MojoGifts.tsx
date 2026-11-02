import { Gift } from "lucide-react";
import { useState } from "react";
import type { MojoCatalog, MojoMe } from "../../api/mojoSchemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { connections } from "../../sync/social";
import { Dialog } from "../components/Overlay";
import { relative } from "../format";
import { useLoad } from "../workspace/useLoad";
import type { GiftRecipient } from "../billing/checkoutDraft";
import { zGiftRedemption } from "../../api/giftSchemas";
import { money } from "./mojoFormat";

const PLAN_NAME = { go: "Legacy Go", plus: "Meldiq Plus" } as const;

/**
 * Buying Meldiq Plus for a friend (server docs/MOJO.md › Gifts): one payment, for 1, 3 or 12 months, priced by the server. The
 * friend chooses when to start it; nothing renews. Only friends are offered (the server checks again).
 */
export function GiftDialog({
  catalog,
  onClose,
  onPay,
  busy,
  flexible = false,
}: {
  catalog: MojoCatalog;
  onClose: () => void;
  onPay: (input: { recipientUserId: string; recipient?: GiftRecipient; planKey: "go" | "plus"; months: number; note: string }) => Promise<void>;
  busy: boolean;
  flexible?: boolean;
}) {
  const engine = useEngine();
  const friends = useLoad(() => connections(engine), [engine]);
  const [kind, setKind] = useState<"user" | "email" | "link">("user");
  const [email, setEmail] = useState("");
  const [to, setTo] = useState("");
  const [planKey, setPlanKey] = useState<"go" | "plus">("plus");
  const [months, setMonths] = useState(catalog.gifts.months[0] ?? 1);
  const [note, setNote] = useState("");
  const monthly = catalog.onSale[planKey];
  const list = friends.data?.connected ?? [];
  const ready = (kind === "link" || (kind === "email" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) || (kind === "user" && !!to)) && !!monthly && note.length <= catalog.gifts.noteMax;
  return (
    <Dialog
      title="Gift Meldiq Plus to a friend"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-mojo"
            disabled={!ready || busy}
            onClick={() =>
              void onPay({
                recipientUserId: to,
                ...(flexible ? { recipient: kind === "user" ? { kind, userId: to } : kind === "email" ? { kind, email: email.trim() } : { kind } } : {}),
                planKey,
                months,
                note,
              })
            }
          >
            {busy ? "Opening…" : monthly ? `Pay ${money(catalog.plusTerms.find((t) => t.months === months)?.amountMinor ?? monthly.amountMinor * months, monthly.currency)}` : "Not on sale yet"}
          </button>
        </>
      }
    >
      <div className="dialog-body">
        {flexible && (
          <div className="field">
            <span>Delivery</span>
            <div className="segmented" role="radiogroup" aria-label="Gift delivery">
              {(["user", "email", "link"] as const).map((k) => (
                <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)}>
                  {k === "user" ? "Friend" : k === "email" ? "Email" : "Gift link"}
                </button>
              ))}
            </div>
          </div>
        )}
        {kind === "email" && (
          <label className="field">
            <span>Recipient email</span>
            <input className="input" type="email" autoComplete="off" value={email} maxLength={254} onChange={(e) => setEmail(e.target.value)} />
            <small className="muted">They sign in with this verified email to claim it.</small>
          </label>
        )}
        {kind === "link" && <p className="muted">After payment, create a private link in Gifts. The first recipient to claim it gets the gift. Share it only with your intended recipient.</p>}
        {kind === "user" && (
          <label className="field">
            <span>Friend</span>
            {friends.loading ? (
              <span className="muted">Loading your friends…</span>
            ) : list.length === 0 ? (
              <span className="muted">Gifts go to friends. Add someone from Friends first.</span>
            ) : (
              <select className="input" value={to} onChange={(e) => setTo(e.target.value)} data-autofocus>
                <option value="">Choose a friend…</option>
                {list.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.displayName} (@{f.username})
                  </option>
                ))}
              </select>
            )}
          </label>
        )}
        <div className="field">
          <span>Plan</span>
          <div className="segmented" role="radiogroup" aria-label="Plan">
            {(["plus"] as const).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={planKey === k} onClick={() => setPlanKey(k)}>
                {PLAN_NAME[k]}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>How long</span>
          <div className="segmented" role="radiogroup" aria-label="How long">
            {catalog.gifts.months.map((m) => (
              <button key={m} type="button" role="radio" aria-checked={months === m} onClick={() => setMonths(m)}>
                {m === 12 ? "1 year" : `${m} month${m === 1 ? "" : "s"}`}
              </button>
            ))}
          </div>
        </div>
        <label className="field">
          <span>A note (optional)</span>
          <textarea className="textarea" rows={2} maxLength={catalog.gifts.noteMax} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Happy birthday!" />
          <small className="muted">The note is stored with the gift and is visible to its recipient.</small>
        </label>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          One payment, nothing renews. Your recipient chooses when to redeem it. Gift time follows existing free or paid time. With an ongoing renewal, it is kept as credit until that renewal ends.
        </p>
      </div>
    </Dialog>
  );
}

/** Gifts for you to start, and gifts you gave. */
export function GiftsReceived({ me }: { me: MojoMe }) {
  const engine = useEngine();
  const online = useOrbit((s) => s.connection === "online");
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const waiting = me.gifts.received.filter((g) => g.status === "paid");
  const sent = me.gifts.sent.filter((g) => g.status !== "failed" && g.status !== "expired");
  if (!waiting.length && !sent.length) return null;
  const start = async (id: string) => {
    setStarting(id);
    setError(null);
    try {
      const result = await engine.api.json("POST", `/v2/billing/gifts/${encodeURIComponent(id)}/redeem`, zGiftRedemption, { body: {} });
      await engine.mojo.refresh();
      engine.notice("info", result.credited ? "Gift credit saved. Your current renewal stays unchanged." : "Your gift time is ready.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start the gift.");
    } finally {
      setStarting(null);
    }
  };
  return (
    <section className="card mojo-gifts" aria-label="Gifts">
      {error && (
        <div className="banner danger" role="alert">
          {error}
        </div>
      )}
      {waiting.map((g) => (
        <div key={g.id} className="row mojo-gift-row">
          <Gift size={18} aria-hidden="true" />
          <span className="lines grow">
            <strong>
              {PLAN_NAME[g.planKey]} for {g.months === 12 ? "a year" : `${g.months} month${g.months === 1 ? "" : "s"}`}, from {g.person.name ?? "a friend"}
            </strong>
            {g.note && <small>“{g.note}”</small>}
            {me.plan !== "free" && <small className="muted">Gift time follows your existing time. An ongoing renewal keeps the gift as credit until that renewal ends.</small>}
          </span>
          <button className="btn btn-mojo btn-sm" disabled={starting !== null || !online} onClick={() => void start(g.id)}>
            {starting === g.id ? "Starting…" : "Start it"}
          </button>
        </div>
      ))}
      {sent.length > 0 && (
        <details>
          <summary>Gifts you gave ({sent.length})</summary>
          <ul className="mojo-sent">
            {sent.map((g) => (
              <li key={g.id}>
                {PLAN_NAME[g.planKey]}, {g.months} month{g.months === 1 ? "" : "s"}, to {g.person.name ?? "a friend"}:{" "}
                {g.status === "redeemed" ? "started" : g.status === "refunded" ? "refunded" : g.status === "paid" ? "waiting for them to start it" : "payment pending"}
                {g.paidAt ? `, ${relative(g.paidAt)}` : ""}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
