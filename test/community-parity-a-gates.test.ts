import { describe, expect, it } from "vitest";
import { ApiError } from "../src/api/client";
import { zConversation, zOrg } from "../src/api/schemas";
import { channelAbilities, communityHold, type CommunityAccess, deleteAllowed, hasHeading, orgAfterRefusal, refusalNote, verificationNote, waitWords } from "../src/sync/channelGates";
import { LOCK_CHOICES, PARITY_FEATURES, PROFILE_LOCK_CHOICES, shownName } from "../src/sync/communityParity";
import { linkProblem, slugLockedReason, slugProblem } from "../src/sync/communitySettings";
import { inviteFromScan } from "../src/sync/inviteCodes";
import { autoRoleProblem, dropBefore, groupPermissions, moveInOrder, searchPermissions } from "../src/sync/permissionGroups";
import { mentionableRoles, rolesStillMentioned } from "../src/sync/roleMentions";
import { applyDelete } from "../src/sync/rules";
import { roleNameColors } from "../src/ui/chat/memberListRules";
import { orderedRoles } from "../src/ui/workspace/RolesPage";
import { zRole } from "../src/sync/roles";
import type { StoredMessage } from "../src/model/types";

/** Community parity, batch A: what the web offers from the server's permissions, options, lock and onboarding gate. */

const base = {
  id: "c1",
  type: "CHANNEL",
  orgId: "o1",
  archived: false,
  createdAt: 1,
  updatedAt: 1,
  memberCount: 3,
  joined: true,
  canPost: true,
  canManage: false,
  canAttach: true,
};
const channel = (extra: Record<string, unknown> = {}) => zConversation.parse({ ...base, ...extra });
const member: CommunityAccess = { isOwner: false, effective: ["messages.post", "messages.react", "messages.polls", "messages.big_text", "messages.voice"], myRoleIds: ["r-fans"] };
const moderator: CommunityAccess = { ...member, effective: [...member.effective, "messages.manage", "messages.mention_all"] };
const options = (o: Record<string, unknown>) => ({ options: { textOnly: false, noGifs: false, stage: false, readOnly: false, posterRoleIds: [], ...o } });

describe("feature names", () => {
  it("uses the server's batch A features", () => {
    expect(PARITY_FEATURES).toMatchObject({ permissions: "community-permissions", safety: "community-safety", settings: "community-settings" });
    expect(LOCK_CHOICES.map((c) => c.duration)).toEqual(["15m", "1h", "8h", "1d"]);
    expect(PROFILE_LOCK_CHOICES.map((c) => c.duration)).toEqual(["15m", "1h", "1d"]);
  });
});

describe("channel abilities", () => {
  it("offers everything outside communities, and pins to people who may post there", () => {
    const dm = channel({ type: "DM", orgId: null });
    const a = channelAbilities(dm, null, true);
    expect(a).toMatchObject({ attach: true, gifs: true, polls: true, newReactions: true, moderate: true, readOnlyHere: false });
  });

  it("hides nothing while the community's permissions load", () => {
    expect(channelAbilities(channel(), null, true)).toMatchObject({ polls: true, newReactions: true, headings: true, moderate: false });
  });

  it("follows the person's effective keys", () => {
    const a = channelAbilities(channel(), { ...member, effective: ["messages.post"] }, true);
    expect(a).toMatchObject({ polls: false, newReactions: false, headings: false, voice: false, threads: false });
  });

  it("keeps files, GIFs and stickers out of text-only channels, but not from moderators", () => {
    const c = channel(options({ textOnly: true }));
    expect(channelAbilities(c, member, true)).toMatchObject({ attach: false, voice: false, gifs: false, stickers: false });
    expect(channelAbilities(c, moderator, true)).toMatchObject({ attach: true, gifs: true, stickers: true });
  });

  it("refuses GIFs only in no-GIF channels", () => {
    expect(channelAbilities(channel(options({ noGifs: true })), member, true)).toMatchObject({ gifs: false, attach: true, stickers: true });
  });

  it("lets poster roles and moderators post in read-only channels", () => {
    expect(channelAbilities(channel(options({ readOnly: true })), member, true).readOnlyHere).toBe(true);
    expect(channelAbilities(channel(options({ readOnly: true, posterRoleIds: ["r-fans"] })), member, true).readOnlyHere).toBe(false);
    expect(channelAbilities(channel(options({ readOnly: true })), moderator, true).readOnlyHere).toBe(false);
    expect(channelAbilities(channel({ canManage: true, ...options({ readOnly: true }) }), member, true).readOnlyHere).toBe(false);
  });

  it("pins and moderates only with messages.manage or the channel's management, on servers with the feature", () => {
    expect(channelAbilities(channel(), member, true).moderate).toBe(false);
    expect(channelAbilities(channel(), moderator, true).moderate).toBe(true);
    expect(channelAbilities(channel({ canManage: true }), member, true).moderate).toBe(true);
    expect(channelAbilities(channel(), member, false).moderate).toBe(true);
    expect(channelAbilities(channel(), { ...member, isOwner: true }, true)).toMatchObject({ moderate: true, mentionAnyRole: true });
  });

  it("spots headings as the server does", () => {
    expect(hasHeading("# Big")).toBe(true);
    expect(hasHeading("hi\n### small")).toBe(true);
    expect(hasHeading("#hashtag")).toBe(false);
    expect(hasHeading("#### four")).toBe(false);
  });
});

