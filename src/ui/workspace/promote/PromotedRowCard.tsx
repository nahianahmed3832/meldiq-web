import { CalendarPlus, Eye, MousePointerClick, UserPlus } from "lucide-react";
import type { PromotedBooking, PromoteView } from "../../../api/discoverySchemas";
import { useEngine } from "../../../application/orbit";
import { bookPromoted } from "../../../sync/discovery/api";
import { PHASE_TEXT, price, recordPhase, weekText } from "../../../sync/discovery/promote";
import { OrgAvatar } from "../../components/OrgAvatar";
import { Card } from "../WorkspaceView";
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
  const engine = useEngine();
  const p = view.promoted;
  const next = p.nextSpot;
  const full = p.allTaken || !next;
  return (
    <Card title="Promoted row" sub="The first thing everyone sees in Discover: a row of communities with a PROMOTED tag, above the whole list.">
      <div className="promoted-preview" aria-hidden="true">
        <span className="promoted-slot promoted-slot-own">
          <OrgAvatar orgId={orgId} name={name} photoRev={photoRev} size={28} />
          <span className="ellipsis">{name}</span>
          <span className="discover-label discover-label-promoted">PROMOTED</span>
        </span>
        {Array.from({ length: Math.max(p.spotsPerWeek - 1, 0) }, (_, i) => (
          <span key={i} className="promoted-slot" />
        ))}
      </div>
      <div className="promoted-facts">
        <span>
          <strong>{view.visitors.weekly}</strong> {view.visitors.weekly === 1 ? "person" : "people"} opened Discover this week
        </span>
        <span>
          <strong>{p.spotsPerWeek}</strong> spots a week
        </span>
        <span>
          <strong>{price(p.weeklyCents, view.currency)}</strong> / week
        </span>
      </div>
      <div className="ws-row promoted-next">
        <CalendarPlus size={18} className="faint" aria-hidden="true" />
        <span className="lines grow">
          {full ? (
            <span>All taken for the next 8 weeks.</span>
          ) : (
            <>
              <span>Next free week: {weekText(next.startsAt, next.endsAt)}</span>
              <small className="faint">
                {next.spotsLeft} of {p.spotsPerWeek} spots left
              </small>
            </>
          )}
        </span>
        <button className="btn btn-primary btn-sm" disabled={full || buyer.busy !== null} onClick={() => next && void buyer.buy("promoted", () => bookPromoted(engine, orgId, next.startsAt))}>
          {full ? "All taken" : buyer.busy === "promoted" ? "Opening…" : "Book next spot"}
        </button>
      </div>
      {p.bookings.length > 0 && (
        <ul className="ws-list promoted-bookings" aria-label="Your Promoted weeks">
          {p.bookings.map((b) => (
            <BookingRow key={b.id} booking={b} />
          ))}
        </ul>
      )}
      <p className="faint promote-note">
        A week runs from Monday 00:00 UTC to the next Monday, and you can book up to 8 weeks ahead. Views, clicks and joins count while your week runs. A community that's locked, made private or taken
        out of Discover stops showing, and nothing is refunded.
      </p>
    </Card>
  );
}

function BookingRow({ booking: b }: { booking: PromotedBooking }) {
  const phase = recordPhase(b);
  return (
    <li className="ws-row promoted-booking">
      <span className="lines grow">
        <span>{weekText(b.startsAt, b.endsAt)}</span>
        <small className={phase === "running" ? "promoted-live" : "faint"}>
          {PHASE_TEXT[phase]}
          {b.source === "grant" ? " · from Meldiq" : ""}
        </small>
      </span>
      <span className="promoted-stats">
        <span title="Views">
          <Eye size={13} aria-hidden="true" /> {b.views} <span className="sr-only">views</span>
        </span>
        <span title="Clicks">
          <MousePointerClick size={13} aria-hidden="true" /> {b.clicks} <span className="sr-only">clicks</span>
        </span>
        <span title="Joins">
          <UserPlus size={13} aria-hidden="true" /> {b.joins} <span className="sr-only">joins</span>
        </span>
      </span>
    </li>
  );
}
