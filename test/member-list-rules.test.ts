import { describe, expect, it } from "vitest";
import { isHere, type ListedRole, type ListedMember, memberListGroups, nameColor, withCommunityBots } from "../src/ui/chat/memberListRules";

const person = (id: string, displayName: string, presence: "online" | "idle" | "dnd" | "offline" | null, online: boolean | null = null) => ({ id, displayName, presence, online });
const role = (id: string, position: number, hoist: boolean, color: string | null = null): ListedRole => ({ id, name: id.toUpperCase(), color, hoist, position });

describe("member list", () => {
  it("adds directory bots omitted by the channel API without adding unrelated people or duplicating accounts", () => {
    const human = person("human", "Human", "online");
    const bot = { ...person("bot", "Channel bot name", "offline"), bot: true };
    const directory = [person("other", "Another person", "online"), { ...bot, displayName: "Directory bot name" }, { ...bot, id: "bot2" }];
    const result = withCommunityBots<ListedMember>([human, bot], directory);
    expect(result.map((m) => m.id)).toEqual(["human", "bot", "bot2"]);
    expect(result[1]).toBe(bot);
    expect(withCommunityBots([human], [])).toEqual([human]);
  });
  it("counts online, idle and do not disturb as here, and hidden presence by the online flag", () => {
    expect(isHere({ presence: "online", online: true })).toBe(true);
    expect(isHere({ presence: "idle", online: true })).toBe(true);
    expect(isHere({ presence: "dnd", online: true })).toBe(true);
    expect(isHere({ presence: "offline", online: false })).toBe(false);
    expect(isHere({ presence: null, online: true })).toBe(true);
    expect(isHere({ presence: null, online: null })).toBe(false);
  });

  it("puts people who are here under Online and everyone else under Offline, alphabetically", () => {
    const groups = memberListGroups([person("1", "zoe", "online"), person("2", "Amir", "offline"), person("3", "bea", "idle"), person("4", "Cy", null)], () => []);
    expect(groups.map((g) => [g.label, g.members.map((m) => m.displayName)])).toEqual([
      ["Online", ["bea", "zoe"]],
      ["Offline", ["Amir", "Cy"]],
    ]);
  });

  it("gives each shown-separately role its own group, in role order, under the person's highest such role", () => {
    const roles: Record<string, ListedRole[]> = {
      ceo: [role("staff", 2, true, "#22aa55"), role("ceo", 1, true, "#ff00aa")],
      mod: [role("staff", 2, true, "#22aa55")],
      vip: [role("vip", 0, false, "#123456")],
    };
    const groups = memberListGroups([person("mod", "Mod", "online"), person("ceo", "Ceo", "dnd"), person("vip", "Vip", "online"), person("off", "Off", "offline")], (id) => roles[id]);
    expect(groups.map((g) => [g.label, g.color, g.members.map((m) => m.id)])).toEqual([
      ["CEO", "#ff00aa", ["ceo"]],
      ["STAFF", "#22aa55", ["mod"]],
      ["Online", null, ["vip"]],
      ["Offline", null, ["off"]],
    ]);
  });

  it("lists people who are offline under Offline whatever their roles, and leaves empty groups out", () => {
    const groups = memberListGroups([person("a", "A", "offline")], () => [role("ceo", 0, true, "#fff")]);
    expect(groups.map((g) => g.label)).toEqual(["Offline"]);
    expect(memberListGroups([], () => [])).toEqual([]);
  });

  it("colours a name with the highest role that has a colour", () => {
    expect(nameColor([role("b", 2, false, "#bbb"), role("a", 1, false, null), role("c", 3, true, "#ccc")])).toBe("#bbb");
    expect(nameColor([role("a", 1, false, null)])).toBeNull();
    expect(nameColor(undefined)).toBeNull();
  });

  it("keeps an active owner first in Admin without a custom role, ahead of other admins and hoisted roles", () => {
    const members = [
      { ...person("admin", "Amber", "online"), orgRole: "ADMIN" },
      { ...person("owner", "Zoe", "idle"), orgRole: "OWNER" },
      person("mod", "Moderator", "online"),
      person("member", "Member", "online"),
    ];
    const groups = memberListGroups(members, (id) => (id === "mod" ? [role("mod", 0, true)] : []));
    expect(groups.map((g) => [g.label, g.members.map((m) => m.id)])).toEqual([
      ["Admin", ["owner", "admin"]],
      ["MOD", ["mod"]],
      ["Online", ["member"]],
    ]);
  });

  it("pins the owner's custom group above a higher-positioned role and keeps the owner first within it", () => {
    const members = [{ ...person("owner", "Zoe", "dnd"), orgRole: "OWNER" }, person("peer", "Amber", "online"), person("staff", "Staff", "online")];
    const roles = { owner: [role("founders", 99, true)], peer: [role("founders", 99, true)], staff: [role("staff", 0, true)] };
    expect(memberListGroups(members, (id) => roles[id as keyof typeof roles]).map((g) => [g.label, g.members.map((m) => m.id)])).toEqual([
      ["FOUNDERS", ["owner", "peer"]],
      ["STAFF", ["staff"]],
    ]);
  });

  it("keeps offline owners offline, and bots separate from every human role and presence group", () => {
    const members = [
      { ...person("owner", "Owner", "offline"), orgRole: "OWNER" },
      { ...person("bot1", "Helper", "offline"), bot: true, orgRole: "ADMIN" },
      { ...person("bot2", "Guide", "online"), bot: true },
      person("human", "Human", "online"),
    ];
    const groups = memberListGroups(members, () => [role("staff", 0, true)]);
    expect(groups.map((g) => [g.label, g.members.map((m) => m.id)])).toEqual([
      ["STAFF", ["human"]],
      ["Bots", ["bot2", "bot1"]],
      ["Offline", ["owner"]],
    ]);
    expect(groups.flatMap((g) => g.members).length).toBe(members.length);
  });
});
