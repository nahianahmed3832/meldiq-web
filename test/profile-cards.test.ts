import { describe, expect, it } from "vitest";
import { cleanContact, contactWire, fallbackText, profileCard } from "../src/sync/rich";

/** Meldiq profile cards (android round 7 RichRulesTest): a card is a profile, never a phone number or address. */
describe("profile cards", () => {
  it("carry no phone number or address", () => {
    const card = profileCard("usr_Ab12-x", "Ayesha", "ayesha")!;
    expect(card).toEqual({ name: "Ayesha", phones: [], emails: [], userId: "usr_Ab12-x", username: "ayesha" });
    // Whatever a sender (or an altered app) puts in, a profile card keeps only name, id and username.
    const received = cleanContact({ name: "Ayesha", phones: ["+8801712"], emails: ["a@example.com"], userId: "usr_1", username: "ayesha@chat.example.org" })!;
    expect([received.phones, received.emails]).toEqual([[], []]);
    expect(received.username).toBe("ayesha@chat.example.org");
    expect(fallbackText({ contact: card })).toBe("👤 Ayesha (@ayesha)");
    // On the wire, as the phone sends it: no phone or email keys at all.
    expect(contactWire(card)).toEqual({ name: "Ayesha", userId: "usr_Ab12-x", username: "ayesha" });
    expect(JSON.stringify(contactWire(card))).not.toContain("phones");
  });

  it("malformed profile ids fall back to a plain card", () => {
    const c = cleanContact({ name: "Ayesha", phones: [], emails: [], userId: "../../etc", username: "x y" })!;
    expect(c.userId).toBeUndefined();
    expect(cleanContact({ name: "Ayesha", phones: [], emails: [], userId: "usr_1", username: "bad name" })!.username).toBeUndefined();
    expect(profileCard("usr_1", "  ", null)).toBeNull();
  });

  it("cards from older apps, with numbers, still show as they were", () => {
    const old = cleanContact({ name: "Ada", phones: ["+880 1712"], emails: [] })!;
    expect(old).toEqual({ name: "Ada", phones: ["+880 1712"], emails: [] });
    expect(contactWire(old)).toBe(old);
    expect(fallbackText({ contact: old })).toBe("👤 Ada\n+880 1712");
  });
});
