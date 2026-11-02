import { describe, expect, it } from "vitest";
import { ApiError } from "../src/api/client";
import { zOrg } from "../src/api/schemas";
import { parsePayload, withoutServerFields } from "../src/protocol/payload";
import { webhookAddress } from "../src/sync/posting/api";
import { colorNumber, draftFromJson, draftPreview, draftProblems, draftToJson, emptyBox, emptyButton, moved, type PostDraft, sampleDraft, toWebhookBody } from "../src/sync/posting/draft";
import { avatarRevOf, buttonText, cleanButton, cleanButtons, cleanEmbed, cleanEmbeds, cleanWebhook, colorHex, isHttpsUrl, POST_LIMITS } from "../src/sync/posting/embeds";
import { parseInline, parseMarkdown } from "../src/sync/posting/markdown";
import { givableRoles, QUICK_ROLE_EMOJI, REACTION_ROLES_MAX, rowsProblem, withEmoji } from "../src/sync/posting/reactionRoles";
import { isTicketStaff, looksLikeTicket, panelsProblem, ticketError } from "../src/sync/posting/tickets";
import { postedOf, textMessage } from "../src/sync/rules";
import type { QueueItem } from "../src/api/schemas";
import type { RolesOverview } from "../src/sync/roles";

/** Community parity C (docs/MELDIQ_COMMUNITY_PARITY.md §1, server docs/COMMUNITY_PARITY_API.md › Posting tools). */

const item: QueueItem = {
  id: 1,
  kind: "message",
  conversationId: "c_1",
  messageId: "m_1",
  senderUserId: "u_hook",
  senderDeviceId: "",
  createdAt: 1000,
  expiresAt: 1000,
  payload: { cls: "message", serverTs: 1000 },
};

