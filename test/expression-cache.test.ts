import { afterEach, describe, expect, it, vi } from "vitest";
import { clearExpressionCache, expressionImage } from "../src/sync/expressions";
import type { Engine } from "../src/sync/engine";

const client = (response: () => Promise<ArrayBuffer>) => ({ api: { bytes: vi.fn(response) } }) as unknown as Engine;
afterEach(() => vi.restoreAllMocks());

describe("private expression images", () => {
  it("keeps caches separate between accounts and revokes them on membership loss or sign-out", async () => {
    const make = vi.spyOn(URL, "createObjectURL").mockReturnValueOnce("blob:alice").mockReturnValueOnce("blob:bob");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const alice = client(async () => new ArrayBuffer(8));
    const bob = client(async () => new ArrayBuffer(8));
    expect(await expressionImage(alice, "emoji1", null)).toBe("blob:alice");
    expect(await expressionImage(bob, "emoji1", null)).toBe("blob:bob");
    expect(make).toHaveBeenCalledTimes(2);
    clearExpressionCache(alice);
    await Promise.resolve();
    expect(revoke).toHaveBeenCalledWith("blob:alice");
    expect(revoke).not.toHaveBeenCalledWith("blob:bob");
    vi.mocked(alice.api.bytes).mockRejectedValueOnce(new Error("membership removed"));
    expect(await expressionImage(alice, "emoji1", null)).toBeNull();
    expect(await expressionImage(bob, "emoji1", null)).toBe("blob:bob");
    clearExpressionCache(bob);
  });

  it("does not create an object URL when an old authorized download completes after invalidation", async () => {
    let finish!: (bytes: ArrayBuffer) => void;
    const engine = client(
      () =>
        new Promise<ArrayBuffer>((resolve) => {
          finish = resolve;
        }),
    );
    const make = vi.spyOn(URL, "createObjectURL");
    const pending = expressionImage(engine, "emoji1", null);
    clearExpressionCache(engine);
    finish(new ArrayBuffer(8));
    expect(await pending).toBeNull();
    expect(make).not.toHaveBeenCalled();
  });
});
