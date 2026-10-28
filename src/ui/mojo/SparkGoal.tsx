import { ChevronRight, Gem } from "lucide-react";
import { useEffect, useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { SparkDialog } from "./SparkDialog";

/**
 * A community's Spark goal at the top of its channels (the owner's request, 2026-10-28, after Discord's boost goal):
 * its level, its active Sparks, how many more the next level needs (2, 5 and 8 in total, from the server's catalog),
 * and a bar towards it. Opens the community's Sparks, where anyone can give one.
 */
export function SparkGoal({ orgId, name }: { orgId: string; name: string }) {
  const engine = useEngine();
  const enabled = useOrbit((s) => s.server?.features.includes("mojo") ?? false);
  const here = useOrbit((s) => s.mojo.orgs[orgId] ?? null);
  const levels = useOrbit((s) => s.mojo.catalog?.spark.levels ?? null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (enabled && !here) void engine.mojo.loadOrg(orgId);
    if (enabled && !levels) void engine.mojo.refresh();
  }, [engine, enabled, orgId, here, levels]);
  if (!enabled || !here) return null;
  const top = levels?.at(-1)?.sparks ?? here.active;
  const goal = here.next ? here.active + here.next.needs : top;
  const from = levels?.find((l) => l.level === here.level)?.sparks ?? 0;
  const fill = here.next ? Math.round(((here.active - from) / Math.max(1, goal - from)) * 100) : 100;
  const label = here.next ? `Spark goal: ${here.active}/${goal} Sparks for Level ${here.next.level}` : `Spark Level ${here.level}: the highest`;
  return (
    <>
      <button className={`spark-goal${here.level > 0 ? " leveled" : ""}`} onClick={() => setOpen(true)} aria-label={`${label}. Open Sparks for ${name}`}>
        <span className="spark-goal-head">
          <Gem size={15} aria-hidden="true" />
          <strong className="grow">{here.level > 0 ? `Level ${here.level}` : "Spark goal"}</strong>
          <span className="spark-goal-count">{here.next ? `${here.active}/${goal}` : `${here.active} Sparks`}</span>
          <ChevronRight size={15} aria-hidden="true" />
        </span>
        <span className="spark-goal-bar" aria-hidden="true">
          <span style={{ width: `${Math.max(4, Math.min(100, fill))}%` }} />
        </span>
        <small>{here.next ? `${here.next.needs} more for Level ${here.next.level}` : "Every level unlocked for everyone here"}</small>
      </button>
      {open && <SparkDialog orgId={orgId} name={name} onClose={() => setOpen(false)} />}
    </>
  );
}
