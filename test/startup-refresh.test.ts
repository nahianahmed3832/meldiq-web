import "fake-indexeddb/auto";
import { afterEach, expect, it, vi } from "vitest";
import type { DeviceRecord } from "../src/model/types";
import { LocalStore } from "../src/store/db";
import { Engine } from "../src/sync/engine";

afterEach(() => vi.restoreAllMocks());

it("shares startup and socket metadata requests, and refreshes again on a later reconnect", async () => {
  const store = await LocalStore.open(`startup-refresh-${Math.random()}`);
  const device = { userId: "u_me", deviceId: "d_web", keys: {}, history: null } as unknown as DeviceRecord;
  const engine = new Engine(device, store, { base: "http://meldiq.test", wsUrl: "ws://meldiq.test/v1/ws" });
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  const json = vi.spyOn(engine.api, "json").mockImplementation(async (_method, path) => {
    await held;
    if (path === "/v1/server-info") return { features: [] };
    if (path === "/v1/users/me") return { user: { id: "u_me" } };
    if (path === "/v1/orgs") return { orgs: [] };
    if (path === "/v1/conversations") return { conversations: [] };
    throw new Error(`Unexpected request: ${path}`);
  });
  vi.spyOn(engine.nav, "refresh").mockResolvedValue();
  vi.spyOn(engine.reminders, "refresh").mockResolvedValue();
  vi.spyOn(engine, "syncSummaries").mockResolvedValue();
  try {
    const startup = engine.refreshAll();
    const hello = engine.refreshAll();
    expect(hello).toBe(startup);
    expect(json).toHaveBeenCalledTimes(4);
    release();
    await Promise.all([startup, hello]);
    expect(engine.state.get().synced).toBe(true);
    await engine.refreshAll();
    expect(json).toHaveBeenCalledTimes(8);
  } finally {
    release();
    engine.stop();
    await LocalStore.erase(store);
  }
});
