import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
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
  useLocaleRender();
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
  const label = here.next
    ? uiText("billing.interface.spark_goal_value0_value1_sparks_for_level_value2_f49cc7b", { value0: here.active, value1: goal, value2: here.next.level })
    : uiText("billing.interface.spark_level_value0_the_highest_4e5d67d", { value0: here.level });
  return (
    <>
      <button
        title={uiText("messaging.interface.value0_value1_82032eb", {
          value0: label,
          value1: here.next ? uiText("billing.interface.more_for_level_c0ce15f", { value0: here.next.needs, value1: here.next.level }) : "",
        })}
        className={`spark-goal${compact ? " compact" : ""}${here.level > 0 ? " leveled" : ""}`}
        onClick={() => setOpen(true)}
        aria-label={uiText("billing.interface.value0_open_sparks_for_value1_bad7f9a", { value0: label, value1: name })}
      >
        <span className="spark-goal-head">
          <Gem size={15} aria-hidden="true" />
          <strong className="grow">
            {compact ? here.active : here.level > 0 ? uiText("billing.interface.level_value0_6095a3d", { value0: here.level }) : uiText("billing.interface.spark_goal_50c73f7")}
          </strong>
          <span className={compact ? "sr-only" : "spark-goal-count"}>
            {here.next ? uiText("billing.interface.value0_value1_0907f4d", { value0: here.active, value1: goal }) : uiText("billing.interface.value0_sparks_109d9fd", { value0: here.active })}
          </span>
          {!compact && <ChevronRight size={15} aria-hidden="true" />}
        </span>
        <span className="spark-goal-bar" aria-hidden="true">
          <span style={{ width: `${Math.min(100, fill)}%` }} />
        </span>
        <small className={compact ? "sr-only" : undefined}>
          {here.next
            ? uiText("billing.interface.value0_more_for_level_value1_3a01894", { value0: here.next.needs, value1: here.next.level })
            : uiText("billing.interface.every_level_unlocked_for_everyone_here_56cd039")}
        </small>
      </button>
      {open && <SparkDialog orgId={orgId} name={name} onClose={() => setOpen(false)} />}
    </>
  );
}
