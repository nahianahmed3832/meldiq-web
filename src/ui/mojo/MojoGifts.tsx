import { formatUnit } from "../../i18n/format";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
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
const PLAN_NAME = {
  get go() {
    return uiText("billing.interface.legacy_go_5f17a0c");
  },
  plus: "Meldiq Plus",
} as const;
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
  useLocaleRender();
  const l10n = useLocalization();
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
      title={uiText("billing.interface.gift_meldiq_plus_to_a_friend_bce5bc8")}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            {l10n("common.actions.cancel")}
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
            {busy
              ? uiText("organization.interface.opening_c926c2c")
              : monthly
                ? uiText("billing.interface.pay_value0_846a01a", { value0: money(catalog.plusTerms.find((t) => t.months === months)?.amountMinor ?? monthly.amountMinor * months, monthly.currency) })
                : uiText("billing.interface.not_on_sale_yet_b2d293b")}
          </button>
        </>
      }
    >
      <div className="dialog-body">
        {flexible && (
          <div className="field">
            <span>
              <Localized k="billing.interface.delivery_52bfe58" />
            </span>
            <div className="segmented" role="radiogroup" aria-label={uiText("billing.interface.gift_delivery_66f505b")}>
              {(["user", "email", "link"] as const).map((k) => (
                <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)}>
                  {k === "user" ? uiText("billing.interface.friend_acd8f66") : k === "email" ? uiText("auth.email") : uiText("billing.interface.gift_link_5c7466d")}
                </button>
              ))}
            </div>
          </div>
        )}
        {kind === "email" && (
          <label className="field">
            <span>
              <Localized k="billing.interface.recipient_email_df5643c" />
            </span>
            <input className="input" type="email" autoComplete="off" value={email} maxLength={254} onChange={(e) => setEmail(e.target.value)} />
            <small className="muted">
              <Localized k="billing.interface.they_sign_in_with_this_verified_email_to_claim_it_e7dcc4c" />
            </small>
          </label>
        )}
        {kind === "link" && (
          <p className="muted">
            <Localized k="billing.interface.after_payment_create_a_private_link_in_gifts_the_first_recipient_3cded10" />
          </p>
        )}
        {kind === "user" && (
          <label className="field">
            <span>
              <Localized k="billing.interface.friend_acd8f66" />
            </span>
            {friends.loading ? (
              <span className="muted">
                <Localized k="billing.interface.loading_your_friends_ad3e395" />
              </span>
            ) : list.length === 0 ? (
              <span className="muted">
                <Localized k="billing.interface.gifts_go_to_friends_add_someone_from_friends_first_fe53e50" />
              </span>
            ) : (
              <select className="input" value={to} onChange={(e) => setTo(e.target.value)} data-autofocus>
                <option value="">
                  <Localized k="billing.interface.choose_a_friend_4e6293d" />
                </option>
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
          <span>
            <Localized k="billing.interface.plan_fa8ed0b" />
          </span>
          <div className="segmented" role="radiogroup" aria-label={uiText("billing.interface.plan_fa8ed0b")}>
            {(["plus"] as const).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={planKey === k} onClick={() => setPlanKey(k)}>
                {PLAN_NAME[k]}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>
            <Localized k="billing.interface.how_long_8ddab05" />
          </span>
          <div className="segmented" role="radiogroup" aria-label={uiText("billing.interface.how_long_8ddab05")}>
            {catalog.gifts.months.map((m) => (
              <button key={m} type="button" role="radio" aria-checked={months === m} onClick={() => setMonths(m)}>
                {m === 12 ? formatUnit(1, "year") : formatUnit(m, "month")}
              </button>
            ))}
          </div>
        </div>
        <label className="field">
          <span>
            <Localized k="billing.interface.a_note_optional_34f803d" />
          </span>
          <textarea
            className="textarea"
            rows={2}
            maxLength={catalog.gifts.noteMax}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={uiText("billing.interface.happy_birthday_6468360")}
          />
          <small className="muted">
            <Localized k="billing.interface.the_note_is_stored_with_the_gift_and_is_visible_to_its_recipient_dca3d60" />
          </small>
        </label>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          <Localized k="billing.interface.one_payment_nothing_renews_your_recipient_chooses_when_to_redeem_3c6280e" />
        </p>
      </div>
    </Dialog>
  );
}
/** Gifts for you to start, and gifts you gave. */
export function GiftsReceived({ me }: { me: MojoMe }) {
  useLocaleRender();
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
      engine.notice("info", result.credited ? uiText("billing.interface.gift_credit_saved_your_current_renewal_stays_unchanged_af21eac") : uiText("billing.interface.your_gift_time_is_ready_9cf33ac"));
    } catch (e) {
      setError(e instanceof Error ? e.message : uiText("billing.interface.couldn_t_start_the_gift_5df0cf7"));
    } finally {
      setStarting(null);
    }
  };
  return (
    <section className="card mojo-gifts" aria-label={uiText("workspace.interface.gifts_67a025d")}>
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
              <Localized
                k="billing.interface.for_from_d903bfe"
                slots={[
                  PLAN_NAME[g.planKey],
                  g.months === 12 ? uiText("billing.interface.a_year_54526b8") : formatUnit(g.months, "month"),
                  g.person.name ?? uiText("billing.interface.a_friend_908d415"),
                ]}
              />
            </strong>
            {g.note && <small>“{g.note}”</small>}
            {me.plan !== "free" && (
              <small className="muted">
                <Localized k="billing.interface.gift_time_follows_your_existing_time_an_ongoing_renewal_keeps_the_f4d9e38" />
              </small>
            )}
          </span>
          <button className="btn btn-mojo btn-sm" disabled={starting !== null || !online} onClick={() => void start(g.id)}>
            {starting === g.id ? uiText("organization.interface.starting_bbe5fc3") : uiText("billing.interface.start_it_4238a07")}
          </button>
        </div>
      ))}
      {sent.length > 0 && (
        <details>
          <summary>
            <Localized k="billing.interface.gifts_you_gave_4b5053a" slots={[sent.length]} />
          </summary>
          <ul className="mojo-sent">
            {sent.map((g) => (
              <li key={g.id}>
                <Localized
                  k="billing.interface.native_count_2016daf24"
                  slots={[
                    PLAN_NAME[g.planKey],
                    formatUnit(g.months, "month"),
                    "",
                    g.person.name ?? uiText("billing.interface.a_friend_908d415"),
                    g.status === "redeemed"
                      ? uiText("billing.interface.started_03494af")
                      : g.status === "refunded"
                        ? uiText("billing.interface.refunded_fed1ce9")
                        : g.status === "paid"
                          ? uiText("billing.interface.waiting_for_them_to_start_it_534a473")
                          : uiText("billing.interface.payment_pending_c44152b"),
                    g.paidAt ? uiText("billing.interface.value0_bcb8832", { value0: relative(g.paidAt) }) : "",
                  ]}
                />
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
