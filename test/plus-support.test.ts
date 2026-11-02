import { describe, expect, it } from "vitest";
import { supportOnSale } from "../src/application/plusSupport";
import { initialMojo } from "../src/sync/mojo";
import { zMojoCatalog, zMojoMe } from "../src/api/mojoSchemas";
import catalogJson from "./contract-fixtures/http/GET_v2_mojo_catalog.json";
import meJson from "./contract-fixtures/http/GET_v2_mojo_me.json";
const sale = () => {
  const catalog = zMojoCatalog.parse(catalogJson);
  catalog.onSale = { ...catalog.onSale, mode: "live", plus: { currency: "USD", amountMinor: 499 } };
  const me = zMojoMe.parse(meJson);
  me.plan = "free";
  return { ...initialMojo, available: true, catalog, me, billing: { available: true, subscription: null, portal: false } };
};
describe("Plus promotion presentation prerequisites", () => {
  it("requires known Free entitlements and a server offer", () => {
    expect(supportOnSale(sale())).toBe(true);
    expect(supportOnSale(initialMojo)).toBe(false);
    for (const key of ["go", "plus"] as const) {
      const s = sale();
      s.me.plan = key;
      expect(supportOnSale(s)).toBe(false);
    }
  });
  it("fails closed on a missing catalog, billing state, errors or non-live offers", () => {
    expect(supportOnSale({ ...sale(), catalog: null })).toBe(false);
    expect(supportOnSale({ ...sale(), billing: null })).toBe(false);
    expect(supportOnSale({ ...sale(), error: "unavailable" })).toBe(false);
    const s = sale();
    s.catalog.onSale.mode = "test";
    expect(supportOnSale(s)).toBe(false);
  });
});

// Preference migration must not overwrite a later choice from another device.
import type { Engine } from "../src/sync/engine";
import { syncPlusReminderPreference } from "../src/application/plusSupport";
import { beforeEach, vi } from "vitest";
const localPreference = vi.hoisted(() => ({ plusReminders: true }));
vi.mock("../src/application/prefs", () => ({ getPrefs: () => localPreference, setPrefs: (value: { plusReminders: boolean }) => Object.assign(localPreference, value) }));
function preferenceEngine() {
  const values = new Map<string, unknown>();
  let optOut = false;
  const json = vi.fn(async (method: string, _path: string, _schema: unknown, options?: { body: { optOut: boolean } }) => {
    if (method === "PUT") optOut = options!.body.optOut;
    return { optOut };
  });
  const engine = {
    device: { userId: "u_pref" },
    api: { json },
    store: {
      getValue: async (key: string) => values.get(key),
      setValue: async (key: string, value: unknown) => {
        values.set(key, value);
      },
    },
  } as unknown as Engine;
  return {
    engine,
    json,
    values,
    remote: (value: boolean) => {
      optOut = value;
    },
  };
}
describe("account-wide reminder preference", () => {
  beforeEach(() => {
    localPreference.plusReminders = true;
  });
  it("reads a remote opt-out and shares concurrent initial reads", async () => {
    const f = preferenceEngine();
    f.remote(true);
    await Promise.all([syncPlusReminderPreference(f.engine), syncPlusReminderPreference(f.engine)]);
    expect(localPreference.plusReminders).toBe(false);
    expect(f.json).toHaveBeenCalledTimes(1);
  });
  it("migrates a legacy local opt-out once and respects a later re-enable from another device", async () => {
    const f = preferenceEngine();
    localPreference.plusReminders = false;
    await syncPlusReminderPreference(f.engine);
    expect(f.json.mock.calls.map((c) => c[0])).toEqual(["GET", "PUT"]);
    f.remote(false);
    await syncPlusReminderPreference(f.engine);
    expect(localPreference.plusReminders).toBe(true);
    expect(f.json.mock.calls.filter((c) => c[0] === "PUT")).toHaveLength(1);
  });
  it("does not mark migration complete or alter the local choice when the server is unavailable", async () => {
    const f = preferenceEngine();
    f.json.mockRejectedValueOnce(new Error("offline"));
    await expect(syncPlusReminderPreference(f.engine)).rejects.toThrow("offline");
    expect(f.values.size).toBe(0);
    expect(localPreference.plusReminders).toBe(true);
  });
});
