import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/client";
import type { Engine } from "../src/sync/engine";
import { sendBody, type PreparedFile, type UploadCheckpoint, UploadCancelled, uploadPrepared } from "../src/sync/largeUpload";
import { sha256, toB64 } from "../src/crypto/bytes";

const signed = { method: "PUT", url: "https://storage.test/part", headers: {}, expiresAt: 9999999999999 };
const prepared: PreparedFile = {
  name: "original.bin",
  type: "application/octet-stream",
  size: 12,
  rawKey: new Uint8Array(32),
  nonce: new Uint8Array(12),
  ciphertext: new Blob(["abcdefghijkl"]),
  sha256: "whole-hash",
};
function fake() {
  const hashes = new Map<number, string>();
  const stored = new Map<number, { n: number; size: number; etag: string; sha256: string }>();
  const json = vi.fn(async (_method: string, path: string, _schema: unknown, opts?: { body?: { parts?: { n: number; size: number; sha256: string }[] } }) => {
    if (path === "/v1/attachments/uploads") return { mode: "multipart", uploadId: "upload", partSize: 4, partCount: 3, expiresAt: 9999999999999 };
    if (path.endsWith("/complete")) return { id: "ready", size: 12, expiresAt: 9999999999999 };
    if (_method === "GET") return { parts: [...stored.values()] };
    const parts = opts!.body!.parts!;
    for (const part of parts) hashes.set(part.n, part.sha256);
    return { parts: parts.map((p) => ({ n: p.n, upload: { ...signed, url: `https://storage.test/${p.n}` } })) };
  });
  const api = { json, call: vi.fn(async () => undefined) };
  const engine = { api, state: { get: () => ({ server: { attachmentMaxBytes: 9999 } }) } } as unknown as Engine;
  const send = vi.fn(async (req: { url: string; body: Blob }, progress: (n: number) => void) => {
    const n = Number(req.url.split("/").pop());
    stored.set(n, { n, size: req.body.size, etag: `etag-${n}`, sha256: hashes.get(n)! });
    progress(req.body.size);
    return "";
  });
  return { engine, api, send, stored };
}
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("upload recovery", () => {
  it("does not send an already-cancelled body", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const abort = new AbortController();
    abort.abort();
    await expect(sendBody({ ...signed, body: new Blob(["bytes"]) }, () => {}, abort.signal)).rejects.toBeInstanceOf(UploadCancelled);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("keeps multipart progress after interruption and never falls back to re-uploading the whole object", async () => {
    const { engine, api } = fake();
    const checkpoints: UploadCheckpoint[] = [];
    await expect(
      uploadPrepared(engine, "conversation", prepared, {
        send: async () => {
          throw new ApiError(403, "upload_failed", "link expired");
        },
        signal: AbortSignal.timeout(40),
        onCheckpoint: (checkpoint) => {
          checkpoints.push(checkpoint);
        },
      }),
    ).rejects.toThrow();
    expect(checkpoints[0]).toMatchObject({ uploadId: "upload", mode: "multipart" });
    expect(api.call).not.toHaveBeenCalled();
    expect(api.json.mock.calls.some((c) => c[1].startsWith("/v1/attachments?"))).toBe(false);
  });
  it("resumes only parts whose size AND checksum match, and persists completion before finalizing", async () => {
    const { engine, send, stored } = fake();
    stored.set(1, { n: 1, size: 4, etag: "e1", sha256: toB64(await sha256(new TextEncoder().encode("abcd"))) });
    stored.set(2, { n: 2, size: 4, etag: "wrong", sha256: "wrong hash" });
    let checkpoint: UploadCheckpoint | undefined;
    const id = await uploadPrepared(engine, "conversation", prepared, {
      checkpoint: { route: "direct", uploadId: "upload", mode: "multipart", partSize: 4 },
      send,
      onCheckpoint: async (c) => {
        checkpoint = structuredClone(c);
      },
    });
    expect(id).toBe("ready");
    expect(send.mock.calls.map((c) => c[0].url).sort()).toEqual(["https://storage.test/2", "https://storage.test/3"]);
    expect(checkpoint?.parts).toHaveLength(3);
    send.mockClear();
    expect(await uploadPrepared(engine, "conversation", prepared, { checkpoint, send })).toBe("ready");
    expect(send).not.toHaveBeenCalled();
  });
  it("refreshes an expired single PUT and treats a lost successful PUT as completion", async () => {
    vi.useFakeTimers();
    const json = vi.fn(async (_method: string, path: string) =>
      path === "/v1/attachments/uploads" ? { mode: "single", uploadId: "one", upload: signed } : path.endsWith("/url") ? { upload: signed } : { id: "one", size: 12, expiresAt: 1 },
    );
    const engine = { api: { json, call: vi.fn() } } as unknown as Engine;
    const send = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(403, "upload_failed", "expired"))
      .mockRejectedValueOnce(new ApiError(412, "upload_failed", "already uploaded"));
    const result = uploadPrepared(engine, "c", prepared, { send });
    await vi.runAllTimersAsync();
    expect(await result).toBe("one");
    expect(json.mock.calls.some((c) => c[1].endsWith("/url"))).toBe(true);
    expect(send).toHaveBeenCalledTimes(2);
  });
});
