import { describe, expect, it } from "vitest";
import { dropOnRail, railItems, type RailState, ungroupFolder } from "../src/sync/railFolders";

/** Rail folders and drag-and-drop (2026-10-28): one flat order plus folders, agreeing after every drop. */
const base: RailState = { order: ["a", "b", "c", "d"], folders: [] };
const shape = (s: RailState) => railItems(s.order, s.folders).map((it) => (it.kind === "org" ? it.id : `[${it.folder.orgIds.join(",")}]`));

describe("rail drag and drop", () => {
  it("moves a community before or after another", () => {
    expect(shape(dropOnRail(base, { kind: "org", id: "d" }, { kind: "org", id: "a" }, "before"))).toEqual(["d", "a", "b", "c"]);
    expect(shape(dropOnRail(base, { kind: "org", id: "a" }, { kind: "org", id: "c" }, "after"))).toEqual(["b", "c", "a", "d"]);
  });

  it("drops a community onto another to make a folder where the target was, then into the folder", () => {
    const made = dropOnRail(base, { kind: "org", id: "d" }, { kind: "org", id: "b" }, "into");
    expect(shape(made)).toEqual(["a", "[b,d]", "c"]);
    const folder = made.folders[0];
    const more = dropOnRail(made, { kind: "org", id: "a" }, { kind: "folder", id: folder.id }, "into");
    expect(shape(more)).toEqual(["[b,d,a]", "c"]);
  });

  it("places a community among an open folder's members, and takes one out to the top level", () => {
    const made = dropOnRail(base, { kind: "org", id: "c" }, { kind: "org", id: "a" }, "into");
    const id = made.folders[0].id;
    const placed = dropOnRail(made, { kind: "org", id: "d" }, { kind: "org", id: "a" }, "after", id);
    expect(shape(placed)).toEqual(["[a,d,c]", "b"]);
    const out = dropOnRail(placed, { kind: "org", id: "d" }, { kind: "org", id: "b" }, "after");
    expect(shape(out)).toEqual(["[a,c]", "b", "d"]);
    // The last member out: the folder goes.
    const one = dropOnRail(dropOnRail(out, { kind: "org", id: "a" }, { kind: "org", id: "b" }, "before"), { kind: "org", id: "c" }, { kind: "org", id: "d" }, "after");
    expect(one.folders).toEqual([]);
    expect(shape(one)).toEqual(["a", "b", "d", "c"]);
  });

  it("moves a folder as a block, never into another folder; ungrouping keeps the order", () => {
    const made = dropOnRail(base, { kind: "org", id: "b" }, { kind: "org", id: "a" }, "into");
    const id = made.folders[0].id;
    expect(shape(dropOnRail(made, { kind: "folder", id }, { kind: "org", id: "d" }, "after"))).toEqual(["c", "d", "[a,b]"]);
    expect(dropOnRail(made, { kind: "folder", id }, { kind: "org", id: "c" }, "into")).toBe(made);
    expect(shape(ungroupFolder(made, id))).toEqual(["a", "b", "c", "d"]);
  });

  it("ignores folders' unknown communities and keeps every community in the order", () => {
    const s: RailState = { order: ["a", "b"], folders: [{ id: "f_x1234", name: "", color: null, orgIds: ["gone", "b"] }] };
    expect(shape(s)).toEqual(["a", "[b]"]);
    expect(dropOnRail(s, { kind: "org", id: "a" }, { kind: "org", id: "a" }, "into")).toBe(s);
  });
});