describe("payload: boxes, buttons and webhook", () => {
  it("reads a webhook post's fields and keeps them cleaned in the message", () => {
    // Arrange
    const json = JSON.stringify({
      type: "text",
      text: "Welcome\n\nSay hi",
      textFromEmbeds: true,
      embeds: [{ title: "Welcome", description: "Say **hi**", color: 0x5865f2, author: { name: "Mods" }, image: { url: "https://i.example/a.png" }, footer: { text: "fine print" } }],
      buttons: [
        { kind: "link", label: "Terms", emoji: "📜", url: "https://example.com/terms" },
        { kind: "action", action: "open_ticket", label: "Open a ticket", emoji: null, panelId: "tp_1" },
      ],
      webhook: { id: "wh_1", name: "Plucky Puffin", avatarUrl: "/v1/webhooks/wh_1/avatar?rev=3" },
    });

    // Act
    const p = parsePayload(json)!;
    const m = textMessage(p, item, false, 1000, { ids: [], all: false });

    // Assert
    expect(m.rich?.embeds).toEqual([{ title: "Welcome", description: "Say **hi**", color: 0x5865f2, author: "Mods", image: "https://i.example/a.png", footer: "fine print" }]);
    expect(m.rich?.buttons).toEqual([
      { kind: "link", label: "Terms", emoji: "📜", url: "https://example.com/terms" },
      { kind: "action", action: "open_ticket", label: "Open a ticket", emoji: null, panelId: "tp_1" },
    ]);
    expect(m.rich?.webhook).toEqual({ id: "wh_1", name: "Plucky Puffin", avatarRev: 3 });
    expect(m.rich?.textFromEmbeds).toBe(true);
  });

  it("drops bad boxes and buttons one by one instead of losing the message", () => {
    const p = parsePayload(
      JSON.stringify({
        type: "text",
        text: "hi",
        embeds: [{ title: "ok" }, "nope", null, [1], { url: "javascript:alert(1)" }, { description: 42 }],
        buttons: [{ kind: "link", label: "x", url: "javascript:alert(1)" }, { kind: "action", action: "ban_everyone", label: "x" }, { kind: "link", url: "https://a.example" }, 7],
        webhook: { id: "../../etc", name: "x" },
      }),
    )!;
    expect(p).not.toBeNull();
    const r = postedOf(p);
    expect(r.embeds).toEqual([{ title: "ok" }]);
    expect(r.buttons).toBeUndefined();
    expect(r.webhook).toBeUndefined();
  });

  it("refuses absurd lists outright (bounded like the rest of the payload)", () => {
    expect(parsePayload(JSON.stringify({ type: "text", embeds: Array.from({ length: 51 }, () => ({ title: "x" })) }))).toBeNull();
    expect(parsePayload(JSON.stringify({ type: "text", buttons: Array.from({ length: 51 }, () => ({})) }))).toBeNull();
  });

  it("keeps at most 10 boxes and 5 buttons, and cuts oversized text", () => {
    const embeds = cleanEmbeds(Array.from({ length: 12 }, (_, i) => ({ title: `${i}`.repeat(400), description: "d".repeat(5000) })));
    expect(embeds).toHaveLength(POST_LIMITS.embeds);
    expect([...embeds[0].title!].length).toBe(POST_LIMITS.title);
    expect(embeds[0].description).toHaveLength(POST_LIMITS.description);
    const buttons = cleanButtons(Array.from({ length: 8 }, () => ({ kind: "link", label: "x".repeat(200), url: "https://a.example" })));
    expect(buttons).toHaveLength(POST_LIMITS.buttons);
    expect(buttons[0].label).toHaveLength(POST_LIMITS.buttonLabel);
  });

  it("only takes https links and pictures, with a host and no credentials", () => {
    for (const bad of ["javascript:alert(1)", "http://a.example", "data:image/png;base64,AAAA", "https://user:pw@a.example", "https:// a.example", "//a.example", "https://" + "a".repeat(2050)])
      expect(isHttpsUrl(bad), bad).toBe(false);
    expect(isHttpsUrl("https://a.example/x?y=1")).toBe(true);
    expect(cleanEmbed({ title: "t", url: "http://a.example", image: { url: "javascript:x" }, thumbnail: { url: "https://ok.example/t.png" } })).toEqual({
      title: "t",
      thumbnail: "https://ok.example/t.png",
    });
  });

  it("removes control and direction-changing characters from box text", () => {
    expect(cleanEmbed({ title: "a‮b\u0000c", description: "line\nnext" })).toEqual({ title: "abc", description: "line\nnext" });
  });

  it("drops a box with nothing to show and a colour that isn't one", () => {
    expect(cleanEmbed({ url: "https://a.example", color: 5 })).toBeNull();
    expect(cleanEmbed({ title: "t", color: -1 })).toEqual({ title: "t" });
    expect(cleanEmbed({ title: "t", color: 0x1000000 })).toEqual({ title: "t" });
    expect(cleanEmbed({ title: "t", color: 1.5 })).toEqual({ title: "t" });
  });

  it("never reads these fields from another person's end-to-end message", () => {
    const p = parsePayload(JSON.stringify({ type: "text", text: "hi", embeds: [{ title: "fake" }], webhook: { id: "wh_1", name: "Meldiq Staff" }, textFromEmbeds: true }))!;
    const stripped = withoutServerFields(p);
    expect(stripped).toEqual({ type: "text", text: "hi" });
    expect(textMessage(stripped, item, false, 1000, { ids: [], all: false }).rich).toBeNull();
  });

  it("shows text made from boxes only when there are boxes to show", () => {
    const p = parsePayload(JSON.stringify({ type: "text", text: "hi", textFromEmbeds: true, embeds: ["bad"] }))!;
    expect(postedOf(p).textFromEmbeds).toBeUndefined();
  });
});

describe("webhook sender and picture", () => {
  it("keeps only the server's own picture address for that webhook", () => {
    expect(avatarRevOf("/v1/webhooks/wh_1/avatar?rev=12", "wh_1")).toBe(12);
    expect(avatarRevOf("/v1/webhooks/wh_2/avatar?rev=12", "wh_1")).toBeNull();
    expect(avatarRevOf("https://evil.example/a.png", "wh_1")).toBeNull();
    expect(avatarRevOf("/v1/webhooks/wh_1/avatar?rev=0", "wh_1")).toBeNull();
    expect(avatarRevOf("/v1/webhooks/wh_1/avatar?rev=1&x=/v1/users", "wh_1")).toBeNull();
  });

  it("needs an id and a name, bounded", () => {
    expect(cleanWebhook({ id: "wh_1", name: "" })).toBeNull();
    expect(cleanWebhook({ id: "wh_1", name: "n".repeat(200), avatarUrl: "https://x.example/a.png" })).toEqual({ id: "wh_1", name: "n".repeat(80), avatarRev: null });
  });
});

