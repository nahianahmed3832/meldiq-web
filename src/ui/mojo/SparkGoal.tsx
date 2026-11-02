import { ChevronRight, Gem } from "lucide-react";
import { useEffect, useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { SparkDialog } from "./SparkDialog";

/**
 * A community's Spark goal at the top of its channels (the owner's request, 2026-10-28, after Discord's boost goal):
 * its level, its active Sparks, how many more the next level needs (2, 5 and 8 in total, from the server's catalog),
 * and a bar towards it. Opens the community's Sparks, where anyone can give one.
 */
export function SparkGoal({ orgId, name, compact = false }: { orgId: string; name: string; compact?: boolean }) {
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
  // The bar shows the count it's drawn next to: 2/5 fills 40% (the owner, 2026-10-29), not the share of this level's step.
  const fill = here.next ? Math.round((here.active / Math.max(1, goal)) * 100) : 100;
  const label = here.next ? `Spark goal: ${here.active}/${goal} Sparks for Level ${here.next.level}` : `Spark Level ${here.level}: the highest`;
  return (
    <>
      <button
        title={`${label}${here.next ? ` · ${here.next.needs} more for Level ${here.next.level}` : ""}`}
        className={`spark-goal${compact ? " compact" : ""}${here.level > 0 ? " leveled" : ""}`}
        onClick={() => setOpen(true)}
        aria-label={`${label}. Open Sparks for ${name}`}
      >
        <span className="spark-goal-head">
          <Gem size={15} aria-hidden="true" />
          <strong className="grow">{compact ? here.active : here.level > 0 ? `Level ${here.level}` : "Spark goal"}</strong>
          <span className={compact ? "sr-only" : "spark-goal-count"}>{here.next ? `${here.active}/${goal}` : `${here.active} Sparks`}</span>
          {!compact && <ChevronRight size={15} aria-hidden="true" />}
        </span>
        <span className="spark-goal-bar" aria-hidden="true">
          <span style={{ width: `${Math.min(100, fill)}%` }} />
        </span>
        <small className={compact ? "sr-only" : undefined}>{here.next ? `${here.next.needs} more for Level ${here.next.level}` : "Every level unlocked for everyone here"}</small>
      </button>
      {open && <SparkDialog orgId={orgId} name={name} onClose={() => setOpen(false)} />}
    </>
  );
}
