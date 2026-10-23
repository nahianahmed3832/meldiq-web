import { describe, expect, it } from "vitest";
import { isHere, type ListedRole, memberListGroups, nameColor } from "../src/ui/chat/memberListRules";

const person = (id: string, displayName: string, presence: "online" | "idle" | "dnd" | "offline" | null, online: boolean | null = null) => ({ id, displayName, presence, online });
const role = (id: string, position: number, hoist: boolean, color: string | null = null): ListedRole => ({ id, name: id.toUpperCase(), color, hoist, position });

describe("member list", () => {
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
});
