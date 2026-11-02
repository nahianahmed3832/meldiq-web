import { describe, expect, it, vi } from "vitest";
import type { StoredMessage } from "../src/model/types";
import { parsePayload, withoutServerFields } from "../src/protocol/payload";
import type { Engine } from "../src/sync/engine";
import { cleanGiveaway, countdown, countdownStep } from "../src/sync/giveaways";
import { wordyGuessProblem, wordyKeys, wordyMarks } from "../src/sync/officialBotRules";
import { maxOpenChoices, panelsProblem } from "../src/sync/posting/tickets";
import { saveTickets, type TicketsState } from "../src/sync/posting/ticketsBot";
import { applyEdit, postedOf } from "../src/sync/rules";
import { wordyCommand } from "../src/ui/chat/wordyLaunch";

const NOW = Date.UTC(2026, 9, 30, 12, 0, 0);

describe("giveaway cards", () => {
  it("keeps a well-formed giveaway and drops a malformed one", () => {
    expect(cleanGiveaway({ id: "gw_1", endsAt: NOW, winners: 3, ended: false })).toEqual({ id: "gw_1", endsAt: NOW, winners: 3, ended: false, winnerIds: [] });
    expect(cleanGiveaway({ id: "gw_1", endsAt: NOW, winners: 2, ended: true, winnerIds: ["u_a", "u_a", 7, "bad id"] })?.winnerIds).toEqual(["u_a"]);
    expect(cleanGiveaway({ id: "gw 1", endsAt: NOW })).toBeNull();
    expect(cleanGiveaway({ id: "gw_1", endsAt: "soon" })).toBeNull();
    expect(cleanGiveaway("x")).toBeNull();
  });

  it("reads the giveaway only from the server's own senders", () => {
    const p = parsePayload(JSON.stringify({ type: "text", text: "🎉 Giveaway", giveaway: { id: "gw_1", endsAt: NOW, winners: 1, ended: false } }))!;
    expect(postedOf(p).giveaway?.id).toBe("gw_1");
    expect(withoutServerFields(p).giveaway).toBeUndefined();
  });

  it("an edit that ends the giveaway replaces the card's boxes and state", () => {
    const card = {
      id: "m1",
      senderUserId: "bot",
      text: "🎉 Giveaway: a key",
      deleted: false,
      mentions: [],
      rich: { embeds: [{ title: "A key" }], textFromEmbeds: true, giveaway: { id: "gw_1", endsAt: NOW, winners: 1, ended: false, winnerIds: [] } },
    } as unknown as StoredMessage;
    const edit = parsePayload(
      JSON.stringify({ type: "edit", target: "m1", text: "ended", embeds: [{ title: "A key (ended)" }], giveaway: { id: "gw_1", endsAt: NOW, winners: 1, ended: true, winnerIds: ["u_w"] } }),
    )!;
    const next = applyEdit(card, "bot", edit, NOW + 1)!;
    expect(next.rich?.giveaway).toEqual({ id: "gw_1", endsAt: NOW, winners: 1, ended: true, winnerIds: ["u_w"] });
    expect(next.rich?.embeds?.[0]?.title).toBe("A key (ended)");
    // An ordinary edit keeps them.
    const plain = applyEdit(card, "bot", parsePayload(JSON.stringify({ type: "edit", target: "m1", text: "x" }))!, NOW + 2)!;
    expect(plain.rich?.giveaway?.ended).toBe(false);
  });

  it("counts down in days, hours, minutes and seconds, faster in the last hour", () => {
    expect(countdown(NOW + 2 * 86_400_000 + 3 * 3_600_000, NOW)).toBe("2d 3h");
    expect(countdown(NOW + 4 * 3_600_000 + 12 * 60_000, NOW)).toBe("4h 12m");
    expect(countdown(NOW + 12 * 60_000 + 5_000, NOW)).toBe("12m 5s");
    expect(countdown(NOW + 8_000, NOW)).toBe("8s");
    expect(countdown(NOW - 1, NOW)).toBe("any moment");
    expect(countdownStep(NOW + 2 * 3_600_000, NOW)).toBe(60_000);
    expect(countdownStep(NOW + 60_000, NOW)).toBe(1_000);
  });
});

describe("Wordy", () => {
  it("reads marks and colours the keyboard with each letter's best mark", () => {
    expect(wordyMarks("🟩🟨⬛⬛🟩")).toEqual(["right", "close", "absent", "absent", "right"]);
    const keys = wordyKeys([
      { guess: "crane", marks: "⬛🟨⬛⬛⬛" },
      { guess: "trout", marks: "⬛🟩⬛⬛⬛" },
    ]);
    expect(keys.r).toBe("right");
    expect(keys.c).toBe("absent");
  });

  it("checks a guess is five letters before sending", () => {
    expect(wordyGuessProblem("crane")).toBeNull();
    expect(wordyGuessProblem("cran")).toMatch(/five/);
    expect(wordyGuessProblem("cr4ne")).toMatch(/five/);
  });

  it("knows the /wordy command, with or without a guess", () => {
    expect(wordyCommand("/wordy")).toBe("");
    expect(wordyCommand("/Wordy CRANE")).toBe("crane");
    expect(wordyCommand("/wordy stats please")).toBeNull();
    expect(wordyCommand("/word")).toBeNull();
  });
});

describe("Tickets with the Tickets bot", () => {
  const base: TicketsState = {
    enabled: true,
    maxOpenPerPerson: 2,
    panels: [{ id: "p1", name: "Support", postChannelId: "c1", categoryId: null, logChannelId: null, supportRoleId: "rl_s", welcomeMessage: "Hi {user}", postedMessageId: null }],
    transcripts: false,
    viaBot: true,
    botsPlus: false,
    panelLimit: 2,
    maxOpenLimit: 3,
    paused: ["panels"],
  };

  it("offers 1–3 open tickets free and up to 10 with Bots+", () => {
    expect(maxOpenChoices(3)).toEqual([1, 2, 3]);
    expect(maxOpenChoices(10)).toHaveLength(10);
  });

  it("checks the welcome line's length", () => {
    expect(panelsProblem([{ ...base.panels[0], welcomeMessage: "x".repeat(501) }], 2)).toMatch(/500/);
  });

  it("sends only what changed, and no Plus extras without Bots+", async () => {
    const put = vi.fn().mockResolvedValue({ bot: { key: "tickets", name: "Tickets", available: true, enabled: true, look: { displayName: "Tickets" }, settings: {}, plusPaused: [] } });
    const engine = {
      api: {
        json: (method: string, path: string, _schema: unknown, opts?: { body?: unknown }) => {
          if (method === "PUT") return put(path, opts?.body);
          return Promise.resolve({ botsPlus: false, botsPlusUntil: null, canEdit: true, bots: [] });
        },
      },
      refreshAll: () => Promise.resolve(),
    } as unknown as Engine;
    // Only the per-person limit changed: the panels (with paused extras) aren't sent back.
    await saveTickets(engine, "o1", base, { ...base, maxOpenPerPerson: 3 }).catch(() => undefined);
    expect(put).toHaveBeenCalledTimes(1);
    expect(put.mock.calls[0][1]).toEqual({ settings: { maxOpenPerPerson: 3 } });
    // Panels changed without Bots+: sent without the extras.
    put.mockClear();
    await saveTickets(engine, "o1", base, { ...base, panels: [{ ...base.panels[0], name: "Help" }] }).catch(() => undefined);
    expect(put.mock.calls[0][1]).toEqual({ settings: { panels: [{ id: "p1", name: "Help", postChannelId: "c1", categoryId: null, logChannelId: null }] } });
  });
});
