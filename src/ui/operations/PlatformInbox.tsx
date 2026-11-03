import { operationState } from "../../i18n/billing";
import { formatCurrency, formatNumber, interfaceLocale } from "../../i18n/format";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
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
  useLocaleRender();
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
      <div className="standing-inbox">
        <button className="btn btn-secondary btn-sm" onClick={() => setOpen(true)}>
          <Localized k="workspace.interface.service_inbox_5ba678b" slots={[count ? uiText("workspace.interface.value0_c9bd7bc", { value0: count }) : ""]} />
        </button>
      </div>
      {open && <Inbox onClose={() => setOpen(false)} onRead={() => setCount((n) => Math.max(0, n - 1))} />}
    </>
  );
}
function Inbox({ onClose, onRead }: { onClose: () => void; onRead: () => void }) {
  useLocaleRender();
  const engine = useEngine(),
    [notices, setNotices] = useState<z.infer<typeof Notice>[]>([]),
    [appeals, setAppeals] = useState<z.infer<typeof Appeal>[]>([]),
    [ownership, setOwnership] = useState<z.infer<typeof Ownership>[]>([]),
    [purchases, setPurchases] = useState<z.infer<typeof Purchase>[]>([]),
    [warnings, setWarnings] = useState<
      {
        id: string;
        reason: string;
      }[]
    >([]),
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
      setError(e instanceof Error ? e.message : uiText("workspace.interface.this_request_failed_1e9a931"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog title={uiText("workspace.interface.service_inbox_08b3625")} onClose={onClose} wide>
      <div className="dialog-body" style={{ display: "grid", gap: 20 }}>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <section>
          <h3>
            <Localized k="workspace.interface.announcements_fe02680" />
          </h3>
          {!notices.length && (
            <p className="faint">
              <Localized k="workspace.interface.no_active_announcements_0f483ba" />
            </p>
          )}
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
                  <Localized k="workspace.interface.mark_read_b49c9b6" />
                </button>
              )}
            </article>
          ))}
        </section>
        <section>
          <h3>
            <Localized k="workspace.interface.warnings_appeals_38b4e6b" />
          </h3>
          {warnings.map((w) => (
            <p key={w.id}>
              {w.reason}{" "}
              <button className="btn btn-ghost btn-sm" onClick={() => setForm({ ...form, noticeId: w.id, subject: "Appeal account warning" })}>
                <Localized k="workspace.interface.appeal_warning_81676a8" />
              </button>
            </p>
          ))}
          <form
            style={{ display: "grid", gap: 10 }}
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await engine.api.json("POST", "/v2/platform/appeals", z.unknown(), { body: { ...form, noticeId: form.noticeId || null } });
                setMessage(uiText("workspace.interface.your_appeal_was_submitted_its_decision_will_appear_here_7e0ca63"));
                setForm({ subject: "", body: "", noticeId: "" });
              });
            }}
          >
            <label>
              <Localized k="workspace.interface.appeal_subject_d44c7b4" />
              <input className="input" required minLength={3} maxLength={120} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            </label>
            <label>
              <Localized k="workspace.interface.context_for_your_appeal_36f4af2" />
              <textarea className="textarea" required minLength={10} maxLength={4000} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
            </label>
            <button className="btn btn-secondary" disabled={busy} type="submit">
              <Localized k="workspace.interface.submit_appeal_86efa24" />
            </button>
          </form>
          {appeals.map((a) => (
            <article key={a.id}>
              <h4>
                {a.subject} · {operationState(a.status)}
              </h4>
              <p>{a.decision ?? uiText("settings.interface.waiting_for_review_a61935d")}</p>
            </article>
          ))}
        </section>
        <section>
          <h3>
            <Localized k="workspace.interface.redeem_plus_promotion_542bdb6" />
          </h3>
          <form
            style={{ display: "flex", gap: 10, flexWrap: "wrap" }}
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await engine.api.json("POST", "/v2/platform/promotions/redeem", z.unknown(), { body: { code } });
                setMessage(uiText("workspace.interface.plus_promotion_redeemed_your_account_entitlements_have_been_updated_6f0caf9"));
              });
            }}
          >
            <label>
              <Localized k="workspace.interface.promotion_code_a697d39" />
              <input className="input" required minLength={4} maxLength={32} value={code} onChange={(e) => setCode(e.target.value)} />
            </label>
            <button className="btn btn-secondary" type="submit" disabled={busy}>
              <Localized k="workspace.interface.redeem_code_9dc3882" />
            </button>
          </form>
        </section>
        <section>
          <h3>
            <Localized k="workspace.interface.ownership_approvals_ba271b1" />
          </h3>
          {!ownership.length && (
            <p className="faint">
              <Localized k="workspace.interface.no_pending_ownership_requests_ef1f439" />
            </p>
          )}
          {ownership.map((o) => (
            <OwnerApproval
              key={o.id}
              request={o}
              approve={(name) =>
                run(async () => {
                  await engine.api.json("POST", `/v2/platform/ownership/${o.id}/approve`, z.unknown(), { body: { confirmName: name } });
                  setMessage(uiText("workspace.interface.ownership_transferred_to_the_approved_member_df1781f"));
                })
              }
              busy={busy}
            />
          ))}
        </section>
        <section>
          <h3>
            <Localized k="workspace.interface.collectible_purchases_a0a4e15" />
          </h3>
          {!purchases.length && (
            <p className="faint">
              <Localized k="workspace.interface.no_collectible_purchases_7fb610e" />
            </p>
          )}
          {purchases.map((p) => (
            <article key={p.id}>
              <p>
                {p.itemId} · {formatCurrency(p.amountMinor / 100, p.currency)} · {operationState(p.status)} · {operationState(p.fulfillment)}
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
                    <Localized k="workspace.interface.check_payment_1b4c88a" />
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
  useLocaleRender();
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
        <Localized
          k="workspace.interface.transfer_to_your_owner_role_will_become_administrator_this_reques_afb89e6"
          slots={[request.org_id, request.target_user_id, new Date(request.expires_at).toLocaleString(interfaceLocale())]}
        />
      </p>
      <label>
        <Localized k="workspace.interface.exact_community_name_9ea414b" />
        <input className="input" required value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <button className="btn btn-danger" disabled={busy} type="submit">
        <Localized k="workspace.interface.approve_ownership_transfer_3534d7f" />
      </button>
    </form>
  );
}
export function CheckoutLink({ url }: { url: string | null }) {
  useLocaleRender();
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
      <Localized k="workspace.interface.continue_hosted_payment_1ff4ed5" />
    </a>
  ) : null;
}
export function PurchaseCollectible({ itemId, price, onOwned }: { itemId: string; price: number; onOwned: () => void }) {
  useLocaleRender();
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
      setError(e instanceof Error ? e.message : uiText("workspace.interface.checkout_failed_40fd8ea"));
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
            <Localized k="workspace.interface.optional_collectible_discount_code_72d522b" />
            <input className="input" maxLength={32} value={discountCode} onChange={(e) => setDiscountCode(e.target.value)} />
          </label>
          <button className="btn btn-primary" disabled={busy || !capable} onClick={() => void run()}>
            <Localized k="workspace.interface.checkout_list_price_usd_ca28d3b" slots={[formatNumber(price / 100, { minimumFractionDigits: 2, maximumFractionDigits: 2 })]} />
          </button>
        </>
      ) : (
        <>
          <CheckoutLink url={purchase.url} />
          <button className="btn btn-secondary" disabled={busy} onClick={() => void run(true)}>
            <Localized k="workspace.interface.check_payment_1b4c88a" />
          </button>
          <small>
            {operationState(purchase.status)} · {operationState(purchase.fulfillment)}
          </small>
        </>
      )}
      {!capable && (
        <small>
          <Localized k="workspace.interface.hosted_checkout_is_unavailable_with_the_current_payment_provider_77cd08c" />
        </small>
      )}
    </div>
  );
}
