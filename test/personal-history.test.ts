import "fake-indexeddb/auto";
import { afterEach, expect, it, vi } from "vitest";
import { readPersonalHistory, recordSearch, recordVisit, updateHistory } from "../src/application/personalHistory";
import { LocalStore } from "../src/store/db";

afterEach(() => vi.unstubAllGlobals());

it("retains bounded per-account history, does not track until opted in, and clears it across reloads", async () => {
  vi.stubGlobal("window", new EventTarget());
  const first = await LocalStore.open("history-first");
  const second = await LocalStore.open("history-second");
  const clock = vi.spyOn(Date, "now").mockReturnValue(80 * 86_400_000);
  try {
    await recordVisit(first, "dm_private");
    expect((await readPersonalHistory(first)).visits).toEqual([]);
    await updateHistory(first, { type: "activity", enabled: true });
    await Promise.all([recordVisit(first, "dm_one"), recordVisit(first, "group_two"), recordVisit(first, "dm_one")]);
    await recordSearch(first, "launch");
    await recordSearch(first, "LAUNCH");
    expect((await readPersonalHistory(first)).searches.map((x) => x.query)).toEqual(["LAUNCH"]);
    expect((await readPersonalHistory(second)).visits).toEqual([]);
    expect((await readPersonalHistory(second)).searches).toEqual([]);
    const reload = await LocalStore.open(first.name);
    try {
      expect((await readPersonalHistory(reload)).visits.map((v) => v.id)).toEqual(["dm_one", "group_two"]);
      await updateHistory(reload, { type: "removeVisit", id: "dm_one" });
      expect((await readPersonalHistory(first)).visits.map((v) => v.id)).toEqual(["group_two"]);
      clock.mockReturnValue(111 * 86_400_000);
      expect(await readPersonalHistory(reload)).toMatchObject({ visits: [], searches: [] });
      await updateHistory(reload, { type: "search", enabled: false });
      await recordSearch(first, "private");
      expect((await readPersonalHistory(reload)).searches).toEqual([]);
    } finally {
      reload.close();
    }
  } finally {
    clock.mockRestore();
    first.close();
    second.close();
  }
});
