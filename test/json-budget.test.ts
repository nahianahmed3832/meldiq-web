import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ApiClient } from "../src/api/client";
import { withinJsonBudget } from "../src/api/jsonBudget";
import { parsePayload } from "../src/protocol/payload";
import { parseFrame } from "../src/realtime/frames";

describe("JSON validation work limits", () => {
  it("also rejects oversized realtime and legacy message payloads", () => {
    const oversized = Array(10_001).fill(null);
    expect(parseFrame({ t: "call", call: { participants: oversized } })).toBeNull();
    expect(parsePayload(JSON.stringify({ type: "text", text: "oversized", attachments: oversized }))).toBeNull();
    expect(parsePayload(JSON.stringify({ type: "text", text: "normal" }))).toMatchObject({ text: "normal" });
  });
  it("accepts realistic paged history and rejects oversized collections before reading their elements", () => {
    expect(withinJsonBudget({ messages: Array.from({ length: 500 }, () => ({ id: "message", payload: { text: "A message", attachments: [] } })) })).toBe(true);
    const get = vi.fn();
    const huge = new Proxy(new Array(10_001), {
      get(target, key, receiver) {
        if (key !== "length") get(key);
        return Reflect.get(target, key, receiver);
      },
    });
    expect(withinJsonBudget(huge)).toBe(false);
    expect(get).not.toHaveBeenCalled();
  });
  it("bounds depth, total work and cycles", () => {
    let nested: unknown = null;
    for (let i = 0; i < 66; i++) nested = { child: nested };
    expect(withinJsonBudget(nested)).toBe(false);
    expect(withinJsonBudget(Array.from({ length: 100 }, () => Array.from({ length: 1001 }, () => 0)))).toBe(false);
    const cycle: unknown[] = [];
    cycle.push(cycle);
    expect(withinJsonBudget(cycle)).toBe(false);
  });
  it("refuses an oversized API answer before invoking its schema validator", async () => {
    const schema = z.array(z.string());
    const parse = vi.spyOn(schema, "safeParse");
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(Array(10_001).fill(null)), { status: 200 }));
    try {
      await expect(new ApiClient("http://meldiq.test").json("GET", "/test", schema)).rejects.toMatchObject({ code: "decode" });
      expect(parse).not.toHaveBeenCalled();
    } finally {
      fetch.mockRestore();
    }
  });
});
