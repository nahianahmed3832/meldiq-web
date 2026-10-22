/**
 * Meldiq Web on this machine, in front of the API the way production nginx is (deploy/nginx/meldiq-web.conf.template):
 * /v1 and /v2 go to ORBIT_API_URL (the /v1/ws WebSocket too). Development and tests only.
 *
 * - A build (`node scripts/web-server.ts dist 4173`): the files with the production security headers and
 *   Content-Security-Policy, /sw.js and pages not cached, hashed assets cached, and any other path answered with
 *   index.html. Browser tests run the production build through it, so a CSP violation fails them.
 * - Development (`MELDIQ_APP_UPSTREAM=http://127.0.0.1:5182`): everything else goes to `next dev` instead, without
 *   the CSP (its hot reloading evaluates code).
 *
 * ORBIT_E2E_FORWARD=1: a test's x-orbit-test-ip becomes the forwarded client address, so the server's per-address
 * sign-in limits apply per test (playwright.config.ts).
 */
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "dist");
const port = Number(process.argv[3] ?? 5181);
const api = new URL(process.env.ORBIT_API_URL ?? "http://127.0.0.1:8091");
const app = process.env.MELDIQ_APP_UPSTREAM ? new URL(process.env.MELDIQ_APP_UPSTREAM) : null;
const here = path.resolve(import.meta.dirname, "..");
const origin = `127.0.0.1:${port}`;

/** The production headers, for plain http on this machine: ws:// instead of wss://, no upgrade-insecure-requests or HSTS. */
function headers(): [string, string][] {
  const text = fs.readFileSync(path.join(here, "deploy/nginx/meldiq-web-headers.conf.template"), "utf8");
  const extra = [`ws://${origin}`, process.env.ORBIT_E2E_LIVEKIT, process.env.ORBIT_E2E_LIVEKIT?.replace(/^ws/, "http")].filter(Boolean).join(" ");
  return [...text.matchAll(/^add_header ([A-Za-z-]+) "(.*)" always;$/gm)]
    .filter((m) => m[1] !== "Strict-Transport-Security")
    .map((m) => [m[1], m[2].replaceAll("wss://${WEB_HOST}", `ws://${origin}`).replaceAll("${WEB_HOST}", origin).replaceAll("${CONNECT_EXTRA}", extra).replace("; upgrade-insecure-requests", "")]);
}
const SECURITY = headers();

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".mp4": "video/mp4",
  ".wasm": "application/wasm",
  ".txt": "text/plain; charset=utf-8",
};

function forwardedFor(req: http.IncomingMessage): string {
  const ip = req.headers["x-orbit-test-ip"];
  if (process.env.ORBIT_E2E_FORWARD === "1" && typeof ip === "string" && /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) return ip;
  return req.socket.remoteAddress ?? "127.0.0.1";
}

function proxy(req: http.IncomingMessage, res: http.ServerResponse, to: URL): void {
  const upstream = http.request(
    { host: to.hostname, port: to.port, method: req.method, path: req.url, headers: { ...req.headers, host: to.host, "x-forwarded-for": forwardedFor(req), "x-forwarded-proto": "http" } },
    (r) => {
      res.writeHead(r.statusCode ?? 502, r.headers);
      r.pipe(res);
    },
  );
  upstream.on("error", () => {
    if (!res.headersSent) res.writeHead(502);
    res.end();
  });
  req.pipe(upstream);
}

/** The file nginx would answer with (try_files $uri /index.html), and its cache policy. */
function resolve(urlPath: string): { file: string; cache: string } | null {
  const clean = path.normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, "");
  if (clean.startsWith("/invite/")) return { file: path.join(root, "invite.html"), cache: "no-cache" };
  const file = path.join(root, clean);
  if (!file.startsWith(root)) return null;
  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    const immutable = clean.startsWith("/_next/static/") || clean.startsWith("/assets/");
    return { file, cache: immutable ? "public, max-age=31536000, immutable" : clean === "/config.json" ? "no-store" : "no-cache" };
  }
  if (path.extname(clean) && clean !== "/") return null;
  return { file: path.join(root, "index.html"), cache: "no-cache" };
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://${origin}`);
  if (/^\/v[12]\//.test(url.pathname)) return proxy(req, res, api);
  if (app) return proxy(req, res, app);
  const found = resolve(url.pathname);
  if (!found) {
    res.writeHead(404, Object.fromEntries(SECURITY));
    return void res.end("Not found");
  }
  res.writeHead(200, { ...Object.fromEntries(SECURITY), "content-type": TYPES[path.extname(found.file)] ?? "application/octet-stream", "cache-control": found.cache });
  fs.createReadStream(found.file).pipe(res);
});

/** WebSockets: /v1/ws to the API; in development, Next.js's hot reloading to `next dev`. */
server.on("upgrade", (req, socket: net.Socket, head) => {
  const to = req.url?.startsWith("/v1/ws") ? api : app;
  if (!to) return void socket.destroy();
  const up = net.connect(Number(to.port), to.hostname, () => {
    const lines = [`${req.method} ${req.url} HTTP/1.1`];
    for (let i = 0; i < req.rawHeaders.length; i += 2) if (!/^(host|x-forwarded-for)$/i.test(req.rawHeaders[i])) lines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
    lines.push(`Host: ${to.host}`, `X-Forwarded-For: ${forwardedFor(req)}`);
    up.write(`${lines.join("\r\n")}\r\n\r\n`);
    if (head.length) up.write(head);
    up.pipe(socket);
    socket.pipe(up);
  });
  const close = () => {
    up.destroy();
    socket.destroy();
  };
  up.on("error", close);
  socket.on("error", close);
});

server.listen(port, "127.0.0.1", () => process.stdout.write(`Meldiq Web on http://${origin}: ${app ? `next dev at ${app.origin}` : root}, API ${api.origin}\n`));
