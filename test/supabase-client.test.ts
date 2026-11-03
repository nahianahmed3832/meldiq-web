import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { LocalStore } from "../src/store/db";
import { EncryptedSupabaseStorage, createMeldiqSupabase } from "../src/auth/supabaseClient";
import { SupabaseInvalidation } from "../src/realtime/supabaseEvents";

let store: LocalStore | undefined;
afterEach(() => {
  store?.close();
});
describe("staged Supabase client security", () => {
  it("seals tokens at rest and reads them after reopening", async () => {
    const name = `supabase-vault-${crypto.randomUUID()}`;
    store = await LocalStore.open(name);
    await new EncryptedSupabaseStorage(store).setItem("session", "synthetic-refresh-token");
    const sealed = await store.legacy.get("kv", "supabase:sealed:session");
    expect(JSON.stringify(sealed)).not.toContain("synthetic-refresh-token");
    store.close();
    store = await LocalStore.open(name);
    expect(await new EncryptedSupabaseStorage(store).getItem("session")).toBe("synthetic-refresh-token");
  });
  it("serializes concurrent wrapping-key creation", async () => {
    store = await LocalStore.open(`supabase-concurrent-${crypto.randomUUID()}`);
    await Promise.all([new EncryptedSupabaseStorage(store).setItem("first", "one"), new EncryptedSupabaseStorage(store).setItem("second", "two")]);
    const storage = new EncryptedSupabaseStorage(store);
    expect(await storage.getItem("first")).toBe("one");
    expect(await storage.getItem("second")).toBe("two");
  });
  it("rejects a ciphertext moved to another session key and removes only the corrupt entry", async () => {
    store = await LocalStore.open(`supabase-tamper-${crypto.randomUUID()}`);
    const storage = new EncryptedSupabaseStorage(store);
    await storage.setItem("first", "one");
    await store.legacy.put("kv", await store.legacy.get("kv", "supabase:sealed:first"), "supabase:sealed:second");
    expect(await storage.getItem("second")).toBeNull();
    expect(await storage.getItem("first")).toBe("one");
    await storage.removeItem("first");
    expect(await storage.getItem("first")).toBeNull();
  });
  it("rejects privileged keys and mismatched project origins before constructing a client", async () => {
    store = await LocalStore.open(`supabase-config-${crypto.randomUUID()}`);
    expect(() => createMeldiqSupabase({ url: "https://stage.supabase.co", projectRef: "stage", publishableKey: "sb_secret_never-public" }, store!)).toThrow("publishable");
    expect(() => createMeldiqSupabase({ url: "https://other.supabase.co", projectRef: "stage", publishableKey: "sb_publishable_test" }, store!)).toThrow("origin");
  });
  it("validates invalidation IDs and refuses message content/entitlement injection", () => {
    const event = { eventId: crypto.randomUUID(), messageId: "message001", conversationId: "conversation001" };
    expect(SupabaseInvalidation.safeParse(event).success).toBe(true);
    expect(SupabaseInvalidation.safeParse({ ...event, text: "forged", subscription: "plus" }).success).toBe(false);
  });
});
