import { describe, expect, it } from "vitest";
import { detailsTabs } from "../src/ui/chat/detailsRules";

describe("details tabs (batches B14 and B14b, android DetailsRules.tabs)", () => {
  it("gives a group its members first", () => {
    expect(detailsTabs("GROUP")).toEqual(["members", "media", "pins", "links", "files"]);
  });

  it("opens a direct message on Media: its two people are in the header", () => {
    expect(detailsTabs("DM")).toEqual(["media", "pins", "links", "files"]);
  });

  it("gives a channel Members, Media, Pins, Threads, Links and Files; a forum has no Threads tab (its posts are its threads)", () => {
    expect(detailsTabs("CHANNEL")).toEqual(["members", "media", "pins", "threads", "links", "files"]);
    expect(detailsTabs("CHANNEL", "forum")).toEqual(["members", "media", "pins", "links", "files"]);
    expect(detailsTabs("CHANNEL", null, true)).toEqual(["members"]);
  });
});
