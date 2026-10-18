import type { z } from "zod";

/** A refusal or failure from the server, or a network failure (status 0). Never carries request bodies or tokens. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get isNetwork(): boolean {
    return this.status === 0;
  }

  /** Worth retrying later: offline, overloaded or rate-limited. */
  get isTransient(): boolean {
    return this.status === 0 || this.status === 429 || this.status >= 500;
  }
}

/** Where the bearer token comes from, and how to get a new one when the server says it's no longer valid. */
export interface Credentials {
  token(): string | null;
  /** Signs a fresh challenge with the device key. Resolves false when that's impossible (signed out, device removed). */
  reauthenticate(): Promise<boolean>;
}

interface RequestOptions {
  body?: unknown;
  raw?: Uint8Array;
  auth?: boolean;
  signal?: AbortSignal;
}

/**
 * Typed client for the Orbit API. Same origin in the browser (base ""), an absolute base in tests. Bearer token only:
 * cookies are never sent. A 401 triggers one re-authentication and one retry.
 */
export class ApiClient {
  constructor(
    readonly base: string,
    private readonly credentials?: Credentials,
  ) {}

  async json<S extends z.ZodTypeAny>(method: string, path: string, schema: S, opts: RequestOptions = {}): Promise<z.infer<S>> {
    const res = await this.send(method, path, opts);
    const data: unknown = await res.json().catch(() => {
      throw new ApiError(res.status, "decode", "The server's answer couldn't be read");
    });
    const parsed = schema.safeParse(data);
    if (!parsed.success) throw new ApiError(res.status, "decode", "The server's answer wasn't what this app expects");
    return parsed.data;
  }

  /** For endpoints whose answer this client doesn't need. */
  async call(method: string, path: string, opts: RequestOptions = {}): Promise<void> {
    const res = await this.send(method, path, opts);
    await res.body?.cancel().catch(() => undefined);
  }

  async bytes(path: string, opts: RequestOptions = {}): Promise<Uint8Array> {
    const res = await this.send("GET", path, opts);
    return new Uint8Array(await res.arrayBuffer());
  }

  private async send(method: string, path: string, opts: RequestOptions, retried = false): Promise<Response> {
    const auth = opts.auth ?? true;
    const headers: Record<string, string> = { accept: "application/json" };
    const token = auth ? this.credentials?.token() : null;
    if (auth && token) headers.authorization = `Bearer ${token}`;
    let body: BodyInit | undefined;
    if (opts.raw) {
      headers["content-type"] = "application/octet-stream";
      body = new Uint8Array(opts.raw);
    } else if (opts.body !== undefined) {
      headers["content-type"] = "application/json";
      body = JSON.stringify(opts.body);
    }
    let res: Response;
    try {
      res = await fetch(this.base + path, { method, headers, body, credentials: "omit", cache: "no-store", signal: opts.signal });
    } catch (e) {
      if (opts.signal?.aborted) throw e;
      throw new ApiError(0, "network", "Can't reach the server. Check your connection.");
    }
    if (res.status === 401 && auth && !retried && this.credentials && (await this.credentials.reauthenticate())) {
      await res.body?.cancel().catch(() => undefined);
      return this.send(method, path, opts, true);
    }
    if (!res.ok) throw await toApiError(res);
    return res;
  }
}

async function toApiError(res: Response): Promise<ApiError> {
  const retryAfter = Number(res.headers.get("retry-after"));
  const retryAfterMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : undefined;
  try {
    const data = (await res.json()) as { error?: { code?: unknown; message?: unknown; details?: unknown } };
    const e = data?.error;
    if (e && typeof e.code === "string" && typeof e.message === "string") return new ApiError(res.status, e.code, e.message, e.details, retryAfterMs);
  } catch {
    /* not JSON: a proxy's error page */
  }
  return new ApiError(
    res.status,
    res.status >= 500 ? "server" : "http",
    res.status >= 500 ? "The server had a problem. Try again in a moment." : `Request failed (${res.status})`,
    undefined,
    retryAfterMs,
  );
}
