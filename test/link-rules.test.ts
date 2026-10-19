import { describe, expect, it } from "vitest";
import { linkWarning, readableDomain } from "../src/sync/linkRules";

/** The phone's LinkRulesTest cases for `warning`, against the browser port. */
describe("link warnings", () => {
  it("lets ordinary https links open directly", () => {
    expect(linkWarning("https://example.com/a?b=c")).toBeNull();
    expect(linkWarning("https://docs.google.com/document/d/1")).toBeNull();
  });

  it("warns about a destination hidden before @", () => {
    expect(linkWarning("https://paypal.com@evil.example/login")).toMatch(/hides its real destination.*evil\.example/);
  });

  it("warns about look-alike letters from other alphabets", () => {
    // "аpple.com" with a Cyrillic "а".
    expect(linkWarning("https://аpple.com/")).toMatch(/other alphabets.*xn--/);
  });

  it("warns about bare IP numbers, unencrypted http and long chains of names", () => {
    expect(linkWarning("https://192.168.1.10/admin")).toMatch(/bare IP number/);
    expect(linkWarning("https://[::1]/")).toMatch(/bare IP number/);
    expect(linkWarning("http://example.com/")).toMatch(/isn't encrypted/);
    expect(linkWarning("https://login.secure.account.bank.com.evil.example/")).toMatch(/long chain of names.*evil\.example/);
  });

  it("names the site readably", () => {
    expect(readableDomain("https://www.example.com/a")).toBe("example.com");
    expect(readableDomain("not a url")).toBeNull();
  });
});
