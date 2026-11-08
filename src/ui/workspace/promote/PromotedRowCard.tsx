import { formatUiNumber } from "../../../i18n/format";
import { useLocaleRender } from "../../../i18n/Localized";
import { text as uiText } from "../../../i18n";
import { Localized } from "../../../i18n/Localized";
import { ChartNoAxesColumn, Eye, MousePointerClick, Ticket, UserPlus } from "lucide-react";
import type { PromotedBooking, PromoteView } from "../../../api/discoverySchemas";
import { useEngine } from "../../../application/orbit";
import { bookPromoted } from "../../../sync/discovery/api";
import { PHASE_TEXT, price, recordPhase, weekText } from "../../../sync/discovery/promote";
import { Card } from "../../components/SettingsCard";
import type { PromoteBuy } from "./usePromoteBuy";
interface PromotedRowCardProps {
  orgId: string;
  view: PromoteView;
  buyer: PromoteBuy;
}
/**
 * The Promoted row (the reference's top row of Discover): what it looks like with this community in it, how many people
 * open Discover a week, the 4 spots and the weekly price, the next free week to book (or "All taken"), and this
 * community's bookings with their live views, clicks and joins.
 */
export function PromotedRowCard({ orgId, view, buyer }: PromotedRowCardProps) {
  useLocaleRender();
  const engine = useEngine();
  const p = view.promoted;
  const next = p.nextSpot;
  const full = p.allTaken || !next;
  return (
    <Card title={uiText("workspace.interface.promoted_row_e3ba790")} sub={uiText("workspace.reference.bookingTitle")}>
      <div className="promoted-offer-layout">
        <div className="promoted-facts">
          <span>
            <Eye size={16} aria-hidden />
            <Localized
              k="workspace.interface.opened_discover_this_week_3a661ff"
              slots={[
                <strong>{formatUiNumber(view.visitors.weekly)}</strong>,
                view.visitors.weekly === 1 ? uiText("organization.interface.person_38a81e8") : uiText("organization.interface.people_c902268"),
              ]}
            />
          </span>
          <span>
            <Ticket size={16} aria-hidden />
            <Localized k="workspace.interface.spots_a_week_cb642df" slots={[<strong>{formatUiNumber(p.spotsPerWeek)}</strong>]} />
          </span>
          <span>
            <ChartNoAxesColumn size={16} aria-hidden /> {uiText("workspace.reference.bookingStats")}
          </span>
        </div>
        <div className="promoted-next">
          <div className="promoted-capacity" aria-hidden>
            {Array.from({ length: p.spotsPerWeek }, (_, index) => (
              <i key={index} className={next && index < next.spotsLeft ? "open" : undefined} />
            ))}
          </div>
          <div className="promote-price">
            <Localized k="workspace.interface.week_da66b59" slots={[<strong>{price(p.weeklyCents, view.currency)}</strong>]} />
          </div>
          <span className="lines grow">
            {full ? (
              <span>
                <Localized k="workspace.interface.all_taken_for_the_next_8_weeks_b057858" />
              </span>
            ) : (
              <>
                <span>
                  <Localized k="workspace.interface.next_free_week_580b962" slots={[weekText(next.startsAt, next.endsAt)]} />
                </span>
                <small className="faint">
                  <Localized k="workspace.interface.of_spots_left_3789ae4" slots={[next.spotsLeft, p.spotsPerWeek]} />
                </small>
              </>
            )}
          </span>
          <button
            className="btn btn-primary btn-sm promote-gold-btn"
            disabled={full || !view.billing.available || buyer.comingSoon || buyer.busy !== null}
            onClick={() => next && void buyer.buy("promoted", () => bookPromoted(engine, orgId, next.startsAt))}
          >
            {full
              ? uiText("workspace.interface.all_taken_adb49c8")
              : buyer.busy === "promoted"
                ? uiText("organization.interface.opening_c926c2c")
                : uiText("workspace.interface.book_next_spot_56d44d5")}
          </button>
        </div>
      </div>
      {p.bookings.length > 0 && (
        <ul className="ws-list promoted-bookings" aria-label={uiText("workspace.interface.your_promoted_weeks_34306cc")}>
          {p.bookings.map((b) => (
            <BookingRow key={b.id} booking={b} />
          ))}
        </ul>
      )}
      <p className="faint promote-note">
        <Localized k="workspace.interface.a_week_runs_from_monday_00_00_utc_to_the_next_monday_and_you_can_c74336c" />
      </p>
    </Card>
  );
}
function BookingRow({ booking: b }: { booking: PromotedBooking }) {
  useLocaleRender();
  const phase = recordPhase(b);
  return (
    <li className="ws-row promoted-booking">
      <span className="lines grow">
        <span>{weekText(b.startsAt, b.endsAt)}</span>
        <small className={phase === "running" ? "promoted-live" : "faint"}>
          {PHASE_TEXT[phase]}
          {b.source === "grant" ? uiText("workspace.interface.from_meldiq_6cc9fb4") : ""}
        </small>
      </span>
      <span className="promoted-stats">
        <span title={uiText("workspace.interface.views_69c4045")}>
          <Eye size={13} aria-hidden="true" /> {formatUiNumber(b.views)}{" "}
          <span className="sr-only">
            <Localized k="workspace.interface.views_7488361" />
          </span>
        </span>
        <span title={uiText("workspace.interface.clicks_921fc98")}>
          <MousePointerClick size={13} aria-hidden="true" /> {formatUiNumber(b.clicks)}{" "}
          <span className="sr-only">
            <Localized k="workspace.interface.clicks_72b40fb" />
          </span>
        </span>
        <span title={uiText("workspace.interface.joins_49da3b2")}>
          <UserPlus size={13} aria-hidden="true" /> {formatUiNumber(b.joins)}{" "}
          <span className="sr-only">
            <Localized k="workspace.interface.joins_8bd0c8c" />
          </span>
        </span>
      </span>
    </li>
  );
}
