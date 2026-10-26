import { describe, expect, it } from "vitest";
import { inviteFromLocation } from "../src/application/pendingInvite";

describe("invitation links into Meldiq Web", () => {
  it("reads the code from /join/<code>", () => {
    expect(inviteFromLocation("/join/ABCD-EFGH-JKLM", "")).toBe("ABCD-EFGH-JKLM");
    expect(inviteFromLocation("/join/abcd-efgh-jklm/", "")).toBe("ABCD-EFGH-JKLM");
  });

  it("reads ?invite=<code> on any page", () => {
    expect(inviteFromLocation("/home", "?invite=ABCDEFGHJKLM")).toBe("ABCDEFGHJKLM");
  });

  it("ignores anything that isn't an invitation code", () => {
    expect(inviteFromLocation("/join/<script>", "")).toBeNull();
    expect(inviteFromLocation("/join/a%2Fb", "")).toBeNull();
    expect(inviteFromLocation("/join/", "")).toBeNull();
    expect(inviteFromLocation("/home", "?invite=" + "A".repeat(80))).toBeNull();
    expect(inviteFromLocation("/home/c/c_1", "")).toBeNull();
  });
});
