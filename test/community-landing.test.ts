import { afterEach, describe, expect, it, vi } from "vitest";
import type { Conversation, Org } from "../src/api/schemas";
import { communityLanding, rememberedCommunityChannel, rememberCommunityChannel } from "../src/application/communityLanding";
import { forgetPlace } from "../src/application/lastPlace";
import { LOBBY_FEATURE } from "../src/sync/lobby";

const org = { id: "o_one", lobby: null } as Org;
const channel = (id: string, extra: Partial<Conversation> = {}): Conversation =>
  ({ id, type: "CHANNEL", orgId: org.id, joined: true, voice: false, archived: false, position: 0, ...extra }) as Conversation;
afterEach(() => vi.unstubAllGlobals());

describe("community entry", () => {
  it("opens an unseen lobby first and restores a valid last channel after that", () => {
    const lobby = { ...org, lobby: { enabled: true, seen: false } };
    expect(communityLanding(lobby, [LOBBY_FEATURE], [channel("last")], "last", true)).toEqual({ section: "lobby" });
    expect(communityLanding({ ...lobby, lobby: { enabled: true, seen: true } }, [LOBBY_FEATURE], [channel("last")], "last", false)).toEqual({ section: "home", conversationId: "last" });
  });
  it("uses a configured lobby before a default channel and never autojoins a voice room", () => {
    expect(communityLanding({ ...org, lobby: { enabled: true, seen: true } }, [LOBBY_FEATURE], [channel("text")], null, true)).toEqual({ section: "lobby" });
    const channels = [channel("voice", { voice: true }), channel("archived", { archived: true }), channel("other", { orgId: "o_other" }), channel("unjoined", { joined: false }), channel("text")];
    expect(communityLanding(org, [], channels, "voice", true)).toEqual({ section: "home", conversationId: "text" });
  });
  it("waits for fresh membership before picking a default, and handles deleted channels", () => {
    expect(communityLanding(org, [], [channel("text")], "deleted", false)).toBeNull();
    expect(communityLanding(org, [], [channel("text")], "deleted", true)).toEqual({ section: "home", conversationId: "text" });
    expect(communityLanding(org, [], [], null, true)).toBeNull();
  });
  it("remembers each community separately, isolates accounts, and clears on sign-out", () => {
    const data = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => data.delete(key) });
    rememberCommunityChannel("alice", "o_one", "c_one");
    rememberCommunityChannel("alice", "o_two", "c_two");
    expect(rememberedCommunityChannel("alice", "o_one")).toBe("c_one");
    expect(rememberedCommunityChannel("alice", "o_two")).toBe("c_two");
    expect(rememberedCommunityChannel("bob", "o_one")).toBeNull();
    forgetPlace();
    expect(rememberedCommunityChannel("alice", "o_one")).toBeNull();
  });
});
