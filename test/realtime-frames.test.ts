import { describe, expect, it } from "vitest";
import { type ClientFrame, type Frame, parseFrame, readFrame, writeFrame } from "../src/realtime/frames";
import { listCopy, readCopy } from "./support/contracts";

/**
 * Both directions of /v1/ws against the server's contract: what the browser sends matches realtime.schema.json's
 * ClientEvent, and every captured server frame is read by the socket and the engine; unknown names and fields are ignored.
 */
type Shape = { properties: Record<string, { const?: string; type?: string; items?: { type: string } }>; required: string[]; additionalProperties: boolean };
const clientEvents = readCopy<{ anyOf: Shape[] }>("realtime-client.schema.json").anyOf;

/** The schema's own rules for one frame: its `t`, required fields, no others, and each field's JSON type. */
function problems(text: string): string[] {
  const f = JSON.parse(text) as Record<string, unknown>;
  const shape = clientEvents.find((s) => s.properties.t?.const === f.t);
  if (!shape) return [`no ClientEvent "${String(f.t)}"`];
  const out: string[] = [];
  for (const k of shape.required) if (!(k in f)) out.push(`missing ${k}`);
  for (const [k, v] of Object.entries(f)) {
    const p = shape.properties[k];
    if (!p) out.push(`extra ${k}`);
    else if (p.type === "array" ? !Array.isArray(v) || v.some((x) => !Number.isInteger(x)) : p.type === "boolean" ? typeof v !== "boolean" : typeof v !== "string") out.push(`${k} is ${typeof v}`);
  }
  return out;
}

describe("frames the browser sends", () => {
  const sent: ClientFrame[] = [
    { t: "auth", token: "<redacted>" },
    { t: "ping" },
    { t: "ack", ids: [1, 2, 3], backlog: true },
    { t: "ack", ids: [] },
    { t: "typing", c: "c_RaRwGaU3klBejiGR5dSVSA", on: true },
  ];
  it.each(sent.map((f) => [f.t, f] as const))("%s matches the server's ClientEvent schema", (_t, f) => {
    expect(problems(writeFrame(f))).toEqual([]);
  });

  it("writes only the schema's fields, whatever the object carries", () => {
    const extra = { t: "typing", c: "c_1", on: false, secret: "x" } as ClientFrame;
    expect(JSON.parse(writeFrame(extra))).toEqual({ t: "typing", c: "c_1", on: false });
  });
});

describe("frames the server sends", () => {
  it.each(listCopy("realtime"))("%s is read from its text by the socket", (name) => {
    const raw = readCopy<Frame>(`realtime/${name}.json`);
    expect(readFrame(JSON.stringify(raw))).toEqual(raw);
  });

  it("an unknown frame, extra fields or a broken one are ignored, never thrown", () => {
    expect(parseFrame({ t: "hologram.updated", id: "x" })).toBeNull();
    expect(parseFrame({ t: "typing", c: "c_1", u: "u_1", on: true, since: 5 })).toEqual({ t: "typing", c: "c_1", u: "u_1", on: true });
    expect(parseFrame({ t: "conv.updated" })).toBeNull();
    expect(parseFrame({ t: "call", event: "ring", call: { id: 5 } })).toBeNull();
    for (const bad of ["not json", "[]", '{"x":1}', '{"t":5}', 42, null]) expect(readFrame(bad)).toBeNull();
    expect(readFrame("x".repeat(4 * 1024 * 1024 + 1))).toBeNull();
  });
});
