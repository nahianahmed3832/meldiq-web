import { describe, expect, it } from "vitest";
import type { StoredMessage } from "../src/model/types";
import { agentInvocation, commandName, type InvocableAgent, messagesToShare, SHARE_CHOICES } from "../src/sync/agentRules";
import { formatCost } from "../src/sync/work";
import { readCopy } from "./support/contracts";

const agents: InvocableAgent[] = [
  { id: "a1", displayName: "Reel Maker", activation: "mention", canInvoke: true },
  { id: "a2", displayName: "Reel", activation: "mention", canInvoke: true },
  { id: "a3", displayName: "Data Desk", activation: "command", canInvoke: false },
  { id: "a4", displayName: "Quiet One", activation: "explicit", canInvoke: true },
];

describe("asking an agent from the composer", () => {
  // The server's cases (shared/contracts/fixtures/rules), which its channel readers and the Android app pass too.
  const shared = readCopy<{ agents: Omit<InvocableAgent, "canInvoke">[]; cases: { why: string; text: string; expect: { installId: string; brief: string } | null }[] }>("rules/agent-invocation.json");
  const sharedAgents = shared.agents.map((a) => ({ ...a, canInvoke: true }));

  it.each(shared.cases.map((c) => [c.why, c] as const))("%s", (_why, c) => {
    const inv = agentInvocation(c.text, sharedAgents);
    expect(inv && { installId: inv.installId, brief: inv.brief }).toEqual(c.expect);
  });

  it("names commands as the server does, and keeps whether the person may ask", () => {
    expect(commandName("Data Désk!")).toBe("data-desk");
    expect(agentInvocation("/data-desk revenue by region", agents)).toEqual({ installId: "a3", displayName: "Data Desk", brief: "revenue by region", canInvoke: false });
  });

  it("with only the longer name, a longer word after it names nobody", () => {
    expect(agentInvocation("@Reel Maker2 hi", [agents[0]!])).toBeNull();
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

describe("estimated costs", () => {
  it("show nothing as $0 and keep small amounts readable", () => {
    expect(formatCost(0)).toBe("$0");
    expect(formatCost(6_000)).toBe("$0.0060");
    expect(formatCost(125_000)).toBe("$0.125");
    expect(formatCost(2_500_000)).toBe("$2.50");
  });
});
