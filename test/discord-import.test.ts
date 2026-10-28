import { describe, expect, it } from "vitest";
import { discordReturnFrom } from "../src/application/discordReturn";
import { type DiscordPreview, importFinished, previewFor } from "../src/sync/discord";

/** Coming back from Discord, and what the preview shows for the parts chosen (meldiq docs/DISCORD_IMPORT.md). */
describe("the return from Discord", () => {
  it("keeps the code, state and server from /discord/callback", () => {
    expect(discordReturnFrom("/discord/callback", "?code=abc123&state=s_t-at.e~1&guild_id=111111111111111111&permissions=1024")).toEqual({
      kind: "connected",
      code: "abc123",
      state: "s_t-at.e~1",
      guildId: "111111111111111111",
    });
  });

  it("treats a cancelled or malformed return as cancelled, and ignores other paths", () => {
    expect(discordReturnFrom("/discord/callback", "?error=access_denied")).toEqual({ kind: "cancelled" });
    expect(discordReturnFrom("/discord/callback", "?code=<script>&state=x")).toEqual({ kind: "cancelled" });
    expect(discordReturnFrom("/home", "?code=abc&state=def")).toBeNull();
  });

  it("drops a guild id that isn't a Discord id", () => {
    expect(discordReturnFrom("/discord/callback/", "?code=a&state=b&guild_id=javascript:1")).toMatchObject({ kind: "connected", guildId: null });
  });
});

describe("the preview", () => {
  const items: DiscordPreview["items"] = [
    { key: "icon:1", kind: "icon", name: "Server icon", action: "create", note: null },
    { key: "role:2", kind: "role", name: "Mods", action: "create", note: null },
    { key: "category:3", kind: "category", name: "Info", action: "create", note: null },
    { key: "channel:4", kind: "channel", name: "general", action: "create", note: null },
    { key: "emoji:5", kind: "emoji", name: ":wave:", action: "skip", note: "Managed by an integration" },
  ];

  it("shows only the parts chosen", () => {
    const only = previewFor(items, { icon: false, roles: true, rolePermissions: false, channels: false, emojis: true });
    expect(only.map((i) => i.key)).toEqual(["role:2", "emoji:5"]);
    expect(previewFor(items, { icon: true, roles: true, rolePermissions: true, channels: true, emojis: true })).toHaveLength(5);
  });

  it("is finished once it isn't running", () => {
    const base = {
      id: "i",
      guildId: "g",
      guildName: "G",
      orgId: null,
      error: null,
      options: { icon: true, roles: true, rolePermissions: false, channels: true, emojis: true },
      counts: { total: 1, done: 0, failed: 0, skipped: 0, pending: 1 },
      createdAt: 1,
      finishedAt: null,
    };
    expect(importFinished({ ...base, status: "running" })).toBe(false);
    for (const status of ["completed", "completed_with_errors", "failed", "interrupted"] as const) expect(importFinished({ ...base, status })).toBe(true);
  });
});
