import { CalendarCheck, Flame, MessageSquare, UserPlus } from "lucide-react";
import type { Points } from "../../sync/points";
import { relative } from "../format";
import { EARN, historyLabel, signed, streakInWeek } from "./pointsWords";

const DAY_MS = 86_400_000;

/** One way to earn: what it pays, and where you stand today. */
function Way({ icon, title, pays, now }: { icon: React.ReactNode; title: string; pays: string; now: React.ReactNode }) {
  return (
    <li className="earn-way">
      <span className="earn-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="lines grow">
        <strong>{title}</strong>
        <small className="faint">{pays}</small>
        <small>{now}</small>
      </span>
    </li>
  );
}

/**
 * Settings › Points › ways to earn and history (API 0.65.0): the daily visit, chatting (with today's minutes), the
 * 7-day streak and invites (paid, waiting, and this month's cap), then the last 50 changes.
 */
export function PointsEarn({ points, mode = "all" }: { points: Points; mode?: "ways" | "history" | "all" }) {
  const dayStart = points.resetsAt - DAY_MS;
  const visited = points.history.some((h) => h.kind === "visit" && h.at >= dayStart);
  const inWeek = streakInWeek(points.streak);
  const boosted = points.multiplier > 1 ? ` (×${points.multiplier} with your plan)` : "";
  const inv = points.invites;
  return (
    <>
      {mode !== "history" && (
        <section className="card points-card" aria-labelledby="pts-earn">
          <div className="points-card-head">
            <h3 id="pts-earn">Ways to earn</h3>
            {boosted && <small className="faint">Your plan gives {points.multiplier}× on everything you earn</small>}
          </div>
          <ul className="earn-ways">
            <Way
              icon={<CalendarCheck size={18} />}
              title="Daily visit"
              pays={`+${EARN.visit} the first time you open Meldiq each day (UTC)${boosted}`}
              now={visited ? "Counted today" : "Not counted yet today"}
            />
            <Way
              icon={<MessageSquare size={18} />}
              title="Chatting"
              pays={`+${EARN.chatPoints} for every ${EARN.chatMinutes} minutes you send messages, up to ${points.chatDailyCap} a day`}
              now={`${points.chatMinutesToday} active ${points.chatMinutesToday === 1 ? "minute" : "minutes"} today · ${points.chatPointsToday} of ${points.chatDailyCap} Embers`}
            />
            <Way
              icon={<Flame size={18} />}
              title={`${EARN.streakDays}-day streak`}
              pays={`+${EARN.streak} every ${EARN.streakDays}th day in a row you visit${boosted}`}
              now={
                <span className="streak-track" aria-label={`${points.streak}-day streak`}>
                  {Array.from({ length: EARN.streakDays }, (_, i) => (
                    <span key={i} className={`streak-day${i < inWeek ? " on" : ""}`} aria-hidden="true" />
                  ))}
                  <span>{points.streak === 1 ? "1 day" : `${points.streak} days`}</span>
                </span>
              }
            />
            <Way
              icon={<UserPlus size={18} />}
              title="Invites"
              pays={`+${EARN.invite} when someone joins a community through your invite and stays ${EARN.inviteDays} days, up to ${inv.monthlyLimit} a month`}
              now={`${inv.credited} paid · ${inv.pending} waiting · ${inv.creditedThisMonth} of ${inv.monthlyLimit} this month`}
            />
          </ul>
        </section>
      )}

      {mode !== "ways" && (
        <section className="card points-card" aria-labelledby="pts-history">
          <div className="points-card-head">
            <h3 id="pts-history">History</h3>
          </div>
          {points.history.length === 0 ? (
            <p className="faint" style={{ margin: 0 }}>
              Nothing yet. What you earn and spend shows up here.
            </p>
          ) : (
            <ul className="points-history">
              {points.history.map((h) => (
                <li key={`${h.at}-${h.kind}-${h.detail ?? ""}`}>
                  <span className="grow ellipsis">{historyLabel(h)}</span>
                  <small className="faint">{relative(h.at)}</small>
                  <strong className={h.amount < 0 ? "spent" : "earned"}>{signed(h.amount)}</strong>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
