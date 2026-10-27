import { describe, expect, it } from "vitest";
import { canLink, messageLink, parseMessageLink } from "../src/sync/messageLinks";

/** android ChatInterfaceRulesTest's link cases (batch B5). */
describe("message links", () => {
  it("carry only the conversation and message ids, both ways", () => {
    expect(messageLink("c_abc", "m-1")).toBe("https://web.meldiq.app/m/c_abc/m-1");
    expect(parseMessageLink("https://meldiq.app/m/c_abc/m-1")).toEqual({ conversationId: "c_abc", messageId: "m-1" });
    expect(parseMessageLink(" meldiq://m/c_abc/m-1/ ")).toEqual({ conversationId: "c_abc", messageId: "m-1" });
    expect(parseMessageLink("https://www.MELDIQ.app/m/c/x")).toEqual({ conversationId: "c", messageId: "x" });
  });

  it("refuse anything else", () => {
    expect(parseMessageLink("https://meldiq.app/invite/ABCD")).toBeNull();
    expect(parseMessageLink("https://evil.example/m/c/x")).toBeNull();
    expect(parseMessageLink("https://meldiq.app/m/c/x?y=1")).toBeNull();
    expect(parseMessageLink("https://meldiq.app/m/c")).toBeNull();
  });

  it("are offered for sent messages that still exist", () => {
    expect(canLink(false, "SENT")).toBe(true);
    expect(canLink(false, "READ")).toBe(true);
    expect(canLink(true, "SENT")).toBe(false);
    expect(canLink(false, "SENDING")).toBe(false);
    expect(canLink(false, "FAILED")).toBe(false);
  });
});

describe("message links on every Meldiq address", () => {
  it("are read from meldiq.app, web.meldiq.app and meldiq://, never other sites", () => {
    for (const url of ["https://meldiq.app/m/c1/m1", "https://web.meldiq.app/m/c1/m1", "meldiq://m/c1/m1"]) {
      expect(parseMessageLink(url)).toEqual({ conversationId: "c1", messageId: "m1" });
    }
    expect(parseMessageLink("https://evil.example/m/c1/m1")).toBeNull();
  });
});
