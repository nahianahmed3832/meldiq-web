import { describe, expect, it } from "vitest";
import { zMember, zOrg } from "../src/api/schemas";
import { audioProcessing } from "../src/call/rules";
import { channelMenu } from "../src/sync/communityRules";
import { applyOp, communityLevel, communityMutedUntil, EMPTY_PREFS, levelOf, MUTE_FOREVER, type NavPrefs, zNavPrefs } from "../src/sync/navPrefs";
import { COLOR_PRESETS, namePaint } from "../src/ui/people/NameStyle";

/** Stage 1 of the 2026-10-28 round: community mute, name styles and tags, voice options, Builder mode. */
describe("community mute (API 0.46.0)", () => {
  const now = 1_000_000;
  const muted = (until: number | null): NavPrefs => applyOp(EMPTY_PREFS, { op: "community", mutedUntil: until });

  it("mutes every channel while it runs, even one with its own level, and ends by itself", () => {
    const p = applyOp(muted(now + 60_000), { op: "notify", conversationId: "ch1", level: "all" });
    expect(communityMutedUntil(p, now)).toBe(now + 60_000);
    expect(levelOf(p, "ch1", null, now)).toBe("none");
    expect(communityLevel(p, now)).toBe("none");
    expect(levelOf(p, "ch1", null, now + 61_000)).toBe("all");
    expect(communityMutedUntil(p, now + 61_000)).toBeNull();
  });

  it("keeps the mute when another community setting changes, and unmutes with null", () => {
    const p = applyOp(muted(MUTE_FOREVER), { op: "community", level: "mentions" });
    expect(p.community).toEqual({ level: "mentions", suppressEveryone: false, mutedUntil: MUTE_FOREVER });
    const off = applyOp(p, { op: "community", mutedUntil: null });
    expect(off.community?.mutedUntil).toBeUndefined();
    expect(communityLevel(off, now)).toBe("mentions");
  });

  it("reads documents from servers without it", () => {
    expect(zNavPrefs.parse({ community: { level: "all", suppressEveryone: false } }).community?.mutedUntil).toBeUndefined();
  });
});

describe("name styles and tags", () => {
  it("paints one colour solid and two or three as a gradient", () => {
    expect(namePaint(null)).toBeUndefined();
    expect(namePaint(["#ff0000"])).toEqual({ color: "#ff0000" });
    expect(namePaint(["#ff0000", "#00ff00"])).toEqual({ "--name-paint": "linear-gradient(90deg, #ff0000, #00ff00)" });
  });

  it("has presets of two or three valid colours with unique ids", () => {
    expect(new Set(COLOR_PRESETS.map((p) => p.id)).size).toBe(COLOR_PRESETS.length);
    for (const p of COLOR_PRESETS) {
      expect(p.colors.length).toBeGreaterThanOrEqual(2);
      expect(p.colors.length).toBeLessThanOrEqual(3);
      for (const c of p.colors) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("keeps a member's look from a list and drops what it can't draw", () => {
    const m = zMember.parse({
      id: "u1",
      username: "ada",
      displayName: "Ada",
      avatarMedia: { kind: "gif", rev: 3 },
      profileStyle: { decoration: "neon", effect: null, accent: null, nameFont: "pixel", nameColors: ["#ff00aa", "#22d3ee"], nameEffect: "glow", tagOrgId: "o1" },
      tag: { orgId: "o1", text: "MC", color: "#22c55e" },
    });
    expect(m.avatarMedia).toEqual({ kind: "gif", rev: 3 });
    expect(m.profileStyle).toMatchObject({ nameFont: "pixel", nameColors: ["#ff00aa", "#22d3ee"], nameEffect: "glow" });
    expect(m.tag).toEqual({ orgId: "o1", text: "MC", color: "#22c55e" });
    const odd = zMember.parse({ id: "u2", username: "b", displayName: "B", profileStyle: { decoration: null, effect: null, accent: null, nameFont: "comic", nameColors: ["red"] }, tag: { orgId: 1 } });
    expect(odd.profileStyle).toMatchObject({ nameFont: null, nameColors: null });
    expect(odd.tag).toBeNull();
    // Older servers: nothing new, nothing breaks.
    expect(zMember.parse({ id: "u3", username: "c", displayName: "C" })).toMatchObject({ avatarMedia: null, profileStyle: null, tag: null });
  });

  it("reads a community's tag, ignoring anything that isn't 2–4 capitals or digits", () => {
    const base = { id: "o1", name: "Lab", myRole: "MEMBER", memberCount: 2, createdAt: 1 };
    expect(zOrg.parse({ ...base, tag: "MC" }).tag).toBe("MC");
    expect(zOrg.parse({ ...base, tag: "<b>" }).tag).toBeNull();
    expect(zOrg.parse(base).tag).toBeNull();
  });
});

describe("voice options", () => {
  it("follows noise reduction for gain unless chosen, and asks for the chosen microphone without failing", () => {
    expect(audioProcessing(true)).toEqual({ echoCancellation: true, noiseSuppression: true, autoGainControl: true });
    expect(audioProcessing(false, { echoCancellation: false, autoGain: true, microphoneId: "mic-2" })).toEqual({
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: true,
      deviceId: { ideal: "mic-2" },
    });
  });
});

describe("Builder mode", () => {
  it("adds Copy channel ID to a channel's menu only when on", () => {
    const ch = { id: "c1", name: "general", joined: true, unread: 0, mentions: 0, muted: false, canManage: false, archived: false } as Parameters<typeof channelMenu>[0];
    const input = { starred: false, canArrange: false, canMoveUp: false, canMoveDown: false, canDelete: false };
    expect(channelMenu(ch, input)).not.toContain("copyId");
    expect(channelMenu(ch, { ...input, builder: true })).toContain("copyId");
  });
});
