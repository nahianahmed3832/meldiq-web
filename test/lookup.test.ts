import { describe, expect, it } from "vitest";
import { lookupKind, normalAddress } from "../src/sync/lookup";

describe("finding people", () => {
  it("tells names, phone numbers and other-server addresses apart", () => {
    expect(lookupKind("Nadia")).toBe("name");
    expect(lookupKind("@nadia")).toBe("name");
    expect(lookupKind("+880 1712-345678")).toBe("phone");
    expect(lookupKind("(212) 555-0101")).toBe("phone");
    expect(lookupKind("12345")).toBe("name"); // too short to be a number
    expect(lookupKind("@bob:chat.example.org")).toBe("address");
    expect(lookupKind("bob:chat.example.org")).toBe("address");
    expect(lookupKind("bob:localhost")).toBe("name"); // a domain needs a dot
    expect(lookupKind("  ")).toBe("name");
  });

  it("writes addresses the way the server looks them up", () => {
    expect(normalAddress(" Bob:Chat.Example.org ")).toBe("@bob:chat.example.org");
    expect(normalAddress("@bob:x.org")).toBe("@bob:x.org");
  });
});
