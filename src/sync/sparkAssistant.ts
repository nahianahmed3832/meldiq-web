import { z } from "zod";
import type { ApiClient } from "../api/client";

const root = "/v2/me/spark";
const item = z.object({ id: z.string().uuid(), title: z.string(), updatedAt: z.number() });
const full = item.extend({
  turns: z.array(z.object({ requestId: z.string().uuid(), user: z.string(), assistant: z.string(), at: z.number() })).max(30),
});
const answer = z.object({ thread: full });
export type SparkThread = z.infer<typeof full>;
export type SparkSummary = z.infer<typeof item>;
const path = (id: string) => `${root}/threads/${encodeURIComponent(id)}`;
export const sparkInfo = (api: ApiClient) =>
  api.json(
    "GET",
    root,
    z.object({
      configured: z.boolean(),
      historyAvailable: z.boolean(),
      threads: z.array(item).max(30),
    }),
  );
export const sparkOpen = async (api: ApiClient, id: string, signal?: AbortSignal) => (await api.json("GET", path(id), answer, { signal })).thread;
export const sparkCreate = async (api: ApiClient, id: string, title: string) => (await api.json("POST", `${root}/threads`, answer, { body: { id, title } })).thread;
export const sparkRename = async (api: ApiClient, id: string, title: string) => (await api.json("PATCH", path(id), answer, { body: { title } })).thread;
export const sparkDelete = (api: ApiClient, id: string) => api.call("DELETE", path(id));

const packet = z.discriminatedUnion("type", [
  z.object({ type: z.literal("delta"), text: z.string().min(1).max(8000) }),
  z.object({ type: z.literal("done") }),
  z.object({ type: z.literal("error"), code: z.string() }),
]);

class SparkStreamError extends Error {
  constructor(readonly kind: "invalid" | "incomplete" | "limit" | "provider") {
    super(kind);
  }
}

export async function streamSpark(
  api: ApiClient,
  id: string,
  body: { requestId: string; prompt: string; consent: true; locale: string },
  signal: AbortSignal,
  onText: (value: string) => void,
): Promise<void> {
  const res = await api.postStream(`${path(id)}/turns`, { body, signal, headers: { accept: "application/x-ndjson" } });
  if (!res.body || res.headers.get("content-type")?.split(";")[0] !== "application/x-ndjson") {
    await res.body?.cancel().catch(() => undefined);
    throw new SparkStreamError("invalid");
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let buffer = "",
    bytes = 0,
    answer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) throw new SparkStreamError("incomplete");
      bytes += value.byteLength;
      if (bytes > 512 * 1024) throw new SparkStreamError("limit");
      buffer += decoder.decode(value, { stream: true });
      let boundary: number;
      while ((boundary = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 1);
        const p = packet.parse(JSON.parse(line));
        if (p.type === "done") return;
        if (p.type === "error") throw new SparkStreamError("provider");
        answer += p.text;
        if (answer.length > 8000) throw new SparkStreamError("limit");
        onText(answer);
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
