import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";
import { SupabaseEventSubscription } from "../src/realtime/supabaseEvents";

function fixture() {
  const channels: { topic: string; emit: (payload: unknown) => void; status: (value: string) => void }[] = [];
  const remove = vi.fn(async (_channel: unknown) => "ok");
  const auth = vi.fn(async (_token: string) => undefined);
  const client = {
    realtime: { setAuth: auth },
    removeChannel: remove,
    channel: (topic: string, options: unknown) => {
      expect(options).toMatchObject({ config: { private: true } });
      const item = { topic, emit: (_payload: unknown) => {}, status: (_status: string) => {} };
      channels.push(item);
      const channel = {
        on: (_kind: string, _filter: unknown, handler: (event: { payload: unknown }) => void) => {
          item.emit = (payload) => {
            handler({ payload });
          };
          return channel;
        },
        subscribe: (handler: (value: string) => void) => {
          item.status = handler;
          handler("SUBSCRIBED");
          return channel;
        },
      };
      return channel as unknown as RealtimeChannel;
    },
  } as unknown as SupabaseClient;
  return { client, channels, remove, auth };
}
const payload = () => ({ eventId: crypto.randomUUID(), messageId: "message001", conversationId: "conversation001" });

describe("private Supabase invalidation lifecycle", () => {
  it("deduplicates delivery and recovers durable history after each reconnect", async () => {
    const f = fixture(),
      apply = vi.fn(async () => {}),
      recover = vi.fn(async () => {});
    const subscription = new SupabaseEventSubscription(f.client, apply, recover, () => {});
    await subscription.start("user:fixture", "synthetic-access-token");
    const event = payload();
    f.channels[0].emit(event);
    f.channels[0].emit(event);
    await vi.waitFor(() => {
      expect(apply).toHaveBeenCalledTimes(1);
    });
    f.channels[0].status("SUBSCRIBED");
    await vi.waitFor(() => {
      expect(recover).toHaveBeenCalledTimes(2);
    });
    await subscription.stop();
  });
  it("serializes events and allows a failed invalidation to be retried", async () => {
    const f = fixture(),
      errors = vi.fn();
    let first = true;
    const apply = vi.fn(async () => {
      if (first) {
        first = false;
        throw new Error("synthetic temporary failure");
      }
    });
    const subscription = new SupabaseEventSubscription(f.client, apply, async () => {}, errors);
    await subscription.start("conversation:fixture", "synthetic-token");
    const event = payload();
    f.channels[0].emit(event);
    await vi.waitFor(() => {
      expect(errors).toHaveBeenCalledOnce();
    });
    f.channels[0].emit(event);
    await vi.waitFor(() => {
      expect(apply).toHaveBeenCalledTimes(2);
    });
    await subscription.stop();
  });
  it("refuses malformed events and callbacks from a stopped account", async () => {
    const f = fixture(),
      apply = vi.fn(async () => {});
    const subscription = new SupabaseEventSubscription(
      f.client,
      apply,
      async () => {},
      () => {},
    );
    await subscription.start("user:fixture", "synthetic-token");
    f.channels[0].emit({ ...payload(), entitlement: "plus" });
    await subscription.stop();
    f.channels[0].emit(payload());
    await Promise.resolve();
    expect(apply).not.toHaveBeenCalled();
  });
  it("does not let an older account switch replace a newer subscription", async () => {
    const f = fixture();
    let release: (() => void) | undefined;
    const subscription = new SupabaseEventSubscription(
      f.client,
      async () => {},
      async () => {},
      () => {},
    );
    await subscription.start("user:first", "first-token");
    f.remove.mockImplementationOnce(
      async () =>
        new Promise<string>((resolve) => {
          release = () => {
            resolve("ok");
          };
        }),
    );
    const older = subscription.start("user:older", "older-token");
    await Promise.resolve();
    await subscription.start("user:latest", "latest-token");
    release!();
    await older;
    expect(f.channels.map((channel) => channel.topic)).toEqual(["user:first", "user:latest"]);
    await subscription.stop();
  });
});
