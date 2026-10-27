import { describe, expect, it } from "vitest";
import { checkInvite, extractInvite, inviteFromScan, inviteLink } from "../src/sync/inviteCodes";

/** Invitation codes and links (android InviteScanTest): only invite codes are accepted, never a web address. */
describe("invite codes", () => {
  it("reads the link the invite screen draws, older griip links and bare codes", () => {
    expect(inviteFromScan("griip://invite/ABCD-EFGH-JK23")).toBe("ABCD-EFGH-JK23");
    expect(inviteFromScan("GRIIP://INVITE/abcdefghjk23")).toBe("ABCD-EFGH-JK23");
    expect(inviteFromScan("  abcd-efgh-jk23\n")).toBe("ABCD-EFGH-JK23");
    expect(inviteLink("ABCD-EFGH-JK23")).toBe("https://web.meldiq.app/invite/ABCD-EFGH-JK23");
    expect(inviteFromScan("https://www.meldiq.app/invite/abcdefghjk23")).toBe("ABCD-EFGH-JK23");
    expect(inviteFromScan("meldiq://invite/ABCD-EFGH-JK23")).toBe("ABCD-EFGH-JK23");
    expect(inviteFromScan(inviteLink("ABCD-EFGH-JK23"))).toBe("ABCD-EFGH-JK23");
    expect(inviteFromScan("MELDIQ://INVITE/abcdefghjk23")).toBe("ABCD-EFGH-JK23");
    expect(inviteFromScan("orbit://invite/ABCD-EFGH-JK23")).toBeNull();
  });

  it("refuses anything that isn't an invite", () => {
    for (const s of ["https://example.com/invite/ABCD-EFGH-JK23", "http://griip.invalid/ABCDEFGHJK23", "griip://invite/ABC", "WIFI:S:office;T:WPA;P:secret;;", "hello world", ""])
      expect(inviteFromScan(s), s).toBeNull();
  });

  it("finds exactly one code in a pasted invite message", () => {
    expect(extractInvite("Join GriipBuddy on Griip Message with invite code KXPN-52PW-EGYX (griip://invite/KXPN-52PW-EGYX)")).toBe("KXPN-52PW-EGYX");
    expect(extractInvite("my code is kxpn-52pw-egyx thanks")).toBe("KXPN-52PW-EGYX");
    expect(extractInvite("two codes ABCD-EFGH-JK23 and WXYZ-2345-6789")).toBeNull(); // ambiguous: ask, don't guess
    expect(extractInvite("https://evil.example/ABCD-EFGH-JK23/x")).toBeNull(); // part of a web link
  });

  it("normalises typed codes but never reinterprets them", () => {
    expect(checkInvite("XFG6-3KAJ-EQ3J")).toEqual({ kind: "ok", code: "XFG6-3KAJ-EQ3J" });
    expect(checkInvite(" xfg6 3kaj eq3j ")).toEqual({ kind: "ok", code: "XFG6-3KAJ-EQ3J" });
    expect(checkInvite("xfg63kajeq3j")).toEqual({ kind: "ok", code: "XFG6-3KAJ-EQ3J" });
    expect(checkInvite("XFG6-3KA")).toEqual({ kind: "incomplete" });
    expect(checkInvite("")).toEqual({ kind: "incomplete" });
    const wrong = checkInvite("XFG6-3KAJ-EQ30");
    expect(wrong.kind === "invalid" && wrong.reason).toContain("0");
    expect(checkInvite("XFG6-3KAJ-EQ3JX").kind).toBe("invalid");
  });
});

describe("invitation links on every Meldiq address (2026-10-27: meldiq.app had no web server)", () => {
  it("are made on the web app's address and read back from any Meldiq host", () => {
    expect(inviteLink("ABCD-EFGH-JK23")).toMatch(/^https:\/\/web\.meldiq\.app\/invite\//);
    for (const host of ["meldiq.app", "www.meldiq.app", "web.meldiq.app", "web.griipbuddy.cloud"]) {
      expect(inviteFromScan(`https://${host}/invite/ABCD-EFGH-JK23`)).toBe("ABCD-EFGH-JK23");
    }
    expect(inviteFromScan("https://evil.example/invite/ABCD-EFGH-JK23")).toBeNull();
    expect(inviteFromScan("http://meldiq.app/invite/ABCD-EFGH-JK23")).toBeNull();
  });
});
