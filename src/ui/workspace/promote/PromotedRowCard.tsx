import { formatUiNumber } from "../../../i18n/format";
import { useLocaleRender } from "../../../i18n/Localized";
import { text as uiText } from "../../../i18n";
import { Localized } from "../../../i18n/Localized";
import { useT as useLocalization } from "../../../i18n";
import { CalendarPlus, Eye, MousePointerClick, UserPlus } from "lucide-react";
import type { PromotedBooking, PromoteView } from "../../../api/discoverySchemas";
import { useEngine } from "../../../application/orbit";
import { bookPromoted } from "../../../sync/discovery/api";
import { PHASE_TEXT, price, recordPhase, weekText } from "../../../sync/discovery/promote";
import { OrgAvatar } from "../../components/OrgAvatar";
import { Card } from "../../components/SettingsCard";
import type { PromoteBuy } from "./usePromoteBuy";
interface PromotedRowCardProps {
  orgId: string;
  name: string;
  photoRev: number | null;
  view: PromoteView;
  buyer: PromoteBuy;
}
/**
 * The Promoted row (the reference's top row of Discover): what it looks like with this community in it, how many people
 * open Discover a week, the 4 spots and the weekly price, the next free week to book (or "All taken"), and this
 * community's bookings with their live views, clicks and joins.
 */
export function PromotedRowCard({ orgId, name, photoRev, view, buyer }: PromotedRowCardProps) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const p = view.promoted;
  const next = p.nextSpot;
  const full = p.allTaken || !next;
  return (
    <Card title={uiText("workspace.interface.promoted_row_e3ba790")} sub={uiText("workspace.interface.the_first_thing_everyone_sees_in_discover_a_row_of_communities_wi_3675953")}>
      <div className="promoted-preview" aria-hidden="true">
        <span className="promoted-slot promoted-slot-own">
          <OrgAvatar orgId={orgId} name={name} photoRev={photoRev} size={28} />
          <span className="ellipsis">{name}</span>
          <span className="discover-label discover-label-promoted">{l10n("workspace.discover_label_promoted")}</span>
        </span>
        {Array.from({ length: Math.max(p.spotsPerWeek - 1, 0) }, (_, i) => (
          <span key={i} className="promoted-slot" />
        ))}
      </div>
      <div className="promoted-facts">
        <span>
          <Localized
            k="workspace.interface.opened_discover_this_week_3a661ff"
            slots={[
              <strong>{formatUiNumber(view.visitors.weekly)}</strong>,
              view.visitors.weekly === 1 ? uiText("organization.interface.person_38a81e8") : uiText("organization.interface.people_c902268"),
            ]}
          />
        </span>
        <span>
          <Localized k="workspace.interface.spots_a_week_cb642df" slots={[<strong>{formatUiNumber(p.spotsPerWeek)}</strong>]} />
        </span>
        <span>
          <Localized k="workspace.interface.week_da66b59" slots={[<strong>{price(p.weeklyCents, view.currency)}</strong>]} />
        </span>
      </div>
      <div className="ws-row promoted-next">
        <CalendarPlus size={18} className="faint" aria-hidden="true" />
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
        <button className="btn btn-primary btn-sm" disabled={full || buyer.busy !== null} onClick={() => next && void buyer.buy("promoted", () => bookPromoted(engine, orgId, next.startsAt))}>
          {full ? uiText("workspace.interface.all_taken_adb49c8") : buyer.busy === "promoted" ? uiText("organization.interface.opening_c926c2c") : uiText("workspace.interface.book_next_spot_56d44d5")}
        </button>
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
