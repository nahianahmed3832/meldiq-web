import { afterEach, describe, expect, it, vi } from "vitest";
import { attachmentResponse, downloadCiphertext, resetAttachmentRoute } from "../src/sync/attachments";
import { ApiError } from "../src/api/client";
import type { Engine } from "../src/sync/engine";
const engine = (response: (path: string, opts?: unknown) => Promise<Response>) => ({ api: { response }, state: { get: () => ({ server: { features: [] } }) } }) as unknown as Engine;
afterEach(() => {
  vi.useRealTimers();
  resetAttachmentRoute();
});
describe("bounded resumable downloads", () => {
  it("refuses an oversized stream before retaining its extra bytes", async () => {
    const api = vi.fn(async () => new Response("too many bytes"));
    await expect(downloadCiphertext(engine(api), "file", 3, () => {})).rejects.toThrow(/larger/);
    expect(api).toHaveBeenCalledOnce();
  });
  it("validates the server's Content-Range before appending a resumed response", async () => {
    vi.useFakeTimers();
    let reads = 0;
    const broken = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (reads++ === 0) controller.enqueue(new TextEncoder().encode("ab"));
        else controller.error(new Error("disconnected"));
      },
    });
    const api = vi
      .fn()
      .mockResolvedValueOnce(new Response(broken))
      .mockResolvedValueOnce(new Response("cd", { status: 206, headers: { "content-range": "bytes 0-1/4" } }));
    const request = downloadCiphertext(engine(api), "file", 4, () => {});
    const failed = expect(request).rejects.toThrow(/invalid download range/);
    await vi.runAllTimersAsync();
    await failed;
    expect(api.mock.calls[1][1]).toMatchObject({ headers: { range: "bytes=2-" } });
  });
  it("tries direct delivery first, then remembers an authorized proxy only for the affected account engine", async () => {
    const response = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(0, "network", "CORS"))
      .mockResolvedValue(new Response("ciphertext"));
    const proxied = { api: { response }, state: { get: () => ({ server: { features: ["attachment-proxy"] } }) } } as unknown as Engine;
    await attachmentResponse(proxied, "one");
    await attachmentResponse(proxied, "two");
    expect(response.mock.calls.map((c) => c[0])).toEqual(["/v1/attachments/one", "/v1/attachments/one?proxy=1", "/v1/attachments/two?proxy=1"]);
    const independent = vi.fn(async (_path: string) => new Response("ciphertext"));
    await attachmentResponse(engine(independent), "three");
    expect(independent.mock.calls[0][0]).toBe("/v1/attachments/three");
  });
  it("cancellation prevents any download request", async () => {
    const api = vi.fn();
    const abort = new AbortController();
    abort.abort();
    await expect(downloadCiphertext(engine(api), "file", 4, () => {}, abort.signal)).rejects.toThrow();
    expect(api).not.toHaveBeenCalled();
  });
});
