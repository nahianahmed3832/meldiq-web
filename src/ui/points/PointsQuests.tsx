import { Check } from "lucide-react";
import type { Quest } from "../../sync/points";
import { untilWhen } from "../format";
import { questLabel } from "./pointsWords";

/** One quest: its task, reward and progress; a claimed one shows done (rewards are given automatically). */
function QuestRow({ quest }: { quest: Quest }) {
  const done = quest.state === "claimed";
  const shown = Math.min(quest.progress, quest.goal);
  return (
    <li className={`quest${done ? " done" : ""}`}>
      <span className="quest-reward" aria-label={`${quest.reward} Embers`}>
        +{quest.reward}
      </span>
      <span className="lines grow">
        <span>{questLabel(quest)}</span>
        <span className="quest-bar" aria-hidden="true">
          <span style={{ width: `${(shown / quest.goal) * 100}%` }} />
        </span>
      </span>
      <span className="quest-state">
        {done ? (
          <>
            <Check size={14} aria-hidden="true" /> Done
          </>
        ) : (
          `${shown} of ${quest.goal}`
        )}
      </span>
    </li>
  );
}

/**
 * Settings › Points › quests (API 0.65.0): today's quests, which start over at midnight UTC, and the one-time ones.
 * The server counts progress and pays each reward the moment a quest is done.
 */
export function PointsQuests({ quests, resetsAt }: { quests: Quest[]; resetsAt: number }) {
  const daily = quests.filter((q) => q.kind === "daily");
  const once = quests.filter((q) => q.kind === "once");
  return (
    <>
      {daily.length > 0 && (
        <section className="card points-card" aria-labelledby="pts-daily">
          <div className="points-card-head">
            <h3 id="pts-daily">Daily quests</h3>
            <small className="faint">New ones {untilWhen(resetsAt)}</small>
          </div>
          <ul className="quests">
            {daily.map((q) => (
              <QuestRow key={q.id} quest={q} />
            ))}
          </ul>
        </section>
      )}
      {once.length > 0 && (
        <section className="card points-card" aria-labelledby="pts-once">
          <div className="points-card-head">
            <h3 id="pts-once">One-time quests</h3>
            <small className="faint">
              {once.filter((q) => q.state === "claimed").length} of {once.length} done
            </small>
          </div>
          <ul className="quests">
            {once.map((q) => (
              <QuestRow key={q.id} quest={q} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
