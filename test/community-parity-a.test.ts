import { describe, expect, it } from "vitest";
import { zOrgPermissions } from "../src/api/workspaceSchemas";
import { parseRoute, routeHref } from "../src/application/router";
import { cleanNickname, LOCK_CHOICES, NICKNAME_MAX, nicknameProblem, PARITY_FEATURES } from "../src/sync/communityParity";
import { lockEntry } from "../src/ui/community/lockMenu";
import type { MenuEntry, MenuItem } from "../src/ui/components/Overlay";
import { communityPageTitle, communityRailKey, visibleCommunityRail } from "../src/ui/workspace/communityRail";

/** Community parity, batch A (docs/MELDIQ_COMMUNITY_PARITY.md): the settings window's rail and the community menu. */

const member = zOrgPermissions.parse({ canManageOrg: false, canInvite: false, canCreateChannels: false, canViewDirectory: true, isOwner: false });
const owner = zOrgPermissions.parse({
  canManageOrg: true,
  canInvite: true,
  canCreateChannels: true,
  canViewDirectory: true,
  isOwner: true,
  canViewRoles: true,
  canViewAudit: true,
  canViewUsage: true,
  canBan: true,
});
const ALL_FEATURES = [
  "community-guide",
  "community-branding",
  "rules-channel",
  "mojo",
  "community-expressions",
  "bots",
  "onboarding",
  "community-moderation",
  "join-applications",
  "profile-pins",
  "reports",
  "meetings",
];
const keys = (features: string[], p: typeof owner | null) => visibleCommunityRail(features, p).map((x) => x.key);

describe("community settings rail", () => {
  it("lists an owner's pages in the reference's order, Meldiq's extras where they fit", () => {
    expect(keys(ALL_FEATURES, owner)).toEqual([
      "overview",
      "guide",
      "theme",
      "channels",
      "rules",
      "sparks",
      "expressions",
      "bots",
      "people",
      "roles",
      "onboarding",
      "bans",
      "applications",
      "invitations",
      "pins",
      "reports",
      "audit",
      "meetings",
      "usage",
    ]);
  });

  it("keeps pages from people who can't use them and servers without the feature", () => {
    expect(keys(ALL_FEATURES, member)).toEqual(["overview", "theme", "channels", "sparks", "people", "onboarding", "pins", "meetings"]);
    expect(keys([], owner)).toEqual(["overview", "channels", "people", "roles", "invitations", "audit", "usage"]);
  });

  it("shows only the open pages while permissions load", () => {
    expect(keys([], null)).toEqual(["overview", "channels"]);
  });

  it("hides Promote until the server announces it, then only for people who edit the community", () => {
    expect(keys(ALL_FEATURES, owner)).not.toContain("promote");
    expect(keys([...ALL_FEATURES, PARITY_FEATURES.promote], owner)).toContain("promote");
    expect(keys([...ALL_FEATURES, PARITY_FEATURES.promote], member)).not.toContain("promote");
  });

  it("opens old Security actions links on Profile", () => {
    expect(communityRailKey("security")).toBe("overview");
    expect(communityPageTitle("security")).toBe("Profile");
    expect(communityPageTitle("guide")).toBe("Home");
    expect(communityPageTitle("expressions")).toBe("Emoji & stickers");
  });

  it("routes the new pages and keeps the old ones", () => {
    for (const page of ["theme", "sparks", "promote", "security", "guide"] as const) {
      expect(parseRoute(routeHref({ section: "workspace", workspacePage: page })).workspacePage).toBe(page);
    }
    expect(parseRoute("/workspace/nope").workspacePage).toBe("overview");
  });
});

describe("change nickname", () => {
  it("sends empty as no nickname, trimmed otherwise", () => {
    expect(cleanNickname("   ")).toBeNull();
    expect(cleanNickname("  Ada ")).toBe("Ada");
  });

  it("refuses more than 32 characters, counting emoji once", () => {
    expect(nicknameProblem("a".repeat(NICKNAME_MAX))).toBeNull();
    expect(nicknameProblem("a".repeat(NICKNAME_MAX + 1))).toMatch(/32/);
    expect(nicknameProblem("🙂".repeat(NICKNAME_MAX))).toBeNull();
  });
});

describe("lock", () => {
  const now = Date.UTC(2026, 9, 30, 12);
  const isItem = (e: MenuEntry): e is MenuItem => typeof e === "object" && "label" in e;

  it("offers 15 minutes, 1 hour, 8 hours and 1 day, then Cancel", () => {
    expect(LOCK_CHOICES.map((c) => c.label)).toEqual(["15 minutes", "1 hour", "8 hours", "1 day"]);
    const entry = lockEntry({ lockedUntil: null, realLock: false, onLock: () => undefined, onUnlock: () => undefined, now }) as MenuItem;
    expect(entry.label).toBe("Lock community");
    expect(entry.submenu?.filter(isItem).map((i) => i.label)).toEqual(["15 minutes", "1 hour", "8 hours", "1 day", "Cancel"]);
  });

  it("locks for the chosen time", () => {
    const chosen: number[] = [];
    const entry = lockEntry({ lockedUntil: null, realLock: false, onLock: (c) => chosen.push(c.ms), onUnlock: () => undefined, now }) as MenuItem;
    entry.submenu
      ?.filter(isItem)
      .find((i) => i.label === "8 hours")
      ?.onSelect?.();
    expect(chosen).toEqual([8 * 3_600_000]);
  });

  it("says chat is limited only when the server has a real lock", () => {
    const heading = (realLock: boolean) => (lockEntry({ lockedUntil: null, realLock, onLock: () => undefined, onUnlock: () => undefined, now }) as MenuItem).submenu?.[0];
    expect(heading(false)).toEqual({ heading: "Lock for how long? Nobody new can join." });
    expect(JSON.stringify(heading(true))).toMatch(/only moderators can chat/);
  });

  it("offers Unlock while locked, and Lock again once it has ended", () => {
    const unlocks: string[] = [];
    const locked = lockEntry({ lockedUntil: now + 60_000, realLock: false, onLock: () => undefined, onUnlock: () => unlocks.push("x"), now }) as MenuItem;
    expect(locked.label).toBe("Unlock community");
    locked.onSelect?.();
    expect(unlocks).toHaveLength(1);
    expect((lockEntry({ lockedUntil: now - 1, realLock: false, onLock: () => undefined, onUnlock: () => undefined, now }) as MenuItem).label).toBe("Lock community");
  });
});
