import { describe, expect, it } from "vitest";
import { detailsTabs } from "../src/ui/chat/detailsRules";

describe("details tabs (batch B14, android DetailsRules.tabs)", () => {
  it("gives a group its members first", () => {
    expect(detailsTabs("GROUP")).toEqual(["members", "media", "pins", "links", "files"]);
  });

  it("opens a direct message on Media: its two people are in the header", () => {
    expect(detailsTabs("DM")).toEqual(["media", "pins", "links", "files"]);
  });
});
