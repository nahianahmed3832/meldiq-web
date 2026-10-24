import { describe, expect, it } from "vitest";
import type { StoredMessage } from "../src/model/types";
import { agentInvocation, commandName, type InvocableAgent, messagesToShare, SHARE_CHOICES } from "../src/sync/agentRules";

const agents: InvocableAgent[] = [
  { id: "a1", displayName: "Reel Maker", activation: "mention", canInvoke: true },
  { id: "a2", displayName: "Reel", activation: "mention", canInvoke: true },
  { id: "a3", displayName: "Data Desk", activation: "command", canInvoke: false },
  { id: "a4", displayName: "Quiet One", activation: "explicit", canInvoke: true },
];

describe("asking an agent from the composer", () => {
  it("matches a mention by its whole name, the longest first", () => {
    expect(agentInvocation("@Reel Maker a 30-second teaser", agents)).toEqual({ installId: "a1", displayName: "Reel Maker", brief: "a 30-second teaser", canInvoke: true });
    expect(agentInvocation("@reel, cut this", agents)).toMatchObject({ installId: "a2", brief: "cut this" });
    // The name must end where it ends: with only "Reel Maker", "@Reel Maker2" names nobody.
    expect(agentInvocation("@Reel Maker2 hi", [agents[0]!])).toBeNull();
  });

  it("matches commands by their slug and keeps whether the person may ask", () => {
    expect(commandName("Data Désk!")).toBe("data-desk");
    expect(agentInvocation("/data-desk revenue by region", agents)).toMatchObject({ installId: "a3", canInvoke: false });
    expect(agentInvocation("@Data Desk revenue", agents)).toBeNull();
  });

  it("leaves ordinary messages, empty requests and explicit-only agents alone", () => {
    expect(agentInvocation("hello @Reel Maker", agents)).toBeNull();
    expect(agentInvocation("@Reel Maker   ", agents)).toBeNull();
    expect(agentInvocation("@Quiet One do it", agents)).toBeNull();
    expect(agentInvocation("/quiet-one do it", agents)).toBeNull();
  });
});

describe("sharing recent channel messages with a request", () => {
  const msg = (i: number, over: Partial<StoredMessage> = {}): StoredMessage =>
    ({ id: `m${i}`, senderUserId: i % 2 ? "u_bob" : "u_alice", kind: "text", text: `message ${i}`, deleted: false, sortTs: 1_000 + i + 0.4, ...over }) as StoredMessage;
  const names = (id: string) => ({ u_alice: "Alice", u_bob: "Bob" })[id] ?? "?";

  it("takes the newest readable messages, oldest first, with whole-number times", () => {
    const items = [msg(1), msg(2, { deleted: true }), msg(3, { kind: "call" }), msg(4, { kind: "undecryptable" }), msg(5), msg(6)];
    expect(messagesToShare(items, names, 2)).toEqual([
      { author: "Bob", text: "message 5", at: 1005 },
      { author: "Alice", text: "message 6", at: 1006 },
    ]);
    expect(messagesToShare(items, names, 20).map((m) => m.text)).toEqual(["message 1", "message 5", "message 6"]);
  });

  it("shares nothing unless a number is chosen, and never more than the server takes", () => {
    const many = Array.from({ length: 400 }, (_, i) => msg(i));
    expect(messagesToShare(many, names, 0)).toEqual([]);
    expect(messagesToShare(many, names, SHARE_CHOICES[SHARE_CHOICES.length - 1]!)).toHaveLength(150);
    const long = Array.from({ length: 40 }, (_, i) => msg(i, { text: "x".repeat(5_000) }));
    const picked = messagesToShare(long, names, 150);
    expect(picked.every((m) => m.text.length === 2_000)).toBe(true);
    expect(picked.reduce((n, m) => n + m.text.length + m.author.length + 2, 0)).toBeLessThanOrEqual(30_000);
  });
});
