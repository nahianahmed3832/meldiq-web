import { z } from "zod";

/**
 * Experiments and product analytics (docs/product/EXPERIMENTS.md in the meldiq repository), the web side of Android's
 * ProductSignals. Both stay silent unless the server has them and its operator turned them on: no assignment means the
 * established experience, and with analytics off nothing is collected or sent. Events carry only the server's closed
 * list of property values: never message text, names, or ids of people, channels or workspaces.
 */
export const zExperiments = z.object({
  mode: z.string().default("off"),
  analytics: z.boolean().default(false),
  assignments: z.array(z.object({ experiment: z.string(), variant: z.string(), layer: z.string().default("") })).default([]),
});

export interface AnalyticsEvent {
  name: string;
  props?: Record<string, string>;
  value?: number;
}

/** Most events kept while offline; the oldest go first. */
export const QUEUE_CAPACITY = 200;
/** The server's largest batch. */
export const BATCH = 50;
const FLUSH_DELAY_MS = 30_000;

/** The analytics buffer, pure so it is unit-tested (test/signals.test.ts). */
export class AnalyticsQueue {
  private events: AnalyticsEvent[] = [];
  constructor(private readonly capacity = QUEUE_CAPACITY) {}

  get size(): number {
    return this.events.length;
  }

  add(e: AnalyticsEvent): void {
    this.events = [...this.events, e].slice(-this.capacity);
  }

  take(max = BATCH): AnalyticsEvent[] {
    const out = this.events.slice(0, max);
    this.events = this.events.slice(out.length);
    return out;
  }

  /** A batch that failed goes back in front; when that overflows, the oldest events are dropped. */
  putBack(batch: AnalyticsEvent[]): void {
    this.events = [...batch, ...this.events].slice(-this.capacity);
  }

  clear(): void {
    this.events = [];
  }
}

/** How many results came back, bucketed as the catalogue requires (never the exact count). */
export function resultBucket(n: number): "0" | "1" | "2-5" | "6+" {
  if (n <= 0) return "0";
  if (n === 1) return "1";
  return n <= 5 ? "2-5" : "6+";
}

interface SignalsDeps {
  features: () => readonly string[];
  getExperiments: () => Promise<z.infer<typeof zExperiments>>;
  send: (events: AnalyticsEvent[]) => Promise<void>;
  schedule?: (fn: () => void, ms: number) => unknown;
}

export class Signals {
  private assignments = new Map<string, string>();
  private analyticsOn = false;
  private readonly queue = new AnalyticsQueue();
  private readonly exposed = new Set<string>();
  private pending = false;

  constructor(private readonly deps: SignalsDeps) {}

  /** Asks the server for this person's assignments and whether analytics is on. Keeps what it had on failure. */
  async refresh(): Promise<void> {
    const features = this.deps.features();
    if (!features.includes("experiments")) {
      this.assignments = new Map();
      this.analyticsOn = false;
      return;
    }
    try {
      const res = await this.deps.getExperiments();
      this.assignments = new Map(res.assignments.map((a) => [a.experiment, a.variant]));
      this.analyticsOn = res.analytics && features.includes("analytics-events");
      if (!this.analyticsOn) this.queue.clear();
    } catch {
      // The established experience is the fallback anyway.
    }
  }

  /** The variant of [experiment] this person sees, or [control] when they aren't in it (everyone, by default). */
  variant(experiment: string, control: string): string {
    return this.assignments.get(experiment) ?? control;
  }

  /** Records that the person saw an experiment's variant, once per page load, and only when they are in it. */
  markExposed(experiment: string): void {
    const variant = this.assignments.get(experiment);
    if (!variant || this.exposed.has(experiment)) return;
    this.exposed.add(experiment);
    this.track("experiment.exposed", { experiment, variant });
  }

  get enabled(): boolean {
    return this.analyticsOn;
  }

  track(name: string, props: Record<string, string> = {}, value?: number): void {
    if (!this.analyticsOn) return;
    this.queue.add({ name, ...(Object.keys(props).length ? { props } : {}), ...(value === undefined ? {} : { value }) });
    if (this.pending) return;
    this.pending = true;
    (this.deps.schedule ?? setTimeout)(() => {
      this.pending = false;
      void this.flush();
    }, FLUSH_DELAY_MS);
  }

  /** Sends what's queued (also when the tab is hidden). A failed batch waits for the next try. */
  async flush(): Promise<void> {
    while (this.analyticsOn) {
      const batch = this.queue.take();
      if (batch.length === 0) return;
      try {
        await this.deps.send(batch);
      } catch {
        this.queue.putBack(batch);
        return;
      }
    }
  }
}
