/** One step of Get started (android HomeStart); optional steps never block "all done". */
export interface StartStep {
  key: string;
  label: string;
  done: boolean;
  optional?: boolean;
}

/** Shown until hidden, or until every required step is done (android StartRules.visible). */
export const startVisible = (hidden: boolean, steps: StartStep[]): boolean => !hidden && steps.some((s) => !s.done && !s.optional);

export const startProgress = (steps: StartStep[]): { done: number; total: number } => ({ done: steps.filter((s) => s.done).length, total: steps.length });
