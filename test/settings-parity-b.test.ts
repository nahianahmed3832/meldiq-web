import { describe, expect, it } from "vitest";
import { ApiError } from "../src/api/client";
import { zMember, zProfile } from "../src/api/schemas";
import { appHref, parseRoute, routeHref } from "../src/application/router";
import { parseFrame } from "../src/realtime/frames";
import { initialState } from "../src/state/store";
import { commandTemplate, matchingCommands, type OrgCommand, parseCommand } from "../src/sync/bots";
import { parseViews, proofProblem, verificationFormProblem, verificationQuery, type VerificationForm } from "../src/sync/creators";
import { isAllowedRedirectUri, parseRedirectUris } from "../src/sync/developer";
import { botReplyFrame, dismissBotReply } from "../src/sync/frameReducers";
import { connectionReturn, connectionReturnText, visibleConnections } from "../src/sync/linkedAccounts";
import { authorizeQueryString, parseAuthorizeQuery, safeRedirect } from "../src/sync/oauth";
import { botLimitText } from "../src/ui/developer/BotsSection";
import { redirectHost } from "../src/ui/oauth/ConsentPage";

/** Settings parity, batch B (API 0.65.0): the rules the web adds on top of the server's answers. */

describe("creator verification", () => {
  const form: VerificationForm = { platform: "youtube", channelName: " Ada Plays ", link: "https://youtube.com/@ada", notes: "", bioLineConfirmed: true };

  it("puts the form in the query, trimmed, without empty notes", () => {
    const q = new URLSearchParams(verificationQuery(form));
    expect(Object.fromEntries(q)).toEqual({ platform: "youtube", channelName: "Ada Plays", link: "https://youtube.com/@ada", bioLineConfirmed: "true" });
    expect(new URLSearchParams(verificationQuery({ ...form, notes: " Hi & bye " })).get("notes")).toBe("Hi & bye");
    expect(verificationQuery({ ...form, bioLineConfirmed: false })).not.toContain("bioLineConfirmed");
  });

  it("says what's missing before sending", () => {
    expect(verificationFormProblem(form, 500)).toBeNull();
    expect(verificationFormProblem({ ...form, channelName: "a" }, 500)).toMatch(/name/);
    expect(verificationFormProblem({ ...form, link: "http://youtube.com/x" }, 500)).toMatch(/https/);
    expect(verificationFormProblem({ ...form, notes: "x".repeat(501) }, 500)).toMatch(/500/);
    expect(verificationFormProblem({ ...form, bioLineConfirmed: false }, 500)).toMatch(/bio/);
  });

  it("checks the screenshot's type and size against the server's rules", () => {
    const rules = { proofTypes: ["image/png", "image/jpeg", "image/webp"], proofMaxBytes: 4 * 1024 * 1024 };
    expect(proofProblem({ type: "image/png", size: 1000 }, rules)).toBeNull();
    expect(proofProblem({ type: "image/gif", size: 1000 }, rules)).toMatch(/PNG/);
    expect(proofProblem({ type: "image/webp", size: 5 * 1024 * 1024 }, rules)).toMatch(/4 MB/);
    expect(proofProblem({ type: "image/jpeg", size: 0 }, rules)).toMatch(/empty/);
  });

  it("reads views as a whole number, empty as not given", () => {
    expect(parseViews("")).toBeUndefined();
    expect(parseViews("12,500")).toBe(12500);
    expect(parseViews("1.5k")).toBeNull();
  });
});

describe("developer apps and bots", () => {
  it("allows https anywhere and http only on this computer, never a fragment or user info", () => {
    expect(isAllowedRedirectUri("https://example.com/cb")).toBe(true);
    expect(isAllowedRedirectUri("http://localhost:3000/cb")).toBe(true);
    expect(isAllowedRedirectUri("http://127.0.0.1/cb")).toBe(true);
    expect(isAllowedRedirectUri("http://example.com/cb")).toBe(false);
    expect(isAllowedRedirectUri("https://example.com/cb#x")).toBe(false);
    expect(isAllowedRedirectUri("https://me:pw@example.com/cb")).toBe(false);
    expect(isAllowedRedirectUri("javascript:alert(1)")).toBe(false);
  });

  it("reads redirect URIs one per line", () => {
    expect(parseRedirectUris(" https://a.example/cb \n\nhttp://localhost/cb\n")).toEqual({ uris: ["https://a.example/cb", "http://localhost/cb"] });
    expect(parseRedirectUris("")).toEqual({ problem: "Add at least one redirect URI." });
    expect(parseRedirectUris("https://a.example\nhttps://a.example")).toEqual({ problem: "Each redirect URI once." });
    expect("problem" in parseRedirectUris("ftp://a.example")).toBe(true);
    expect("problem" in parseRedirectUris(Array.from({ length: 11 }, (_, i) => `https://a.example/${i}`).join("\n"))).toBe(true);
  });

  it("says a bot quota from the server's details", () => {
    expect(botLimitText(new ApiError(409, "limit_reached", "Limit reached", { limit: 2, plan: "free" }))).toMatch(/allows 2 bots/);
    expect(botLimitText(new ApiError(409, "username_taken", "That username is taken"))).toBe("That username is taken");
    expect(botLimitText(new Error("x"))).toMatch(/Try again/);
  });
});

