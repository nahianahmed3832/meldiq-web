/**
 * Drives the real transfer manager and encryption with a simulated API and storage link.
 * Usage: tsx scripts/bench-media-uploads.ts /path/to/fixtures [repeats=3]
 * Set MELDIQ_MEDIA_BASELINE_SRC to a baseline src/ path to alternate baseline and candidate runs.
 * MELDIQ_MEDIA_SCENARIO optionally selects one scenario.
 * Fixtures: photo.jpg, photo.png, photo.webp, animation.gif, clip.mp4, clip.webm, large.mp4 (>64 MiB).
 */
import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import type { Engine } from "../src/sync/engine";
import { type OutgoingFile, Transfers } from "../src/sync/transfers";

const MiB = 1024 * 1024;
const profiles = [
  { name: "low-latency", rtt: 15, mbps: 300 },
  { name: "high-latency", rtt: 150, mbps: 100 },
  { name: "constrained", rtt: 90, mbps: 12 },
];
const mime = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", mp4: "video/mp4", webm: "video/webm" };

async function fixture(name: string): Promise<OutgoingFile> {
  const type = mime[name.split(".").at(-1) as keyof typeof mime];
  const source = new Blob([await readFile(join(process.argv[2], name))], { type });
  return { name: basename(name), size: source.size, type, source, lastModified: 1 };
}

type Manager = new (engine: Engine) => Pick<Transfers, "start" | "list">;
const baselineSrc = process.env.MELDIQ_MEDIA_BASELINE_SRC;
const baseline: Manager | undefined = baselineSrc ? (await import(pathToFileURL(join(baselineSrc, "sync/transfers.ts")).href)).Transfers : undefined;
async function simulate(Manager: Manager, files: OutgoingFile[], profile: (typeof profiles)[number], messages: number) {
  type Part = { n: number; size: number; sha256: string };
  const kv = new Map<string, unknown>();
  const sessions = new Map<string, Map<number, Part>>();
  const specs = new Map<string, Part>();
  const requests: Record<string, number> = {};
  const active = new Set<{ remaining: number }>();
  let peak = 0;
  let bytes = 0;
  let sessionId = 0;
  const tickMs = 20;
  let lastTick = performance.now();
  const tick = () => {
    const now = performance.now();
    const allowance = (profile.mbps * 1_000_000 * (now - lastTick)) / (8_000 * active.size);
    lastTick = now;
    for (const put of active) put.remaining -= allowance;
  };
  const ticker = setInterval(tick, tickMs);
  const count = (label: string) => (requests[label] = (requests[label] ?? 0) + 1);
  const signed = (key: string) => ({ method: "PUT", url: `https://storage.invalid/${key}`, headers: {}, expiresAt: Date.now() + 60_000 });
  const stored = (id: string) => ({ id, size: 1, expiresAt: 1 });
  const engine = {
    state: { get: () => ({ server: { fileMaxBytes: 1_000_000_000, attachmentMaxBytes: 1_001_000_000 } }) },
    store: {
      getValue: async (k: string) => kv.get(k),
      setValue: async (k: string, v: unknown) => void kv.set(k, structuredClone(v)),
      deleteValue: async (k: string) => void kv.delete(k),
      valuesWithPrefix: async () => [],
    },
    api: {
      json: async (method: string, path: string, schema: { parse(value: unknown): unknown }, opts: { body?: { size?: number; parts?: Part[] }; signal?: AbortSignal } = {}) => {
        await sleep(profile.rtt, undefined, { signal: opts.signal });
        if (path === "/v1/attachments/uploads") {
          count("start");
          const uploadId = `a${++sessionId}`;
          sessions.set(uploadId, new Map());
          const size = opts.body!.size!;
          return schema.parse(
            size > 64 * MiB
              ? { mode: "multipart", uploadId, partSize: 16 * MiB, partCount: Math.ceil(size / (16 * MiB)), expiresAt: 1 }
              : { mode: "single", uploadId, upload: signed(uploadId), expiresAt: 1 },
          );
        }
        const [, , , , id, action] = path.split("/");
        const parts = sessions.get(id)!;
        if (action === "parts" && method === "POST") {
          count("sign");
          return schema.parse({
            parts: opts.body!.parts!.map((part) => {
              const key = `${id}/${part.n}`;
              specs.set(key, part);
              return { n: part.n, upload: signed(key) };
            }),
          });
        }
        if (action === "parts" && method === "GET") {
          count("list");
          return schema.parse({ parts: [...parts.values()].map((part) => ({ ...part, etag: `"e${part.n}"` })) });
        }
        if (action !== "complete") throw new Error(`Unexpected ${method} ${path}`);
        count("complete");
        if (parts.size !== (opts.body?.parts?.length ?? 0)) throw new Error("Incomplete multipart payload");
        return schema.parse(stored(id));
      },
      call: async () => {},
    },
    sendText: async () => "message",
  } as unknown as Engine;
  const fetch = globalThis.fetch;
  globalThis.fetch = (async (url: string, opts: { body: Blob; signal?: AbortSignal }) => {
    count("put");
    const key = new URL(url).pathname.slice(1);
    const put = { remaining: opts.body.size };
    await sleep(profile.rtt, undefined, { signal: opts.signal });
    tick();
    active.add(put);
    peak = Math.max(peak, active.size);
    try {
      while (put.remaining > 0) await sleep(tickMs, undefined, { signal: opts.signal });
    } finally {
      tick();
      active.delete(put);
    }
    bytes += opts.body.size;
    const spec = specs.get(key);
    if (spec) sessions.get(key.split("/")[0])!.set(spec.n, spec);
    return new Response("", { headers: spec ? { etag: `"e${spec.n}"` } : {} });
  }) as typeof globalThis.fetch;
  try {
    const manager = new Manager(engine);
    const began = performance.now();
    const ids = await Promise.all(Array.from({ length: messages }, (_, n) => manager.start(`c${n}`, files, "benchmark")));
    for (;;) {
      const jobs = manager.list().filter((job) => ids.includes(job.id));
      if (performance.now() - began > 180_000 || jobs.some((job) => job.status === "failed" || job.status === "interrupted")) throw new Error(JSON.stringify(jobs));
      if (jobs.length === messages && jobs.every((job) => job.status === "sent")) break;
      await sleep(10);
    }
    return { ms: Math.round(performance.now() - began), peak, requests, bytes };
  } finally {
    globalThis.fetch = fetch;
    clearInterval(ticker);
  }
}

