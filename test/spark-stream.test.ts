import { expect, it, vi } from "vitest";
import { ApiClient } from "../src/api/client";
import { streamSpark } from "../src/sync/sparkAssistant";

it("decodes split UTF-8 frames and distinguishes a complete reply from a broken stream", async () => {
  const id = "d2f867ca-c902-49f9-8575-74c136524e88";
  const body = { requestId: id, prompt: "Help", consent: true as const, locale: "bn" };
  const signal = new AbortController().signal;
  const api = new ApiClient("https://test.invalid", { token: () => "test-access-token", reauthenticate: async () => false });
  let complete = true;
  const fetch = vi.fn(async (_url: string, _init?: RequestInit) => {
    const raw = new TextEncoder().encode('{"type":"delta","text":"হ্যালো"}\n{"type":"delta","text":"!"}\n' + (complete ? '{"type":"done"}\n' : ""));
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < raw.length; i += 2) controller.enqueue(raw.slice(i, i + 2));
        controller.close();
      },
    });
    return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8" } });
  });
  vi.stubGlobal("fetch", fetch);
  try {
    const onText = vi.fn();
    await streamSpark(api, id, body, signal, onText);
    expect(onText.mock.calls).toEqual([["হ্যালো"], ["হ্যালো!"]]);
    expect(fetch).toHaveBeenCalledWith(
      `https://test.invalid/v2/me/spark/threads/${id}/turns`,
      expect.objectContaining({
        method: "POST",
        credentials: "omit",
        signal,
        body: JSON.stringify(body),
        headers: expect.objectContaining({ authorization: "Bearer test-access-token" }),
      }),
    );
    complete = false;
    await expect(streamSpark(api, id, body, signal, () => {})).rejects.toMatchObject({ kind: "incomplete" });
  } finally {
    vi.unstubAllGlobals();
  }
});