describe("composer holds and refusal notes", () => {
  const now = Date.UTC(2026, 9, 30, 12);
  const open = channelAbilities(channel(), member, true);

  it("asks to finish onboarding first, then shows a lock to non-moderators, then read-only", () => {
    expect(communityHold({ mustFinishOnboarding: true, lockedUntil: now + 1000 }, open, now)).toEqual({ kind: "onboarding" });
    expect(communityHold({ lockedUntil: now + 1000 }, open, now)).toEqual({ kind: "locked", until: now + 1000 });
    expect(communityHold({ lockedUntil: now - 1 }, open, now)).toBeNull();
    expect(communityHold({ lockedUntil: now + 1000 }, channelAbilities(channel(), moderator, true), now)).toBeNull();
    expect(communityHold({}, channelAbilities(channel(options({ readOnly: true })), member, true), now)).toEqual({ kind: "readOnly" });
  });

  it("turns the server's codes into friendly notes and leaves other errors alone", () => {
    for (const code of [
      "reactions_not_allowed",
      "links_not_allowed",
      "text_only_channel",
      "gifs_not_allowed",
      "read_only_channel",
      "onboarding_not_finished",
      "polls_not_allowed",
      "headings_not_allowed",
    ])
      expect(refusalNote(new ApiError(403, code, "x"), now), code).toMatch(/\w/);
    expect(refusalNote(new ApiError(403, "forbidden", "x"))).toBeNull();
    expect(refusalNote(new Error("x"))).toBeNull();
    expect(refusalNote(new ApiError(403, "community_locked_posting", "x", { until: now + 3_600_000 }), now)).toMatch(/1 hour/);
  });

  it("counts down to when a newcomer may post, or asks for a verified email", () => {
    expect(verificationNote({ level: "medium", reason: "wait", allowedAt: now + 4 * 60_000 }, now)).toMatch(/4 minutes/);
    expect(verificationNote({ level: "low", reason: "email", allowedAt: null }, now)).toMatch(/verified email/);
    expect(refusalNote(new ApiError(403, "verification_required", "x", { reason: "wait", allowedAt: now + 30_000 }), now)).toMatch(/30 seconds/);
    expect(waitWords(90 * 60_000)).toBe("2 hours");
    expect(waitWords(3 * 24 * 3_600_000)).toBe("3 days");
  });

  it("updates the community at once after a lock or onboarding refusal", () => {
    const org = zOrg.parse({ id: "o1", name: "Club", memberCount: 3, createdAt: 1, myRole: "MEMBER" });
    expect(orgAfterRefusal(org, new ApiError(403, "onboarding_not_finished", "x")).mustFinishOnboarding).toBe(true);
    expect(orgAfterRefusal(org, new ApiError(403, "community_locked_posting", "x", { until: now })).lockedUntil).toBe(now);
    expect(orgAfterRefusal(org, new ApiError(403, "other", "x"))).toBe(org);
  });
});

describe("moderator deletions", () => {
  const msg = { id: "m1", senderUserId: "author", deleted: false, text: "hi", attachments: [], rich: null } as unknown as StoredMessage;

  it("applies someone else's deletion only in a community channel (the server checked messages.manage)", () => {
    expect(deleteAllowed("author", "mod", true)).toBe(true);
    expect(deleteAllowed("author", "mod", false)).toBe(false);
    expect(applyDelete(msg, "mod", true)?.deleted).toBe(true);
    expect(applyDelete(msg, "mod")).toBeNull();
    expect(applyDelete(msg, "author")?.deleted).toBe(true);
  });
});

describe("role mentions", () => {
  const roles = [
    { id: "r1", name: "Game Night", color: null, mentionable: true },
    { id: "r2", name: "Staff", color: null, mentionable: false },
  ];

  it("offers mentionable roles, and every role to holders of mention_all", () => {
    expect(mentionableRoles(roles, false, "").map((r) => r.id)).toEqual(["r1"]);
    expect(mentionableRoles(roles, true, "st").map((r) => r.id)).toEqual(["r2"]);
    expect(mentionableRoles(roles, true, "night").map((r) => r.id)).toEqual(["r1"]);
  });

  it("sends the roles still named in the text", () => {
    expect(rolesStillMentioned("hey @Game Night and @Staff", roles)).toEqual(["r1", "r2"]);
    expect(rolesStillMentioned("hey everyone", roles)).toEqual([]);
  });
});

