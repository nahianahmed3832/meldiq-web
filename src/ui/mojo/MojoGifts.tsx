import { Gift } from "lucide-react";
import { useState } from "react";
import type { MojoCatalog, MojoMe } from "../../api/mojoSchemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { connections } from "../../sync/social";
import { Dialog } from "../components/Overlay";
import { relative } from "../format";
import { useLoad } from "../workspace/useLoad";
import { money } from "./mojoFormat";

const PLAN_NAME = { go: "Mojo Go", plus: "Mojo Plus" } as const;

/**
 * Buying Mojo for a friend (server docs/MOJO.md › Gifts): one payment, for 1, 3 or 12 months, priced by the server. The
 * friend chooses when to start it; nothing renews. Only friends are offered (the server checks again).
 */
export function GiftDialog({
  catalog,
  onClose,
  onPay,
  busy,
}: {
  catalog: MojoCatalog;
  onClose: () => void;
  onPay: (input: { recipientUserId: string; planKey: "go" | "plus"; months: number; note: string }) => Promise<void>;
  busy: boolean;
}) {
  const engine = useEngine();
  const friends = useLoad(() => connections(engine), [engine]);
  const [to, setTo] = useState("");
  const [planKey, setPlanKey] = useState<"go" | "plus">("plus");
  const [months, setMonths] = useState(catalog.gifts.months[0] ?? 1);
  const [note, setNote] = useState("");
  const monthly = catalog.onSale[planKey];
  const list = friends.data?.connected ?? [];
  const ready = !!to && !!monthly && note.length <= catalog.gifts.noteMax;
  return (
    <Dialog
      title="Gift Mojo to a friend"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-mojo" disabled={!ready || busy} onClick={() => void onPay({ recipientUserId: to, planKey, months, note })}>
            {busy ? "Opening…" : monthly ? `Pay ${money(monthly.amountMinor * months, monthly.currency)}` : "Not on sale yet"}
          </button>
        </>
      }
    >
      <div className="dialog-body">
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
        <div className="field">
          <span>Plan</span>
          <div className="segmented" role="radiogroup" aria-label="Plan">
            {(["go", "plus"] as const).map((k) => (
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
          <small className="muted">The note is sent with the gift. It isn't end-to-end encrypted like your messages.</small>
        </label>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          One payment, nothing renews. Your friend starts it when they like. If they already have free Mojo time, the gift follows on after it.
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
      await engine.mojo.redeemGift(id);
      engine.notice("info", "Your gift has started.");
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
            {me.plan !== "free" && <small className="muted">You already have {me.perks.name}: starting it now runs at the same time as what you pay for.</small>}
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