describe("connections", () => {
  it("reads the provider's way back and ignores anything else", () => {
    expect(connectionReturn("?connected=steam")).toEqual({ kind: "connected", provider: "steam" });
    expect(connectionReturn("?connectionError=denied&provider=trakt")).toEqual({ kind: "error", provider: "trakt", code: "denied" });
    expect(connectionReturn("?connectionError=state&provider=evil")).toEqual({ kind: "error", provider: null, code: "state" });
    expect(connectionReturn("?connected=evil")).toBeNull();
    expect(connectionReturn("")).toBeNull();
    expect(connectionReturnText({ kind: "error", provider: "lastfm", code: "denied" })).toMatch(/Last\.fm.*cancelled/);
    expect(connectionReturnText({ kind: "connected", provider: "anilist" })).toMatch(/AniList is connected/);
  });

  it("shows known providers with https links only", () => {
    const base = { name: "Ada", itemsKind: "watching", items: [], updatedAt: 1 };
    const list = visibleConnections([
      { ...base, provider: "anilist", url: "https://anilist.co/user/ada" },
      { ...base, provider: "unknown", url: "https://example.com" },
      { ...base, provider: "steam", url: "javascript:alert(1)" },
    ]);
    expect(list.map((c) => c.provider)).toEqual(["anilist"]);
  });

  it("reads connections and the BOT mark on profiles and members, and none from older servers", () => {
    const profile = { id: "u1", username: "ada", displayName: "Ada", identityKey: "k", fingerprint: "f" };
    expect(zProfile.parse(profile).connections).toEqual([]);
    expect(zProfile.parse(profile).bot).toBeUndefined();
    const c = { provider: "steam", name: "Ada", url: "https://steamcommunity.com/id/ada", itemsKind: "recently-played", items: [{ title: "Game", subtitle: null, url: null }], updatedAt: 1 };
    expect(zProfile.parse({ ...profile, connections: [c], bot: true })).toMatchObject({ connections: [c], bot: true });
    expect(zProfile.parse({ ...profile, connections: "nonsense" }).connections).toEqual([]);
    expect(zMember.parse({ id: "b", username: "dice", displayName: "Dice", bot: true }).bot).toBe(true);
  });
});

describe("the consent page", () => {
  const challenge = "a".repeat(43);

  it("keeps the request's known parameters and leaves the rest out", () => {
    const r = parseAuthorizeQuery(
      `?response_type=code&client_id=app_1&redirect_uri=https%3A%2F%2Fa.example%2Fcb&scope=identify%20email&state=xyz&code_challenge=${challenge}&code_challenge_method=S256&extra=1`,
    );
    expect(r).toEqual({
      request: { response_type: "code", client_id: "app_1", redirect_uri: "https://a.example/cb", scope: "identify email", state: "xyz", code_challenge: challenge, code_challenge_method: "S256" },
    });
    if ("request" in r) expect(new URLSearchParams(authorizeQueryString(r.request)).get("scope")).toBe("identify email");
  });

  it("refuses requests it can't send on", () => {
    expect("problem" in parseAuthorizeQuery("?client_id=app_1")).toBe(true);
    expect("problem" in parseAuthorizeQuery("?client_id=a&redirect_uri=https://a.example&response_type=token")).toBe(true);
    expect("problem" in parseAuthorizeQuery(`?client_id=a&redirect_uri=https://a.example&state=${"s".repeat(501)}`)).toBe(true);
  });

  it("follows only http(s) answers and names the host people go back to", () => {
    expect(safeRedirect("https://a.example/cb?code=mqc_1&state=x")).toBe("https://a.example/cb?code=mqc_1&state=x");
    expect(safeRedirect("javascript:alert(1)")).toBeNull();
    expect(safeRedirect("not a url")).toBeNull();
    expect(redirectHost("https://a.example:8443/cb")).toBe("a.example:8443");
  });

  it("has its own route that links don't move to in-page (the query would be lost)", () => {
    expect(parseRoute("/oauth/authorize").section).toBe("oauth");
    expect(routeHref({ section: "oauth" })).toBe("/oauth/authorize");
    expect(appHref("/oauth/authorize?client_id=a", "https://meldiq.app")).toBeNull();
    expect(parseRoute("/settings/developer").settingsPage).toBe("developer");
    expect(parseRoute("/settings/creators").settingsPage).toBe("creators");
    expect(parseRoute("/workspace/bots").workspacePage).toBe("bots");
  });
});