describe("roles", () => {
  it("groups permissions the reference's way, unknown keys last", () => {
    const groups = groupPermissions([
      { key: "voice.speak", label: "Speak" },
      { key: "messages.react", label: "Add reactions" },
      { key: "channels.manage", label: "Manage channels" },
      { key: "messages.post", label: "Send messages" },
      { key: "future.key", label: "Future" },
    ]);
    expect(groups.map((g) => g.label)).toEqual(["General", "Text", "Voice", "More"]);
    expect(groups[1].items.map((i) => i.key)).toEqual(["messages.post", "messages.react"]);
  });

  it("searches labels, hints and keys", () => {
    const items = [
      { key: "messages.polls", label: "Create polls", description: "Ask a question" },
      { key: "messages.embed", label: "Embed links", description: null },
    ];
    expect(searchPermissions(items, "poll").map((i) => i.key)).toEqual(["messages.polls"]);
    expect(searchPermissions(items, "EMBED").map((i) => i.key)).toEqual(["messages.embed"]);
    expect(searchPermissions(items, " ")).toHaveLength(2);
  });

  it("refuses powers on roles given automatically", () => {
    expect(autoRoleProblem("none", 3, 0)).toBeNull();
    expect(autoRoleProblem("everyone", 0, 0)).toBeNull();
    expect(autoRoleProblem("joined_before", 1, 0)).toMatch(/can't carry/);
  });

  it("moves roles with the arrows and by dragging", () => {
    expect(moveInOrder(["a", "b", "c"], 2, -1)).toEqual(["a", "c", "b"]);
    expect(moveInOrder(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"]);
    expect(dropBefore(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"]);
    expect(dropBefore(["a", "b", "c"], "a", "a")).toEqual(["a", "b", "c"]);
  });

  it("lists roles highest first and paints gradient names", () => {
    const role = (id: string, position?: number) => zRole.parse({ id, name: id, permissions: [], rev: 1, ...(position === undefined ? {} : { position }) });
    expect(orderedRoles([role("b", 2), role("a", 1)]).map((r) => r.id)).toEqual(["a", "b"]);
    expect(roleNameColors([{ id: "r", name: "R", color: "#111111", color2: "#222222", hoist: false, position: 1 }])).toEqual(["#111111", "#222222"]);
    expect(roleNameColors([{ id: "r", name: "R", color: "#111111", hoist: false, position: 1 }])).toEqual(["#111111"]);
    expect(roleNameColors([])).toBeNull();
  });
});

describe("settings", () => {
  it("shows a nickname where there is one", () => {
    expect(shownName("Ada Lovelace", "Ada")).toBe("Ada");
    expect(shownName("Ada Lovelace", " ")).toBe("Ada Lovelace");
    expect(shownName("Ada Lovelace", null)).toBe("Ada Lovelace");
  });

  it("checks a custom invite link and says why it's locked", () => {
    expect(slugProblem("our-club")).toBeNull();
    expect(slugProblem("")).toBeNull();
    expect(slugProblem("ab")).toMatch(/3 to 32/);
    expect(slugProblem("-club")).toMatch(/hyphen/);
    expect(slugProblem("our club")).toMatch(/lowercase/);
    expect(slugLockedReason(3, 5)).toMatch(/2 more people/);
    expect(slugLockedReason(5, 5)).toBeNull();
  });

  it("accepts only https links with a name", () => {
    expect(linkProblem({ label: "Site", url: "https://example.com" })).toBeNull();
    expect(linkProblem({ label: "", url: "https://example.com" })).toMatch(/name/);
    expect(linkProblem({ label: "Site", url: "http://example.com" })).toMatch(/https/);
  });

  it("opens custom invite links but never bare words", () => {
    expect(inviteFromScan("https://meldiq.app/invite/our-club")).toBe("our-club");
    expect(inviteFromScan("our-club")).toBeNull();
    expect(inviteFromScan("griip://invite/ABC")).toBeNull();
    expect(inviteFromScan("https://meldiq.app/invite/abcdefghjk23")).toBe("ABCD-EFGH-JK23");
  });

  it("reads the new community and channel fields, and older servers without them", () => {
    const org = zOrg.parse({ id: "o1", name: "Club", memberCount: 3, createdAt: 1, lockedUntil: 5, background: "#AABBCC", links: [{ label: "Site", url: "https://x.y" }], mustFinishOnboarding: true });
    expect(org).toMatchObject({ lockedUntil: 5, background: "#AABBCC", mustFinishOnboarding: true });
    const old = zOrg.parse({ id: "o1", name: "Club", memberCount: 3, createdAt: 1 });
    expect(old.lockedUntil).toBeUndefined();
    expect(channel(options({ stage: true, speakerIds: ["u1"] })).options?.speakerIds).toEqual(["u1"]);
    expect(channel().options).toBeUndefined();
  });
});
