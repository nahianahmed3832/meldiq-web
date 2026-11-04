import { describe, expect, it } from "vitest";
import { encodePayload, withoutServerFields } from "../src/protocol/payload";
import { cleanBotComponents } from "../src/sync/botComponentRules";
import { postedOf } from "../src/sync/rules";

const controls = { expiresAt: 1_800_000_000_000, items: [{ type: "button", customId: "confirm", label: "Confirm" }] };

describe("source-bound bot controls", () => {
  it("keeps readable message content while dropping malformed, duplicated or oversized controls", () => {
    expect(postedOf({ type: "text", text: "Readable", botComponents: controls }).botComponents).toEqual(controls);
    for (const value of [
      null,
      { ...controls, items: [] },
      { ...controls, items: [...controls.items, ...controls.items] },
      { ...controls, items: Array.from({ length: 6 }, (_, i) => ({ ...controls.items[0], customId: `item${i}` })) },
    ]) {
      expect(cleanBotComponents(value)).toBeNull();
      expect(postedOf({ type: "text", text: "Readable", botComponents: value ?? undefined }).botComponents).toBeUndefined();
    }
  });

  it("does not forward or encrypt controls as user-owned message content", () => {
    expect(postedOf({ type: "text", text: "Forwarded", forwarded: true, botComponents: controls }).botComponents).toBeUndefined();
    expect(JSON.parse(encodePayload(withoutServerFields({ type: "text", text: "Human copy", botComponents: controls })))).toEqual({ type: "text", text: "Human copy" });
  });

  it("rejects prototype field ids, impossible selections and conflicting form bounds", () => {
    for (const id of ["__proto__", "constructor", "prototype"])
      expect(cleanBotComponents({ ...controls, items: [{ type: "form", customId: "form", label: "Form", fields: [{ id, label: "Field" }] }] })).toBeNull();
    expect(cleanBotComponents({ ...controls, items: [{ type: "select", customId: "pick", label: "Pick", options: [{ label: "One", value: "one" }], maxValues: 2 }] })).toBeNull();
    expect(cleanBotComponents({ ...controls, items: [{ type: "form", customId: "form", label: "Form", fields: [{ id: "note", label: "Note", minLength: 9, maxLength: 3 }] }] })).toBeNull();
  });
});
