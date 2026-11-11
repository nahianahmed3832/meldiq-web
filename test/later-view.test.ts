import "fake-indexeddb/auto";
import { expect, it, vi } from "vitest";
import { DEFAULT_LATER_VIEW, LaterViewWriter, readLaterView } from "../src/application/laterView";
import { LocalStore } from "../src/store/db";

it("restores a view after reload, isolates accounts and removes it with sign-out's database erase", async () => {
  const alice = await LocalStore.open("later-alice");
  const bob = await LocalStore.open("later-bob");
  const view = { ...DEFAULT_LATER_VIEW, query: "private search", collectionId: "release", tab: "reminders" as const };
  await new LaterViewWriter(alice).write(view);
  const reloaded = await LocalStore.open(alice.name);
  expect(await readLaterView(reloaded)).toEqual(view);
  expect(await readLaterView(bob)).toEqual(DEFAULT_LATER_VIEW);
  reloaded.close();
  await LocalStore.erase(alice);
  const signedOut = await LocalStore.open("later-alice");
  expect(await readLaterView(signedOut)).toEqual(DEFAULT_LATER_VIEW);
  signedOut.close();
  bob.close();
});

it("uses safe defaults for malformed stored views and exposes read failures", async () => {
  for (const raw of [undefined, null, {}, { ...DEFAULT_LATER_VIEW, filter: "hidden" }, { ...DEFAULT_LATER_VIEW, query: "x".repeat(101) }]) {
    expect(await readLaterView({ laterView: async () => raw })).toEqual(DEFAULT_LATER_VIEW);
  }
  await expect(
    readLaterView({
      laterView: async () => {
        throw new Error("storage unavailable");
      },
    }),
  ).rejects.toThrow("storage unavailable");
});

it("serializes slow writes and snapshots a view instead of saving a mutated object", async () => {
  let release!: () => void;
  const saved: unknown[] = [];
  const store = {
    saveLaterView: vi.fn(async (value: unknown) => {
      if (!saved.length)
        await new Promise<void>((r) => {
          release = r;
        });
      saved.push(value);
    }),
  };
  const writer = new LaterViewWriter(store);
  const view = { ...DEFAULT_LATER_VIEW, query: "first" };
  const first = writer.write(view);
  view.query = "changed outside";
  const second = writer.write({ ...DEFAULT_LATER_VIEW, query: "latest" });
  await vi.waitFor(() => expect(store.saveLaterView).toHaveBeenCalledTimes(1));
  release();
  await Promise.all([first, second]);
  expect(saved).toEqual([
    { ...DEFAULT_LATER_VIEW, query: "first" },
    { ...DEFAULT_LATER_VIEW, query: "latest" },
  ]);
});

it("reports failed persistence and allows a subsequent retry to succeed", async () => {
  const saveLaterView = vi.fn().mockRejectedValueOnce(new Error("quota")).mockResolvedValue(undefined);
  const writer = new LaterViewWriter({ saveLaterView });
  await expect(writer.write(DEFAULT_LATER_VIEW)).rejects.toThrow("quota");
  await expect(writer.write({ ...DEFAULT_LATER_VIEW, filter: "all" })).resolves.toBeUndefined();
  expect(saveLaterView).toHaveBeenLastCalledWith({ ...DEFAULT_LATER_VIEW, filter: "all" });
});

it("waits for an in-flight view write before restoring after navigation", async () => {
  let release!: () => void;
  let value: unknown;
  const store = {
    saveLaterView: async (next: unknown) => {
      await new Promise<void>((r) => {
        release = r;
      });
      value = next;
    },
    laterView: async () => value,
  };
  const expected = { ...DEFAULT_LATER_VIEW, query: "last edit" };
  const writing = new LaterViewWriter(store).write(expected);
  const restoring = readLaterView(store);
  await vi.waitFor(() => expect(release).toBeTypeOf("function"));
  release();
  await writing;
  expect(await restoring).toEqual(expected);
});
