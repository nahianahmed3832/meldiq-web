import type { SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";
import { z } from "zod";

export const SupabaseInvalidation = z.strictObject({
  eventId: z.uuid(),
  messageId: z.string().min(1).max(64),
  conversationId: z.string().min(1).max(64),
});
export type SupabaseInvalidation = z.infer<typeof SupabaseInvalidation>;

/** Broadcasts invalidate server-authorized data; they never supply trusted messages or entitlements.
 * Call recover on every reconnect to page durable history, because Broadcast is not a replay log.
 */
export class SupabaseEventSubscription {
  private readonly seen = new Set<string>();
  private channel: RealtimeChannel | null = null;
  private generation = 0;
  private chain = Promise.resolve();
  constructor(
    private readonly client: SupabaseClient,
    private readonly onInvalidation: (event: SupabaseInvalidation) => Promise<void>,
    private readonly recover: () => Promise<void>,
    private readonly onError: () => void,
  ) {}

  async start(topic: string, accessToken: string): Promise<void> {
    if (!/^(?:user|conversation):[A-Za-z0-9_-]{1,64}$/.test(topic)) throw new Error("Invalid private topic");
    const generation = ++this.generation;
    const previous = this.channel;
    this.channel = null;
    if (previous) await this.client.removeChannel(previous);
    await this.chain;
    if (generation !== this.generation) return;
    this.seen.clear();
    await this.client.realtime.setAuth(accessToken);
    if (generation !== this.generation) return;
    const channel = this.client.channel(topic, { config: { private: true, broadcast: { self: false } } });
    this.channel = channel;
    channel
      .on("broadcast", { event: "message.changed" }, ({ payload }: { payload: unknown }) => {
        this.chain = this.chain
          .then(async () => {
            if (generation !== this.generation) return;
            const parsed = SupabaseInvalidation.safeParse(payload);
            if (!parsed.success || this.seen.has(parsed.data.eventId)) return;
            await this.onInvalidation(parsed.data);
            this.seen.add(parsed.data.eventId);
            if (this.seen.size > 2048) this.seen.delete(this.seen.values().next().value!);
          })
          .catch(() => {
            this.onError();
          });
      })
      .subscribe((status) => {
        if (generation !== this.generation) return;
        if (status === "SUBSCRIBED")
          this.chain = this.chain
            .then(() => this.recover())
            .catch(() => {
              this.onError();
            });
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") this.onError();
      });
  }
  async stop(): Promise<void> {
    const generation = ++this.generation;
    const channel = this.channel;
    this.channel = null;
    if (channel) await this.client.removeChannel(channel);
    await this.chain;
    if (generation === this.generation) this.seen.clear();
  }
}
