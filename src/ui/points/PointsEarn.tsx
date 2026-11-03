import { formatUnit } from "../../i18n/format";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { CalendarCheck, Flame, MessageSquare, UserPlus } from "lucide-react";
import type { Points } from "../../sync/points";
import { relative } from "../format";
import { EARN, historyLabel, signed, streakInWeek } from "./pointsWords";
const DAY_MS = 86400000;
/** One way to earn: what it pays, and where you stand today. */
function Way({ icon, title, pays, now }: { icon: React.ReactNode; title: string; pays: string; now: React.ReactNode }) {
  useLocaleRender();
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
  useLocaleRender();
  const dayStart = points.resetsAt - DAY_MS;
  const visited = points.history.some((h) => h.kind === "visit" && h.at >= dayStart);
  const inWeek = streakInWeek(points.streak);
  const boosted = points.multiplier > 1 ? uiText("workspace.interface.with_your_plan_801fbf0", { value0: points.multiplier }) : "";
  const inv = points.invites;
  return (
    <>
      {mode !== "history" && (
        <section className="card points-card" aria-labelledby="pts-earn">
          <div className="points-card-head">
            <h3 id="pts-earn">
              <Localized k="workspace.interface.ways_to_earn_0cdf23a" />
            </h3>
            {boosted && (
              <small className="faint">
                <Localized k="workspace.interface.your_plan_gives_on_everything_you_earn_cf9130a" slots={[points.multiplier]} />
              </small>
            )}
          </div>
          <ul className="earn-ways">
            <Way
              icon={<CalendarCheck size={18} />}
              title={uiText("workspace.interface.daily_visit_eeb5e20")}
              pays={uiText("workspace.points.visitPays", { amount: EARN.visit, boosted })}
              now={uiText(visited ? "workspace.points.countedToday" : "workspace.points.notCountedToday")}
            />
            <Way
              icon={<MessageSquare size={18} />}
              title={uiText("workspace.interface.chatting_7bc1daa")}
              pays={uiText("workspace.points.chatPays", { amount: EARN.chatPoints, duration: formatUnit(EARN.chatMinutes, "minute"), limit: points.chatDailyCap })}
              now={uiText("workspace.points.chatNow", { duration: formatUnit(points.chatMinutesToday, "minute"), earned: points.chatPointsToday, limit: points.chatDailyCap })}
            />
            <Way
              icon={<Flame size={18} />}
              title={uiText("workspace.interface.value0_day_streak_12dde4a", { value0: EARN.streakDays })}
              pays={uiText("workspace.points.streakPays", { amount: EARN.streak, duration: formatUnit(EARN.streakDays, "day"), boosted })}
              now={
                <span className="streak-track" aria-label={uiText("workspace.interface.value0_day_streak_12dde4a", { value0: points.streak })}>
                  {Array.from({ length: EARN.streakDays }, (_, i) => (
                    <span key={i} className={`streak-day${i < inWeek ? " on" : ""}`} aria-hidden="true" />
                  ))}
                  <span>{points.streak === 1 ? formatUnit(1, "day") : formatUnit(points.streak, "day")}</span>
                </span>
              }
            />
            <Way
              icon={<UserPlus size={18} />}
              title={uiText("workspace.interface.invites_f212a98")}
              pays={uiText("workspace.points.invitePays", { amount: EARN.invite, duration: formatUnit(EARN.inviteDays, "day"), limit: inv.monthlyLimit })}
              now={uiText("workspace.points.inviteNow", { paid: inv.credited, pending: inv.pending, credited: inv.creditedThisMonth, limit: inv.monthlyLimit })}
            />
          </ul>
        </section>
      )}

      {mode !== "ways" && (
        <section className="card points-card" aria-labelledby="pts-history">
          <div className="points-card-head">
            <h3 id="pts-history">
              <Localized k="workspace.interface.history_0e76960" />
            </h3>
          </div>
          {points.history.length === 0 ? (
            <p className="faint" style={{ margin: 0 }}>
              <Localized k="workspace.interface.nothing_yet_what_you_earn_and_spend_shows_up_here_8d54c1c" />
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
