import fs from "node:fs";
import path from "node:path";
import { WEB_ROOT } from "./serverDir";

/**
 * The server's published contract (Architecture 1.0): golden answers in `shared/contracts/fixtures` and the routes in
 * `docs/api/openapi.json` of the meldiq_android repository. The web keeps a copy in test/contract-fixtures, like
 * test/vectors, so `npm test` needs no server checkout; `npx tsx scripts/sync-contract-fixtures.ts` refreshes it.
 */
export const CONTRACT_COPY = path.join(WEB_ROOT, "test/contract-fixtures");

export interface Route {
  method: string;
  /** OpenAPI form: /v1/calls/{id}/join */
  path: string;
}

export interface RouteTable {
  version: string;
  routes: Route[];
  /** Error code → the statuses it's answered with. */
  errors: Record<string, number[]>;
}

/** The fixture file a route's answer is captured in (server naming): POST /v1/calls/{id}/join → POST_v1_calls_id_join. */
export function fixtureName(r: Route): string {
  return `${r.method}_${r.path.slice(1).replaceAll("/", "_").replace(/[{}]/g, "")}`;
}

/** The checkout this one is a worktree of, if it is one (its .git is a file pointing into the main .git). */
function mainCheckout(): string | null {
  try {
    const m = /^gitdir: (.+)$/m.exec(fs.readFileSync(path.join(WEB_ROOT, ".git"), "utf8"));
    const i = m ? m[1].indexOf(`${path.sep}.git${path.sep}worktrees${path.sep}`) : -1;
    return m && i > 0 ? m[1].slice(0, i) : null;
  } catch {
    return null;
  }
}

/**
 * The repository the contract comes from: MELDIQ_CONTRACTS_DIR (its root), the repository around ORBIT_SERVER_DIR, or a
 * meldiq_android clone next to this one (or next to the checkout this worktree belongs to). Null when there's none.
 */
export function contractsRepo(): string | null {
  const server = process.env.ORBIT_SERVER_DIR;
  const main = mainCheckout();
  const candidates = [process.env.MELDIQ_CONTRACTS_DIR, server && path.join(server, ".."), path.join(WEB_ROOT, "../meldiq_android"), main && path.join(main, "../meldiq_android")];
  const found = candidates.find((c): c is string => !!c && fs.existsSync(path.join(c, "shared/contracts/fixtures/http")) && fs.existsSync(path.join(c, "docs/api/openapi.json")));
  return found ? path.resolve(found) : null;
}

const METHODS = ["get", "post", "put", "patch", "delete"];

/** The route table derived from openapi.json (the 1.3 MB file itself isn't copied). */
function routeTable(repo: string): RouteTable {
  const api = JSON.parse(fs.readFileSync(path.join(repo, "docs/api/openapi.json"), "utf8")) as {
    info: { version: string };
    paths: Record<string, Record<string, unknown>>;
    "x-error-codes": Record<string, { status: number[] }>;
  };
  const routes = Object.entries(api.paths).flatMap(([p, ops]) => METHODS.filter((m) => m in ops).map((m) => ({ method: m.toUpperCase(), path: p })));
  const errors = Object.fromEntries(Object.entries(api["x-error-codes"]).map(([code, e]) => [code, e.status]));
  return { version: api.info.version, routes, errors };
}

function readTree(dir: string, base = dir): Map<string, string> {
  const out = new Map<string, string>();
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) for (const [k, v] of readTree(full, base)) out.set(k, v);
    else if (e.name.endsWith(".json")) out.set(path.relative(base, full).split(path.sep).join("/"), fs.readFileSync(full, "utf8"));
  }
  return out;
}

/** What test/contract-fixtures should hold for this server checkout: the fixtures as they are, and routes.json. */
export function expectedCopy(repo: string): Map<string, string> {
  const files = readTree(path.join(repo, "shared/contracts/fixtures"));
  files.set("routes.json", `${JSON.stringify(routeTable(repo), null, 2)}\n`);
  return files;
}

export function currentCopy(): Map<string, string> {
  return readTree(CONTRACT_COPY);
}

/** Files that differ between two copies, missing or extra included. */
export function differences(want: Map<string, string>, have: Map<string, string>): string[] {
  const names = [...new Set([...want.keys(), ...have.keys()])].sort();
  return names.filter((n) => want.get(n) !== have.get(n)).map((n) => (!have.has(n) ? `missing ${n}` : !want.has(n) ? `extra ${n}` : `changed ${n}`));
}

export function readCopy<T>(rel: string): T {
  return JSON.parse(fs.readFileSync(path.join(CONTRACT_COPY, rel), "utf8")) as T;
}

export function listCopy(dir: string): string[] {
  return fs
    .readdirSync(path.join(CONTRACT_COPY, dir))
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -".json".length))
    .sort();
}
