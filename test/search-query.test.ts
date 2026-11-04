import { describe, expect, it, vi } from "vitest";
import type { StoredMessage } from "../src/model/types";
import { hasFilters, matchesSearch, parseSearchQuery } from "../src/sync/searchQuery";

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d).getTime();

function msg(over: Partial<StoredMessage>): StoredMessage {
  return {
    id: "m",
    conversationId: "c",
    senderUserId: "bob",
    outgoing: false,
    kind: "text",
    text: "",
    attachments: [],
    sortTs: day(2026, 10, 15) + 3600_000,
    deleted: false,
    ...over,
  } as StoredMessage;
}
const sender = (m: StoredMessage) => (m.senderUserId === "me" ? { name: "Alice Rahman", username: "alice", me: true } : { name: "Bob Chen", username: "bobc", me: false });
const file = (mime: string, voice = false) => ({ id: "a", name: "f", mime, size: 1, key: "", nonce: "", sha256: "", ...(voice ? { voice: true } : {}) });

describe("search filters", () => {
  it("uses local calendar boundaries for during and after across 23-hour and 25-hour days", () => {
    vi.stubEnv("TZ", "America/New_York");
    try {
      for (const [date, month, dateOfMonth, hours] of [
        ["2026-03-08", 3, 8, 23],
        ["2026-11-01", 11, 1, 25],
      ] as const) {
        const start = day(2026, month, dateOfMonth);
        const end = day(2026, month, dateOfMonth + 1);
        expect(end - start).toBe(hours * 3600_000);
        const q = parseSearchQuery(`during:${date}`);
        expect(q).toMatchObject({ text: "", after: start, before: end });
        expect(matchesSearch(msg({ sortTs: start }), q, sender)).toBe(true);
        expect(matchesSearch(msg({ sortTs: end - 1 }), q, sender)).toBe(true);
        expect(matchesSearch(msg({ sortTs: end }), q, sender)).toBe(false);
        expect(parseSearchQuery(`after:${date}`).after).toBe(end);
      }
      expect(parseSearchQuery("during:2026-02-30").text).toBe("during:2026-02-30");
      expect(parseSearchQuery("before:2026-03-08 during:2026-03-08").before).toBe(day(2026, 3, 8));
      expect(parseSearchQuery("during:2026-03-08 before:2026-03-08").before).toBe(day(2026, 3, 8));
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it("reads from:, has:, before: and after:, and leaves the rest as text", () => {
    const q = parseSearchQuery('price from:"Bob Chen" has:image has:link before:2026-10-20 after:2026-10-01 list');
    expect(q).toEqual({ text: "price list", from: "bob chen", has: ["image", "link"], before: day(2026, 10, 20), after: day(2026, 10, 2) });
    expect(hasFilters(q)).toBe(true);
    expect(hasFilters(parseSearchQuery("just words"))).toBe(false);
  });

  it("keeps words that only look like filters as text", () => {
    expect(parseSearchQuery("has:sticker before:yesterday time:10 from:").text).toBe("has:sticker before:yesterday time:10 from:");
    expect(parseSearchQuery("before:2026-02-30").before).toBeNull();
  });

  it("matches text, sender, attachments and days", () => {
    const q = (s: string) => parseSearchQuery(s);
    expect(matchesSearch(msg({ text: "The Price is right" }), q("price"), sender)).toBe(true);
    expect(matchesSearch(msg({ text: "hello" }), q("from:bob"), sender)).toBe(true);
    expect(matchesSearch(msg({ text: "hello" }), q("from:@bobc"), sender)).toBe(true);
    expect(matchesSearch(msg({ text: "hello" }), q("from:me"), sender)).toBe(false);
    expect(matchesSearch(msg({ senderUserId: "me", outgoing: true }), q("from:me"), sender)).toBe(true);
    expect(matchesSearch(msg({ attachments: [file("image/jpeg")] }), q("has:image"), sender)).toBe(true);
    expect(matchesSearch(msg({ attachments: [file("video/mp4")] }), q("has:image"), sender)).toBe(false);
    expect(matchesSearch(msg({ attachments: [file("application/pdf")] }), q("has:file"), sender)).toBe(true);
    expect(matchesSearch(msg({ attachments: [file("audio/webm", true)] }), q("has:file"), sender)).toBe(false);
    expect(matchesSearch(msg({ text: "see https://example.com" }), q("has:link"), sender)).toBe(true);
    expect(matchesSearch(msg({}), q("before:2026-10-15"), sender)).toBe(false);
    expect(matchesSearch(msg({}), q("before:2026-10-16"), sender)).toBe(true);
    expect(matchesSearch(msg({}), q("after:2026-10-15"), sender)).toBe(false);
    expect(matchesSearch(msg({}), q("after:2026-10-14"), sender)).toBe(true);
    expect(matchesSearch(msg({ deleted: true, text: "price" }), q("price"), sender)).toBe(false);
  });
});