describe("box rendering logic", () => {
  it("colour bars are #rrggbb", () => {
    expect(colorHex(0x5865f2)).toBe("#5865f2");
    expect(colorHex(0xff)).toBe("#0000ff");
    expect(colorHex(undefined)).toBeNull();
    expect(colorHex(-3)).toBeNull();
  });

  it("buttons say their emoji and label, or what they do", () => {
    expect(buttonText({ kind: "link", label: "Terms", emoji: "📜", url: "https://a.example" })).toBe("📜 Terms");
    expect(buttonText({ kind: "action", action: "close_ticket", label: null, emoji: null, panelId: null })).toBe("Close ticket");
    expect(cleanButton({ kind: "action", action: "open_ticket", label: "Go", panelId: "../x" })).toEqual({ kind: "action", action: "open_ticket", label: "Go", emoji: null, panelId: null });
  });

  it("reads the markdown boxes use into plain tokens", () => {
    expect(parseInline("**bold** and *it* and `code` and ~~gone~~ and __under__")).toEqual([
      { t: "bold", children: [{ t: "text", v: "bold" }] },
      { t: "text", v: " and " },
      { t: "italic", children: [{ t: "text", v: "it" }] },
      { t: "text", v: " and " },
      { t: "code", v: "code" },
      { t: "text", v: " and " },
      { t: "strike", children: [{ t: "text", v: "gone" }] },
      { t: "text", v: " and " },
      { t: "underline", children: [{ t: "text", v: "under" }] },
    ]);
    expect(parseMarkdown("## Rules\n- one\n- two\n> quoted\n\nplain\nline")).toEqual([
      { t: "h", level: 2, inline: [{ t: "text", v: "Rules" }] },
      { t: "li", inline: [{ t: "text", v: "one" }] },
      { t: "li", inline: [{ t: "text", v: "two" }] },
      { t: "quote", inline: [{ t: "text", v: "quoted" }] },
      { t: "p", inline: [{ t: "text", v: "plain\nline" }] },
    ]);
    expect(parseMarkdown("```\n<b>x</b>\n```")).toEqual([{ t: "pre", v: "<b>x</b>" }]);
  });

  it("makes links only of https addresses; anything else stays text", () => {
    expect(parseInline("[site](https://a.example)")).toEqual([{ t: "link", label: "site", url: "https://a.example" }]);
    expect(parseInline("[x](javascript:alert(1))")).toEqual([{ t: "text", v: "[x](javascript:alert(1))" }]);
    expect(parseInline("[x](http://a.example)")).toEqual([{ t: "text", v: "[x](http://a.example)" }]);
  });

  it("doesn't nest styles without end, and leaves snake_case alone", () => {
    const deep = "**".repeat(40) + "x" + "**".repeat(40);
    expect(() => parseInline(deep)).not.toThrow();
    expect(parseInline("a_snake_case_name")).toEqual([{ t: "text", v: "a_snake_case_name" }]);
  });
});

