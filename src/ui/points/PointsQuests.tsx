import { formatUiNumber } from "../../i18n/format";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { Check } from "lucide-react";
import type { Quest } from "../../sync/points";
import { untilWhen } from "../format";
import { questLabel } from "./pointsWords";
/** One quest: its task, reward and progress; a claimed one shows done (rewards are given automatically). */
function QuestRow({ quest }: { quest: Quest }) {
  useLocaleRender();
  const l10n = useLocalization();
  const done = quest.state === "claimed";
  const shown = Math.min(quest.progress, quest.goal);
  return (
    <li className={`quest${done ? " done" : ""}`}>
      <span className="quest-reward" aria-label={uiText("workspace.interface.value0_embers_f4866b3", { value0: quest.reward })}>
        +{formatUiNumber(quest.reward)}
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
            <Check size={14} aria-hidden="true" /> {l10n("common.actions.done")}
          </>
        ) : (
          uiText("workspace.interface.value0_of_value1_ca6c5e5", { value0: shown, value1: quest.goal })
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
  useLocaleRender();
  const daily = quests.filter((q) => q.kind === "daily");
  const once = quests.filter((q) => q.kind === "once");
  return (
    <>
      {daily.length > 0 && (
        <section className="card points-card" aria-labelledby="pts-daily">
          <div className="points-card-head">
            <h3 id="pts-daily">
              <Localized k="workspace.interface.daily_quests_1637334" />
            </h3>
            <small className="faint">
              <Localized k="workspace.interface.new_ones_2ee8d99" slots={[untilWhen(resetsAt)]} />
            </small>
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
            <h3 id="pts-once">
              <Localized k="workspace.interface.one_time_quests_9c35e97" />
            </h3>
            <small className="faint">
              <Localized k="workspace.interface.of_done_c6748f7" slots={[once.filter((q) => q.state === "claimed").length, once.length]} />
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
