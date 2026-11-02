import { useEffect, useState } from "react";
import { z } from "zod";
import { useEngine, useOrbit } from "../../application/orbit";
import { Dialog } from "../components/Overlay";
import { AccountSafetyApi } from "../../sync/accountSafety";
const Notice = z.object({ id: z.string(), title: z.string(), body: z.string(), read: z.boolean() });
const Appeal = z.object({ id: z.string(), subject: z.string(), body: z.string(), status: z.string(), decision: z.string().nullable() });
const Ownership = z.object({ id: z.string(), org_id: z.string(), target_user_id: z.string(), expires_at: z.number() });
const Purchase = z.object({ id: z.string(), itemId: z.string(), amountMinor: z.number(), currency: z.string(), status: z.string(), fulfillment: z.string(), url: z.string().nullable() });
const lists = {
  notices: z.object({ items: z.array(Notice) }),
  appeals: z.object({ items: z.array(Appeal) }),
  ownership: z.object({ items: z.array(Ownership) }),
  purchases: z.object({ items: z.array(Purchase) }),
};
export function PlatformInbox() {
  const engine = useEngine(),
    enabled = useOrbit((s) => s.server?.features.includes("platform-operations") ?? false),
    [open, setOpen] = useState(false),
    [count, setCount] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const refresh = () =>
      engine.api
        .json("GET", "/v2/platform/notices", lists.notices)
        .then((x) => {
          if (active) setCount(x.items.filter((n) => !n.read).length);
        })
        .catch(() => undefined);
    void refresh();
    const timer = setInterval(() => void refresh(), 60000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [engine, enabled]);
  if (!enabled) return null;
  return (
    <>
      <div style={{ padding: "6px 14px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "flex-end" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
          Service inbox{count ? ` (${count})` : ""}
        </button>
      </div>
      {open && <Inbox onClose={() => setOpen(false)} onRead={() => setCount((n) => Math.max(0, n - 1))} />}
    </>
  );
}
function Inbox({ onClose, onRead }: { onClose: () => void; onRead: () => void }) {
  const engine = useEngine(),
    [notices, setNotices] = useState<z.infer<typeof Notice>[]>([]),
    [appeals, setAppeals] = useState<z.infer<typeof Appeal>[]>([]),
    [ownership, setOwnership] = useState<z.infer<typeof Ownership>[]>([]),
    [purchases, setPurchases] = useState<z.infer<typeof Purchase>[]>([]),
    [warnings, setWarnings] = useState<{ id: string; reason: string }[]>([]),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [version, setVersion] = useState(0),
    [form, setForm] = useState({ subject: "", body: "", noticeId: "" }),
    [code, setCode] = useState(""),
    [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    Promise.all([
      engine.api.json("GET", "/v2/platform/notices", lists.notices),
      engine.api.json("GET", "/v2/platform/appeals", lists.appeals),
      engine.api.json("GET", "/v2/platform/ownership", lists.ownership),
      engine.api.json("GET", "/v2/collectible-purchases", lists.purchases),
      new AccountSafetyApi(engine.api).standing(),
    ])
      .then(([n, a, o, p, w]) => {
        if (active) {
          setNotices(n.items);
          setAppeals(a.items);
          setOwnership(o.items);
          setPurchases(p.items);
          setWarnings(w.warnings);
        }
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [engine, version]);
  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
      setVersion((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "This request failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog title="Service inbox" onClose={onClose} wide>
      <div className="dialog-body" style={{ display: "grid", gap: 20 }}>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <section>
          <h3>Announcements</h3>
          {!notices.length && <p className="faint">No active announcements.</p>}
          {notices.map((n) => (
            <article key={n.id}>
              <h4>{n.title}</h4>
              <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{n.body}</p>
              {!n.read && (
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await engine.api.json("POST", `/v2/platform/notices/${n.id}/read`, z.unknown());
                      onRead();
                    })
                  }
                >
                  Mark read
                </button>
              )}
            </article>
          ))}
        </section>
        <section>
          <h3>Warnings & appeals</h3>
          {warnings.map((w) => (
            <p key={w.id}>
              {w.reason}{" "}
              <button className="btn btn-ghost btn-sm" onClick={() => setForm({ ...form, noticeId: w.id, subject: "Appeal account warning" })}>
                Appeal warning
              </button>
            </p>
          ))}
          <form
            style={{ display: "grid", gap: 10 }}
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await engine.api.json("POST", "/v2/platform/appeals", z.unknown(), { body: { ...form, noticeId: form.noticeId || null } });
                setMessage("Your appeal was submitted. Its decision will appear here.");
                setForm({ subject: "", body: "", noticeId: "" });
              });
            }}
          >
            <label>
              Appeal subject
              <input className="input" required minLength={3} maxLength={120} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            </label>
            <label>
              Context for your appeal
              <textarea className="textarea" required minLength={10} maxLength={4000} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
            </label>
            <button className="btn btn-secondary" disabled={busy} type="submit">
              Submit appeal
            </button>
          </form>
          {appeals.map((a) => (
            <article key={a.id}>
              <h4>
                {a.subject} · {a.status}
              </h4>
              <p>{a.decision ?? "Waiting for review"}</p>
            </article>
          ))}
        </section>
        <section>
          <h3>Redeem Plus promotion</h3>
          <form
            style={{ display: "flex", gap: 10, flexWrap: "wrap" }}
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await engine.api.json("POST", "/v2/platform/promotions/redeem", z.unknown(), { body: { code } });
                setMessage("Plus promotion redeemed. Your account entitlements have been updated.");
              });
            }}
          >
            <label>
              Promotion code
              <input className="input" required minLength={4} maxLength={32} value={code} onChange={(e) => setCode(e.target.value)} />
            </label>
            <button className="btn btn-secondary" type="submit" disabled={busy}>
              Redeem code
            </button>
          </form>
        </section>
        <section>
          <h3>Ownership approvals</h3>
          {!ownership.length && <p className="faint">No pending ownership requests.</p>}
          {ownership.map((o) => (
            <OwnerApproval
              key={o.id}
              request={o}
              approve={(name) =>
                run(async () => {
                  await engine.api.json("POST", `/v2/platform/ownership/${o.id}/approve`, z.unknown(), { body: { confirmName: name } });
                  setMessage("Ownership transferred to the approved member.");
                })
              }
              busy={busy}
            />
          ))}
        </section>
        <section>
          <h3>Collectible purchases</h3>
          {!purchases.length && <p className="faint">No collectible purchases.</p>}
          {purchases.map((p) => (
            <article key={p.id}>
              <p>
                {p.itemId} · {(p.amountMinor / 100).toFixed(2)} {p.currency} · {p.status} · {p.fulfillment}
              </p>
              {p.status === "pending" && (
                <>
                  <CheckoutLink url={p.url} />
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await engine.api.json("POST", `/v2/collectible-purchases/${p.id}/confirm`, z.unknown());
                      })
                    }
                  >
                    Check payment
                  </button>
                </>
              )}
            </article>
          ))}
        </section>
        {message && <p role="status">{message}</p>}
      </div>
    </Dialog>
  );
}
function OwnerApproval({ request, approve, busy }: { request: z.infer<typeof Ownership>; approve: (name: string) => Promise<void>; busy: boolean }) {
  const [name, setName] = useState("");
  return (
    <form
      style={{ display: "grid", gap: 8 }}
      onSubmit={(e) => {
        e.preventDefault();
        void approve(name);
      }}
    >
      <p>
        Transfer {request.org_id} to {request.target_user_id}. Your owner role will become administrator. This request expires {new Date(request.expires_at).toLocaleString()}.
      </p>
      <label>
        Exact community name
        <input className="input" required value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <button className="btn btn-danger" disabled={busy} type="submit">
        Approve ownership transfer
      </button>
    </form>
  );
}
export function CheckoutLink({ url }: { url: string | null }) {
  if (!url) return null;
  let safe = false;
  try {
    const u = new URL(url);
    safe = u.protocol === "https:" && !u.username && !u.password;
  } catch {
    /* invalid URL is not navigable */
  }
  return safe ? (
    <a className="btn btn-primary" href={url} target="_blank" rel="noopener noreferrer">
      Continue hosted payment
    </a>
  ) : null;
}
export function PurchaseCollectible({ itemId, price, onOwned }: { itemId: string; price: number; onOwned: () => void }) {
  const engine = useEngine(),
    [purchase, setPurchase] = useState<z.infer<typeof Purchase> | null>(null),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [capable, setCapable] = useState(false),
    [discountCode, setDiscountCode] = useState(""),
    [key] = useState(() => crypto.randomUUID());
  useEffect(() => {
    let active = true;
    engine.api
      .json("GET", "/v2/collectible-purchases", lists.purchases.extend({ capability: z.object({ checkout: z.boolean() }) }))
      .then((r) => {
        if (active) {
          setCapable(r.capability.checkout);
          setPurchase(r.items.find((p) => p.itemId === itemId && p.status === "pending") ?? null);
        }
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [engine, itemId]);
  const run = async (confirm = false) => {
    setBusy(true);
    setError(null);
    try {
      const r =
        confirm && purchase
          ? await engine.api.json("POST", `/v2/collectible-purchases/${purchase.id}/confirm`, Purchase)
          : await engine.api.json("POST", "/v2/collectible-purchases", Purchase, { body: { itemId, requestKey: key, ...(discountCode.trim() ? { promotionCode: discountCode.trim() } : {}) } });
      setPurchase(r);
      if (r.status === "paid" && r.fulfillment === "complete") onOwned();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      {error && <p role="alert">{error}</p>}
      {!purchase ? (
        <>
          <label>
            Optional collectible discount code
            <input className="input" maxLength={32} value={discountCode} onChange={(e) => setDiscountCode(e.target.value)} />
          </label>
          <button className="btn btn-primary" disabled={busy || !capable} onClick={() => void run()}>
            Checkout · list price ${(price / 100).toFixed(2)} USD
          </button>
        </>
      ) : (
        <>
          <CheckoutLink url={purchase.url} />
          <button className="btn btn-secondary" disabled={busy} onClick={() => void run(true)}>
            Check payment
          </button>
          <small>
            {purchase.status} · {purchase.fulfillment}
          </small>
        </>
      )}
      {!capable && <small>Hosted checkout is unavailable with the current payment provider.</small>}
    </div>
  );
}
