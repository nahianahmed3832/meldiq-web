import { z } from "zod";

/**
 * Runtime configuration, read from /config.json when the page loads, so moving Orbit Web to another domain or pointing
 * it at another API is a deployment change, not a rebuild (docs/ORBIT_WEB_DEPLOYMENT.md). Without the file (development)
 * everything is same-origin: the page's own host serves /v1 and /v2 (Vite or nginx proxies them to the API).
 *
 *   { "apiBase": "", "wsUrl": null, "publicUrl": "https://web.griipbuddy.cloud", "environment": "production" }
 *
 * apiBase: "" for same-origin (recommended), or the API's https origin (the server must list this site in WEB_ORIGINS).
 * wsUrl: the realtime URL; by default derived from apiBase (or the page's host).
 */
const local = (u: URL) => u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname.endsWith(".localhost");

const zOrigin = z
  .string()
  .max(200)
  .refine((v) => {
    if (v === "") return true;
    try {
      const u = new URL(v);
      return (u.protocol === "https:" || (u.protocol === "http:" && local(u))) && u.pathname === "/" && !u.search && !u.hash;
    } catch {
      return false;
    }
  }, "apiBase must be empty or an https origin");

const zWs = z
  .string()
  .max(300)
  .refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === "wss:" || (u.protocol === "ws:" && local(u));
    } catch {
      return false;
    }
  }, "wsUrl must be a wss:// URL");

/**
 * Firebase Cloud Messaging for background notifications (the same Firebase project as the Android app): the project's
 * public web-app settings and its Web Push key (VAPID public key), from Firebase console › Project settings. None of
 * these is a secret. Without them the web shows notifications only while a Meldiq tab is open.
 */
const zFirebase = z.object({
  apiKey: z.string().min(10).max(100),
  projectId: z.string().regex(/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/),
  messagingSenderId: z.string().regex(/^\d{3,20}$/),
  appId: z.string().regex(/^\d+:\d+:web:[0-9a-f]+$/, "firebase.appId must be a web app's id (1:…:web:…)"),
  vapidKey: z.string().regex(/^[A-Za-z0-9_-]{80,100}$/, "firebase.vapidKey must be the Web Push key pair's public key"),
});
export type FirebaseWebConfig = z.infer<typeof zFirebase>;

const zConfig = z.object({
  apiBase: zOrigin.default("").transform((v) => v.replace(/\/$/, "")),
  wsUrl: zWs.nullable().default(null),
  publicUrl: z.string().max(200).nullable().default(null),
  environment: z.enum(["development", "staging", "production"]).default("production"),
  firebase: zFirebase.nullable().default(null),
});
export type RuntimeConfig = z.infer<typeof zConfig>;

let current: RuntimeConfig = zConfig.parse({});

/** Loads /config.json once at start. A missing file keeps the defaults; a malformed one stops with a clear error. */
export async function loadConfig(fetcher: typeof fetch = fetch): Promise<RuntimeConfig> {
  let raw: unknown = {};
  try {
    const res = await fetcher("/config.json", { cache: "no-store", credentials: "omit" });
    if (res.ok && (res.headers.get("content-type") ?? "").includes("json")) raw = await res.json();
  } catch {
    /* no file: same-origin defaults */
  }
  const parsed = zConfig.safeParse(raw);
  if (!parsed.success) throw new Error(`config.json is invalid: ${parsed.error.issues[0]?.message ?? "unreadable"}`);
  current = parsed.data;
  return current;
}

export function config(): RuntimeConfig {
  return current;
}

/** The API's base for fetch: "" (same origin) or an https origin. */
export function apiBase(): string {
  return current.apiBase;
}

/** The realtime WebSocket URL. */
export function wsUrl(): string {
  if (current.wsUrl) return current.wsUrl;
  if (current.apiBase) return `${current.apiBase.replace(/^http/, "ws")}/v1/ws`;
  return `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/v1/ws`;
}

/** The server people see named on the sign-in screen. */
export function serverHost(): string {
  return current.apiBase ? new URL(current.apiBase).host : location.host;
}
