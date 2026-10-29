import { ArrowUpCircle } from "lucide-react";
import { useState } from "react";
import { ApiError } from "../../api/client";
import { useEngine, useOrbit } from "../../application/orbit";
import { levelUp, points as loadPoints } from "../../sync/points";
import { LevelRing } from "../people/LevelRing";
import { useLoad } from "../workspace/useLoad";
import { PointsEarn } from "./PointsEarn";
import { PointsQuests } from "./PointsQuests";
import { levelProgress } from "./pointsWords";

/** What a refused level-up says: the cost and the balance from a 409 not_enough_points, else the server's words. */
export function levelUpProblem(e: unknown): string {
  if (!(e instanceof ApiError)) return "Couldn't level up. Try again.";
  if (e.code !== "not_enough_points") return e.message;
  const d = e.details as { cost?: unknown; balance?: unknown } | null | undefined;
  return typeof d?.cost === "number" && typeof d.balance === "number" ? `The next level costs ${d.cost} points and you have ${d.balance}.` : e.message;
}

/**
 * Settings › Points (API 0.65.0, the reference's layout): your balance, your account level with what the next one
 * costs, daily and one-time quests, the ways to earn, and the history. Points can't be bought, sold or sent; the
 * server decides every amount, so this page only shows them and asks for a level.
 */
export function PointsPage() {
  const engine = useEngine();
  const offered = useOrbit((s) => s.server?.features.includes("points") ?? false);
  const [version, setVersion] = useState(0);
  const data = useLoad(() => (offered ? loadPoints(engine) : Promise.resolve(null)), [engine, offered, version]);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [reached, setReached] = useState<number | null>(null);

  const buyLevel = async () => {
    setBusy(true);
    setProblem(null);
    try {
      setReached((await levelUp(engine)).level);
      setVersion((v) => v + 1);
    } catch (e) {
      setProblem(levelUpProblem(e));
      setVersion((v) => v + 1);
    } finally {
      setBusy(false);
    }
  };

  if (!offered) {
    return (
      <>
        <h1>Points</h1>
        <p className="muted">This server doesn't have points yet.</p>
      </>
    );
  }
  const p = data.data;
  return (
    <div className="points">
      <h1>Points</h1>
      {data.error && !p && (
        <div className="banner danger" role="alert">
          <span className="grow">Points couldn't be loaded. {data.error}</span>
          <button className="btn btn-secondary btn-sm" onClick={() => setVersion((v) => v + 1)}>
            Try again
          </button>
        </div>
      )}
      {!p && !data.error && <div className="skeleton" style={{ height: 160 }} aria-busy="true" />}
      {p && (
        <>
          {!p.earning && (
            <div className="banner" role="status">
              New accounts start earning points after their first day.
            </div>
          )}
          <div className="points-top">
            <section className="card points-card points-balance" aria-label="Balance">
              <small className="settings-label">Balance</small>
              <strong className="points-number">{p.balance.toLocaleString()}</strong>
              <span className="faint">
                {p.earnedToday.toLocaleString()} earned today · {p.earnedTotal.toLocaleString()} in all
              </span>
            </section>
            <section className="card points-card points-level" aria-label="Account level">
              <LevelRing level={p.level} size={84} progress={levelProgress(p.balance, p.nextLevelCost)} />
              <span className="lines grow">
                <strong>Level {p.level}</strong>
                <small className="faint">{p.balance >= p.nextLevelCost ? `You have enough for level ${p.level + 1}.` : `${p.nextLevelCost - p.balance} more for level ${p.level + 1}`}</small>
                <small className="faint">Each level costs {p.nextLevelCost} points. Your level shows on your profile card.</small>
              </span>
              <button className="btn btn-primary btn-sm" disabled={busy || p.balance < p.nextLevelCost} onClick={() => void buyLevel()}>
                <ArrowUpCircle size={15} aria-hidden="true" /> {busy ? "Levelling up…" : "Level up"}
              </button>
            </section>
          </div>
          {problem && (
            <div className="banner danger" role="alert">
              {problem}
            </div>
          )}
          {reached !== null && !problem && (
            <div className="banner ok" role="status">
              You're level {reached} now.
            </div>
          )}
          <PointsQuests quests={p.quests} resetsAt={p.resetsAt} />
          <PointsEarn points={p} />
        </>
      )}
    </div>
  );
}
