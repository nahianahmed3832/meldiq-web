import { afterEach, describe, expect, it, vi } from "vitest";
import { forgetReadingPositions, readingPosition, readingScope, rememberReading } from "../src/application/readingPosition";

afterEach(() => vi.unstubAllGlobals());
function storage() {
  const values = new Map<string, string>();
  vi.stubGlobal("sessionStorage", { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k) });
  return values;
}
describe("session reading positions", () => {
  it("separates accounts, conversations and threads and removes positions on sign-out", () => {
    storage();
    const scope = readingScope("alice", "general");
    rememberReading(scope, { id: "m1", offset: -23.5, atBottom: false });
    expect(readingPosition(scope)).toMatchObject({ id: "m1", offset: -23.5 });
    expect(readingPosition(readingScope("bob", "general"))).toBeNull();
    expect(readingPosition(readingScope("alice", "general", "thread"))).toBeNull();
    expect(readingPosition(readingScope("alice", "other"))).toBeNull();
    forgetReadingPositions();
    expect(readingPosition(scope)).toBeNull();
  });
  it("tolerates unavailable, malformed, expired and non-finite stored positions", () => {
    const values = storage();
    const key = readingScope("alice", "general");
    for (const raw of [
      "not json",
      "[]",
      JSON.stringify({ [key]: { id: "m1", offset: "bad", atBottom: false, at: Date.now() } }),
      JSON.stringify({ [key]: { id: "m1", offset: 0, atBottom: false, at: 1 } }),
    ]) {
      values.set("meldiq.readingPositions", raw);
      expect(readingPosition(key)).toBeNull();
    }
    vi.stubGlobal("sessionStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    });
    expect(() => rememberReading(key, { id: null, offset: 0, atBottom: true })).not.toThrow();
    expect(readingPosition(key)).toBeNull();
  });
  it("bounds the number of positions kept in a session", () => {
    storage();
    for (let i = 0; i < 100; i++) rememberReading(readingScope("alice", String(i)), { id: "m1", offset: 0, atBottom: false });
    const raw = sessionStorage.getItem("meldiq.readingPositions")!;
    expect(Object.keys(JSON.parse(raw))).toHaveLength(80);
  });
});