const [jpg, png, webp, gif, mp4, webm, large] = await Promise.all(["photo.jpg", "photo.png", "photo.webp", "animation.gif", "clip.mp4", "clip.webm", "large.mp4"].map(fixture));
const cases = [
  { name: "jpeg", files: [jpg], messages: 1 },
  { name: "mixed-album", files: [jpg, png, webp, gif, mp4, webm], messages: 1 },
  { name: "concurrent-albums", files: [jpg, png, webp, gif, mp4, webm], messages: 2 },
  { name: "multipart-video", files: [large], messages: 1 },
];
for (const profile of profiles) {
  for (const job of cases) {
    if (process.env.MELDIQ_MEDIA_SCENARIO && job.name !== process.env.MELDIQ_MEDIA_SCENARIO) continue;
    if (profile.name === "constrained" && job.name === "multipart-video") continue;
    const before = [];
    const after = [];
    for (let run = 0; run < Number(process.argv[3] ?? 3); run++) {
      if (baseline && run % 2 === 0) before.push(await simulate(baseline, job.files, profile, job.messages));
      after.push(await simulate(Transfers, job.files, profile, job.messages));
      if (baseline && run % 2 !== 0) before.push(await simulate(baseline, job.files, profile, job.messages));
    }
    const stats = (runs: typeof after) => {
      const sorted = runs.sort((a, b) => a.ms - b.ms);
      return { samplesMs: sorted.map((run) => run.ms), median: sorted[Math.floor(sorted.length / 2)] };
    };
    console.log(JSON.stringify({ profile: profile.name, scenario: job.name, ...(baseline ? { before: stats(before) } : {}), after: stats(after) }));
  }
}
