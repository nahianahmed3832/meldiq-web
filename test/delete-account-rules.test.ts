import { describe, expect, it } from "vitest";
import { ApiError } from "../src/api/client";
import { canDeleteAccount, deletionProblem, deletionProblemText } from "../src/auth/deleteAccount";

/** The same cases as android DeleteAccountRulesTest. */
describe("deleting the account: the page's rules", () => {
  it("needs the account's email, in any case and spacing, and a password", () => {
    expect(canDeleteAccount(" Ada@Example.com ", "ada@example.com", "pw")).toBe(true);
    expect(canDeleteAccount("ada@example.org", "ada@example.com", "pw")).toBe(false);
    expect(canDeleteAccount("ada@example.com", "ada@example.com", "")).toBe(false);
    expect(canDeleteAccount("", "", "pw")).toBe(false);
  });

  it("turns the server's refusals into problems that say nothing was deleted", () => {
    const owner = deletionProblem(
      new ApiError(409, "owns_workspaces", "x", {
        workspaces: [
          { id: "o1", name: "Acme", members: 3 },
          { id: "o2", name: "Beta", members: 1 },
        ],
      }),
    );
    expect(owner).toEqual({ kind: "owner", workspaces: ["Acme", "Beta"] });
    expect(deletionProblemText(owner)).toContain("Acme, Beta");
    expect(deletionProblem(new ApiError(400, "confirm_mismatch", "x"))).toEqual({ kind: "mismatch" });
    expect(deletionProblem(new ApiError(401, "invalid_credentials", "x"))).toEqual({ kind: "password" });
    expect(deletionProblem(new ApiError(404, "not_found", "x"))).toEqual({ kind: "unavailable" });
    expect(deletionProblem(new ApiError(0, "network", "x"))).toEqual({ kind: "offline" });
    expect(deletionProblem(new Error("boom"))).toEqual({ kind: "other" });
    for (const p of [owner, deletionProblem(new ApiError(400, "confirm_mismatch", "x")), deletionProblem(new ApiError(401, "invalid_credentials", "x"))]) {
      expect(deletionProblemText(p)).toContain("Nothing was deleted");
    }
  });
});
