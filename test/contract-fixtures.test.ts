import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { ApiClient, ApiError } from "../src/api/client";
import { zQueueItem } from "../src/api/schemas";
import type { Frame } from "../src/realtime/frames";
import { HANDLED_FRAMES, parseFrame } from "../src/realtime/frames";
import { type ApiCall, apiCalls, schemaOf } from "./support/apiCalls";
import { WEB_ROOT } from "./support/serverDir";
import { contractsRepo, currentCopy, differences, expectedCopy, fixtureName, listCopy, readCopy, type Route, type RouteTable } from "./support/contracts";

/**
 * The server's golden answers (test/contract-fixtures, copied from meldiq_android shared/contracts by
 * scripts/sync-contract-fixtures.ts) decoded by the web's own code: every route the web calls with the exact schema it
 * uses, every WebSocket frame with the engine's frame parser, every error answer with ApiClient. A contract change the web
 * can't read fails here.
 *
 * The strict pass looks for answers the web only reads because a `.catch()` replaced a value it doesn't know (an enum value
 * becoming "team" or "pending"). Those, and web calls with no server route, are listed in test/contract-allowlist.txt,
 * which may only shrink. Regenerate it with MELDIQ_WRITE_CONTRACT_ALLOWLIST=1 npx vitest run test/contract-fixtures.test.ts
 */
const ALLOWLIST = path.join(import.meta.dirname, "contract-allowlist.txt");

/**
 * The calls whose path and schema the engine leaves to their caller: NavSync's host.get/put (engine.ts), decoded with
 * zNavDoc in navPrefs.ts.
 */
const DELEGATED: Record<string, { method: string; path: string; schema: string; file: string }> = {
  "sync/engine.ts:GET": { method: "GET", path: "/v1/me/preferences/{}", schema: "zNavDoc", file: "src/sync/navPrefs.ts" },
  "sync/engine.ts:PUT": { method: "PUT", path: "/v1/me/preferences/{}", schema: "zNavDoc", file: "src/sync/navPrefs.ts" },
};

const table = readCopy<RouteTable>("routes.json");
const fixtures = new Set(listCopy("http"));

/** The server route a web path template ("/v1/calls/{}/join") calls: literal segments must match, preferring literals over parameters. */
function routeFor(method: string, template: string): Route | null {
  const want = template.split("/");
  let best: { route: Route; score: number } | null = null;
  for (const r of table.routes) {
    if (r.method !== method) continue;
    const have = r.path.split("/");
    if (have.length !== want.length) continue;
    let score = 0;
    const fits = want.every((w, i) => {
      const param = have[i].startsWith("{");
      if (w === "{}") return param;
      if (w === have[i]) return (score += 1) > 0;
      return param;
    });
    if (fits && (!best || score > best.score)) best = { route: r, score };
  }
  return best?.route ?? null;
}

// ───────────────────────── strict: where a .catch() fired ─────────────────────────

type ParseInput = { data: unknown; path: (string | number)[] };
type CatchDef = { catchValue: (ctx: { error: unknown; input: unknown }) => unknown };
const caught: string[] = [];
const catchProto = z.ZodCatch.prototype as unknown as { _parse(input: ParseInput): unknown; _def: CatchDef };
const original = catchProto._parse;

function pathText(p: (string | number)[]): string {
  return p.map((k) => (typeof k === "number" ? "[]" : `.${k}`)).join("") || "(root)";
}

/** Runs fn and returns the paths where a .catch() replaced an unexpected value. */
function catches(fn: () => void): string[] {
  caught.length = 0;
  fn();
  return [...new Set(caught)];
}

beforeAll(() => {
  catchProto._parse = function (this: { _def: CatchDef }, input: ParseInput) {
    const def = this._def;
    const value = def.catchValue;
    def.catchValue = (ctx) => {
      caught.push(`${pathText(input.path)} = ${JSON.stringify(ctx.input)?.slice(0, 40)}`);
      return value(ctx);
    };
    try {
      return original.call(this, input);
    } finally {
      def.catchValue = value;
    }
  };
});
afterAll(() => {
  catchProto._parse = original;
});

// ───────────────────────── the web's calls ─────────────────────────

interface Decode {
  call: string;
  fixture: string;
  schema: z.ZodTypeAny;
}

const calls = apiCalls();

async function decodes(): Promise<{ list: Decode[]; routed: Set<string>; unrouted: string[]; noFixture: string[] }> {
  const list: Decode[] = [];
  const routed = new Set<string>();
  const unrouted = new Set<string>();
  const noFixture = new Set<string>();
  const add = async (c: ApiCall, method: string, templates: string[]) => {
    for (const t of templates) {
      const r = routeFor(method, t);
      if (!r) {
        unrouted.add(`unrouted ${method} ${t}`);
        continue;
      }
      routed.add(`${r.method} ${r.path}`);
      const name = fixtureName(r);
      if (!fixtures.has(name)) {
        if (c.schema) noFixture.add(`${method} ${r.path}`);
        continue;
      }
      if (c.schema) list.push({ call: c.at, fixture: name, schema: await schemaOf(c) });
    }
  };
  for (const c of calls) {
    if (c.paths.length) {
      await add(c, c.method, c.paths);
      continue;
    }
    const d = DELEGATED[`${c.at.split(":")[0]}:${c.method}`];
    if (!d) throw new Error(`${c.at}: a call whose path isn't in the source; name it in DELEGATED`);
    await add({ ...c, at: `${d.file.slice(4)} (via ${c.at})`, schema: d.schema, file: path.join(WEB_ROOT, d.file) }, d.method, [d.path]);
  }
  return { list, routed, unrouted: [...unrouted].sort(), noFixture: [...noFixture].sort() };
}