describe("slash commands", () => {
  const cmd = (name: string, botId: string, options: OrgCommand["options"] = []): OrgCommand => ({
    name,
    description: `${name} it`,
    options,
    botId,
    botUsername: botId,
    botDisplayName: botId.toUpperCase(),
  });
  const roll = cmd("roll", "dice", [
    { name: "sides", description: "How many sides", type: "number", required: true },
    { name: "loud", description: "Shout it", type: "boolean", required: false },
  ]);
  const greet = cmd("greet", "host", [{ name: "who", description: "Who", type: "user", required: true }]);
  const list = [roll, cmd("ping", "dice"), cmd("ping", "alpha"), greet, cmd("say", "host", [{ name: "text", description: "What", type: "string", required: true }])];
  const users = (u: string) => (u === "ada" ? "u_ada" : null);

  it("lists commands while a name is typed, by name then bot", () => {
    expect(matchingCommands(list, "/p").map((c) => `${c.name}@${c.botId}`)).toEqual(["ping@alpha", "ping@dice"]);
    expect(matchingCommands(list, "/").length).toBe(5);
    expect(matchingCommands(list, "/roll 6")).toEqual([]);
    expect(matchingCommands(list, "hello /p")).toEqual([]);
  });

  it("fills in the required options when one is picked", () => {
    expect(commandTemplate(roll)).toBe("/roll sides:");
    expect(commandTemplate(cmd("ping", "dice"))).toBe("/ping ");
  });

  it("reads options by type", () => {
    expect(parseCommand("/roll sides:20 loud:yes", list, null, users)).toEqual({ command: roll, options: { sides: 20, loud: true } });
    expect(parseCommand("/greet who:@ada", list, null, users)).toEqual({ command: greet, options: { who: "u_ada" } });
    expect(parseCommand('/say text:"two words"', list, null, users)).toMatchObject({ options: { text: "two words" } });
  });

  it("says what's wrong, and leaves text that isn't a command here alone", () => {
    expect(parseCommand("/roll", list, null, users)).toMatchObject({ problem: expect.stringMatching(/needs sides/) });
    expect(parseCommand("/roll sides:many", list, null, users)).toMatchObject({ problem: expect.stringMatching(/number/) });
    expect(parseCommand("/roll colour:red sides:2", list, null, users)).toMatchObject({ problem: expect.stringMatching(/no option "colour"/) });
    expect(parseCommand("/roll 6", list, null, users)).toMatchObject({ problem: expect.stringMatching(/name:value/) });
    expect(parseCommand("/greet who:@nobody", list, null, users)).toMatchObject({ problem: expect.stringMatching(/person/) });
    expect(parseCommand("/shrug", list, null, users)).toBeNull();
    expect(parseCommand("hello", list, null, users)).toBeNull();
  });

  it("runs the picked bot's command when two bots share a name", () => {
    expect(parseCommand("/ping", list, "alpha", users)).toMatchObject({ command: { botId: "alpha" } });
    expect(parseCommand("/ping", list, null, users)).toMatchObject({ command: { botId: "dice" } });
  });
});

describe("answers only you can see", () => {
  const frame = { t: "interaction.reply", interactionId: "ix_1", conversationId: "c_1", botId: "u_bot", command: "roll", content: "Psst: 17", at: 5 };

  it("parses the frame and drops one missing what it needs", () => {
    expect(parseFrame(frame)).toEqual({ t: "interaction.reply", reply: { interactionId: "ix_1", conversationId: "c_1", botId: "u_bot", command: "roll", content: "Psst: 17", at: 5 } });
    expect(parseFrame({ ...frame, content: 3 })).toBeNull();
  });

  it("keeps each answer once with its conversation, until dismissed", () => {
    const f = parseFrame(frame);
    if (f?.t !== "interaction.reply") throw new Error("not parsed");
    const once = botReplyFrame(initialState, f.reply);
    expect(botReplyFrame(once, f.reply)).toBe(once);
    expect(once.botReplies.c_1).toHaveLength(1);
    expect(dismissBotReply(once, "c_1", "ix_1").botReplies.c_1).toEqual([]);
  });
});
