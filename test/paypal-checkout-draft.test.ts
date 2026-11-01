import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readCheckout, selectCheckout, writeCheckout } from "../src/ui/billing/checkoutDraft";

describe("PayPal purchase intent recovery", () => {
  beforeEach(() => {
    const data = new Map<string, string>();
    vi.stubGlobal("sessionStorage", { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("resumes a pending purchase with the same retry key and owned internal reference", () => {
    selectCheckout("alice", { product: "plus" });
    const first = readCheckout("alice");
    writeCheckout("alice", { ...first, purchaseId: "chk_pending" });
    selectCheckout("alice", { product: "plus" });
    expect(readCheckout("alice")).toMatchObject({ requestKey: first.requestKey, purchaseId: "chk_pending", completed: false });
  });

  it("allows a separate intentional gift purchase after the earlier gift is confirmed", () => {
    const gift = { product: "gift" as const, recipientUserId: "bob", months: 1 as const, note: "Enjoy!" };
    selectCheckout("alice", gift);
    const first = readCheckout("alice");
    writeCheckout("alice", { ...first, purchaseId: "gft_paid", completed: true });
    selectCheckout("alice", gift);
    expect(readCheckout("alice").requestKey).not.toBe(first.requestKey);
    expect(readCheckout("alice").purchaseId).toBeNull();
  });

  it("does not restore another signed-in user's purchase reference", () => {
    const first = readCheckout("alice");
    writeCheckout("alice", { ...first, purchaseId: "chk_private" });
    expect(readCheckout("bob").purchaseId).toBeNull();
    expect(readCheckout("bob").requestKey).not.toBe(first.requestKey);
  });
});