describe("Make a post: JSON in and out", () => {
  const filled = (): PostDraft => ({
    content: "Hello",
    boxes: [{ ...emptyBox("#5865f2"), title: "T", description: "D", url: "https://a.example", author: "A", image: "https://a.example/i.png", thumbnail: "https://a.example/t.png", footer: "F" }],
    buttons: [{ ...emptyButton(), emoji: "📜", label: "Terms", url: "https://a.example/terms" }],
    threadName: "",
  });

  it("round-trips through Copy JSON and Import JSON", () => {
    const d = filled();
    const back = draftFromJson(draftToJson(d));
    expect("draft" in back).toBe(true);
    if (!("draft" in back)) return;
    expect(toWebhookBody(back.draft)).toEqual(toWebhookBody(d));
    expect(toWebhookBody(d)).toEqual({
      content: "Hello",
      embeds: [
        {
          title: "T",
          description: "D",
          url: "https://a.example",
          color: 0x5865f2,
          author: { name: "A" },
          image: { url: "https://a.example/i.png" },
          thumbnail: { url: "https://a.example/t.png" },
          footer: { text: "F" },
        },
      ],
      buttons: [{ label: "Terms", emoji: "📜", url: "https://a.example/terms" }],
    });
  });

  it("reads a Discord webhook message, its colours and link-button components", () => {
    const r = draftFromJson(
      JSON.stringify({
        content: "x",
        embeds: [{ title: "a", color: "#FF0000", fields: [{ name: "dropped" }] }],
        components: [
          {
            type: 1,
            components: [
              { type: 2, style: 5, label: "Go", emoji: { name: "🚀" }, url: "https://a.example" },
              { type: 2, style: 1, label: "not a link", custom_id: "x" },
            ],
          },
        ],
      }),
    );
    if (!("draft" in r)) throw new Error(r.error);
    expect(r.draft.boxes[0].color).toBe("#ff0000");
    expect(r.draft.buttons.map((b) => [b.emoji, b.label, b.url])).toEqual([["🚀", "Go", "https://a.example"]]);
  });

  it("says why a paste can't be read", () => {
    expect(draftFromJson("{nope")).toEqual({ error: "That isn't valid JSON." });
    expect(draftFromJson("[1,2]")).toHaveProperty("error");
    expect(draftFromJson("x".repeat(100_001))).toEqual({ error: "That JSON is too long." });
  });

  it("caps imported boxes and buttons", () => {
    const r = draftFromJson(JSON.stringify({ embeds: Array.from({ length: 15 }, () => ({ title: "t" })), buttons: Array.from({ length: 9 }, () => ({ label: "b", url: "https://a.example" })) }));
    if (!("draft" in r)) throw new Error(r.error);
    expect(r.draft.boxes).toHaveLength(10);
    expect(r.draft.buttons).toHaveLength(5);
  });

  it("lists what stops a post, by the server's limits", () => {
    const d = filled();
    expect(draftProblems(d, false)).toEqual([]);
    expect(draftProblems({ ...d, content: "", boxes: [] }, false)).toContain("Write some text or fill in a box.");
    expect(draftProblems(d, true)).toContain("A forum post needs a title.");
    expect(draftProblems({ ...d, buttons: [{ ...emptyButton(), label: "x", url: "javascript:alert(1)" }] }, false)).toContain("Button 1: it needs an https:// address.");
    expect(draftProblems({ ...d, boxes: [{ ...d.boxes[0], image: "http://a.example/i.png" }] }, false)).toContain("Box 1: the big picture needs an https:// address.");
    const big = Array.from({ length: 2 }, () => ({ ...emptyBox(), description: "x".repeat(4000) }));
    expect(draftProblems({ ...d, boxes: big }, false)).toContain("All the boxes together are over 6000 characters.");
    expect(draftProblems({ ...d, boxes: [{ ...d.boxes[0], color: "red" }] }, false)).toContain("Box 1: the colour should look like #5865f2.");
  });

  it("previews through the same cleaning as a received post", () => {
    const p = draftPreview({ ...filled(), boxes: [{ ...emptyBox(), title: "ok", image: "javascript:x" }] });
    expect(p.embeds).toEqual([{ title: "ok" }]);
    expect(p.buttons).toHaveLength(1);
  });

  it("starts from a welcome box, a rules box and two buttons", () => {
    const s = sampleDraft("Club");
    expect(s.boxes.map((b) => b.title)).toEqual(["Welcome to Club!", "Rules"]);
    expect(s.buttons).toHaveLength(2);
    expect(draftProblems(s, false)).toEqual([]);
  });

  it("moves boxes up and down without going past either end", () => {
    expect(moved(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"]);
    expect(moved(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    expect(moved(["a", "b", "c"], 2, -1)).toEqual(["a", "c", "b"]);
    expect(colorNumber("#00ff00")).toBe(0x00ff00);
    expect(colorNumber("")).toBeUndefined();
  });

  it("builds the address shown once", () => {
    expect(webhookAddress("https://api.example/", "wh_1", "mqw_abc")).toBe("https://api.example/v1/webhooks/wh_1/mqw_abc");
  });
});

describe("reaction roles", () => {
  const overview = {
    catalog: [
      { key: "workspace.edit", category: "x", label: "", description: "", admin: true, ownerOnly: false, guestAllowed: false, restrictable: false },
      { key: "messages.send", category: "x", label: "", description: "", admin: false, ownerOnly: false, guestAllowed: true, restrictable: false },
    ],
    roles: [
      { id: "r1", name: "Gamer", permissions: ["messages.send"], denies: [], rev: 1, memberCount: 0, archived: false, canEdit: true, canAssign: true, hoist: false },
      { id: "r2", name: "Admin-ish", permissions: ["workspace.edit"], denies: [], rev: 1, memberCount: 0, archived: false, canEdit: true, canAssign: true, hoist: false },
      { id: "r3", name: "Old", permissions: [], denies: [], rev: 1, memberCount: 0, archived: true, canEdit: true, canAssign: true, hoist: false },
      { id: "r4", name: "Above me", permissions: [], denies: [], rev: 1, memberCount: 0, archived: false, canEdit: false, canAssign: false, hoist: false },
    ],
  } as unknown as Pick<RolesOverview, "roles" | "catalog">;

  it("offers only live roles this person may give that carry no admin power", () => {
    expect(givableRoles(overview).map((r) => r.id)).toEqual(["r1"]);
  });

  it("adds an emoji once, up to 20", () => {
    const one = withEmoji([], "✅");
    expect(withEmoji(one, "✅")).toEqual(one);
    const full = Array.from({ length: REACTION_ROLES_MAX }, (_, i) => ({ emoji: `${i}`, roleId: `r${i}` }));
    expect(withEmoji(full, "🔥")).toHaveLength(REACTION_ROLES_MAX);
    expect(QUICK_ROLE_EMOJI).toHaveLength(10);
  });

  it("each row needs a role, and each emoji and role appear once", () => {
    expect(rowsProblem([])).toBeNull();
    expect(rowsProblem([{ emoji: "✅", roleId: "" }])).toBe("Pick a role for every emoji.");
    expect(
      rowsProblem([
        { emoji: "✅", roleId: "r1" },
        { emoji: "🎮", roleId: "r1" },
      ]),
    ).toBe("Each role can be given by one emoji.");
    expect(
      rowsProblem([
        { emoji: "✅", roleId: "r1" },
        { emoji: "🎮", roleId: "r2" },
      ]),
    ).toBeNull();
  });
});

describe("tickets", () => {
  it("knows ticket channels by the server's naming", () => {
    expect(looksLikeTicket("ticket-12-sam")).toBe(true);
    expect(looksLikeTicket("tickets")).toBe(false);
    expect(looksLikeTicket(null)).toBe(false);
  });

  it("staff are owners, admins and people with a moderation power", () => {
    expect(isTicketStaff({ isOwner: false, canManageOrg: false, effective: ["reports.view"] })).toBe(true);
    expect(isTicketStaff({ isOwner: false, canManageOrg: false, effective: ["messages.send"] })).toBe(false);
  });

  it("checks panels before saving", () => {
    const p = { name: "Support", postChannelId: "c1", categoryId: null, logChannelId: null };
    expect(panelsProblem([p], 2)).toBeNull();
    expect(panelsProblem([p, p, p], 2)).toBe("A community has 2 panels at most.");
    expect(panelsProblem([{ ...p, name: " " }], 2)).toBe("Panel 1 needs a name.");
    expect(panelsProblem([{ ...p, postChannelId: "" }], 2)).toBe("Panel 1: pick the channel its message goes in.");
  });

  it("says refusals in words", () => {
    expect(ticketError(new ApiError(409, "ticket_limit", "x", { max: 2 }))).toBe("You can have 2 tickets open here at once. Close one first.");
    expect(ticketError(new ApiError(409, "tickets_off", "x"))).toBe("This community has turned tickets off.");
  });

  it("reads the community view's tickets summary, and ignores a malformed one", () => {
    const base = { id: "o1", name: "Club", slug: null, description: null, myRole: "MEMBER", memberCount: 3, createdAt: 1 };
    expect(zOrg.parse({ ...base, tickets: { panels: [{ id: "tp_1", name: "Support" }], maxOpenPerPerson: 2, openByMe: 0 } }).tickets?.panels).toHaveLength(1);
    expect(zOrg.parse({ ...base, tickets: { panels: "nope" } }).tickets).toBeNull();
    expect(zOrg.parse(base).tickets).toBeNull();
  });
});