function readAllowlist(): Set<string> {
  if (!fs.existsSync(ALLOWLIST)) return new Set();
  return new Set(
    fs
      .readFileSync(ALLOWLIST, "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#")),
  );
}

describe("server contract fixtures (meldiq_android shared/contracts, API " + table.version + ")", () => {
  it.skipIf(!contractsRepo())("test/contract-fixtures is the server checkout's current copy", () => {
    const repo = contractsRepo()!;
    expect(differences(expectedCopy(repo), currentCopy()), `differs from ${repo}: run npx tsx scripts/sync-contract-fixtures.ts`).toEqual([]);
  });

  it("the strict pass notices a value a .catch() replaced", () => {
    const schema = z.object({ items: z.array(z.object({ kind: z.enum(["team", "community"]).catch("team") })) });
    expect(catches(() => schema.parse({ items: [{ kind: "team" }, { kind: "guild" }] }))).toEqual(['.items[].kind = "guild"']);
  });

  it("decodes every answer the web reads, frame and error, with the strict findings only where already known", async () => {
    const { list, routed, unrouted, noFixture } = await decodes();
    const failures: string[] = [];
    const strict = new Set<string>();

    for (const d of list) {
      const body = readCopy<unknown>(`http/${d.fixture}.json`);
      let ok = true;
      const found = catches(() => {
        const r = d.schema.safeParse(body);
        if (!r.success) {
          ok = false;
          failures.push(`http/${d.fixture} (${d.call}): ${r.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
        }
      });
      if (ok) for (const c of found) strict.add(`strict http/${d.fixture} ${c.split(" = ")[0]}`);
    }

    const ignored: string[] = [];
    for (const name of listCopy("realtime")) {
      const raw = readCopy<Frame>(`realtime/${name}.json`);
      const found = catches(() => {
        const f = parseFrame(raw);
        if (!HANDLED_FRAMES.has(raw.t)) {
          if (f) failures.push(`realtime/${name}: parsed although the engine doesn't handle ${raw.t}`);
          ignored.push(raw.t);
          return;
        }
        if (!f) return void failures.push(`realtime/${name}: the engine would ignore it`);
        if (f.t === "queue") for (const [i, item] of f.items.entries()) if (!zQueueItem.safeParse(item).success) failures.push(`realtime/${name}: item ${i}`);
      });
      for (const c of found) strict.add(`strict realtime/${name} ${c.split(" = ")[0]}`);
    }

    const api = new ApiClient("http://contract.test");
    const realFetch = globalThis.fetch;
    try {
      for (const code of listCopy("http/errors")) {
        const body = readCopy<{ error: { code: string; message: string } }>(`http/errors/${code}.json`);
        const status = table.errors[code]?.[0] ?? 400;
        globalThis.fetch = async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
        const e = await api.call("GET", "/v1/x").then(
          () => null,
          (x: unknown) => x,
        );
        if (!(e instanceof ApiError) || e.code !== code || e.message !== body.error.message) failures.push(`http/errors/${code}: read as ${e instanceof ApiError ? e.code : String(e)}`);
      }
    } finally {
      globalThis.fetch = realFetch;
    }

    const now = [...strict, ...unrouted].sort();
    const allowed = readAllowlist();
    if (process.env.MELDIQ_WRITE_CONTRACT_ALLOWLIST === "1") {
      fs.writeFileSync(
        ALLOWLIST,
        "# Known contract gaps (test/contract-fixtures.test.ts); this list may only shrink.\n" +
          "# strict <fixture> <path>: the web reads the answer only because a .catch() replaced a value it doesn't know.\n" +
          "# unrouted <call>: a web call with no route on the server.\n" +
          now.map((l) => `${l}\n`).join(""),
      );
    }
    // The numbers behind the result, on request: MELDIQ_CONTRACT_REPORT=1.
    if (process.env.MELDIQ_CONTRACT_REPORT === "1")
      process.stdout.write(
        [
          `contract: ${calls.length} web calls (${calls.filter((c) => c.schema).length} decode) reach ${routed.size} of the server's ${table.routes.length} routes; ${list.length} decodes against ${new Set(list.map((d) => d.fixture)).size} fixtures`,
          `frames the engine ignores: ${[...new Set(ignored)].join(", ") || "none"}`,
          `decoded web routes with no fixture: ${noFixture.join(", ") || "none"}`,
          `allowlisted: ${now.length}`,
        ].join("\n") + "\n",
      );

    expect(failures, "fixtures the web can't decode").toEqual([]);
    expect(
      now.filter((l) => !allowed.has(l)),
      "new contract gaps: a value a .catch() replaced, or a call with no server route",
    ).toEqual([]);
    expect(
      [...allowed].filter((l) => !now.includes(l)),
      "allowlisted gaps that are gone now: remove them from test/contract-allowlist.txt",
    ).toEqual([]);
  });
});
