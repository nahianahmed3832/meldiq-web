/**
 * The realtime connection (server/src/ws.ts). Browsers can't set headers on a WebSocket, so the session token goes in the
 * first frame, {t:"auth"} (docs/ORBIT_WEB_ARCHITECTURE.md › G1); it never appears in the URL.
 *
 * - Frames are handled one at a time, in arrival order, like the phone (FrameInbox + processLock): a later frame never
 *   overtakes an earlier one, so acknowledgements and message order stay correct.
 * - Reconnects with exponential backoff and full jitter (1 s up to 30 s), at once when the network comes back.
 * - An application-level ping every 25 s; no frame for 70 s means the connection is dead and is replaced.
 */

export type ConnectionState = "connecting" | "online" | "reconnecting" | "offline";

export interface Frame {
  t: string;
  [key: string]: unknown;
}

export interface RealtimeOptions {
  url: string;
  /** The current session token, or null when signed out. */
  token: () => string | null;
  /** Handles one frame; the next frame waits for it. */
  onFrame: (frame: Frame) => Promise<void>;
  onState: (state: ConnectionState) => void;
  /** The server refused the token (4401) or removed the device (4001): resolve true to try again with a new token. */
  onUnauthorized: () => Promise<boolean>;
  createSocket?: (url: string) => WebSocket;
}

const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;
const PING_MS = 25_000;
const STALE_MS = 70_000;

export class RealtimeClient {
  private ws: WebSocket | null = null;
  private stopped = true;
  private attempt = 0;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private pingTimer: ReturnType<typeof setInterval> | undefined;
  private lastFrameAt = 0;
  private chain: Promise<void> = Promise.resolve();
  private state: ConnectionState = "offline";

  constructor(private readonly opts: RealtimeOptions) {}

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.attempt = 0;
    if (typeof window !== "undefined") {
      window.addEventListener("online", this.onOnline);
      window.addEventListener("offline", this.onOffline);
    }
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    clearTimeout(this.retryTimer);
    clearInterval(this.pingTimer);
    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.onOnline);
      window.removeEventListener("offline", this.onOffline);
    }
    const ws = this.ws;
    this.ws = null;
    ws?.close(1000, "bye");
    this.setState("offline");
  }

  /** Sends a frame if the connection is open and authenticated; false otherwise (callers fall back to REST). */
  send(frame: Frame): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || this.state !== "online") return false;
    this.ws.send(JSON.stringify(frame));
    return true;
  }

  /** Drops the current connection and connects again now (after the network or the session came back). */
  reconnectNow(): void {
    if (this.stopped) return;
    clearTimeout(this.retryTimer);
    this.attempt = 0;
    const ws = this.ws;
    this.ws = null;
    ws?.close(4000, "reconnecting");
    this.connect();
  }

  /** Resolves once every frame received so far has been handled. */
  idle(): Promise<void> {
    return this.chain;
  }

  private connect(): void {
    if (this.stopped) return;
    const token = this.opts.token();
    if (!token) {
      void this.handleUnauthorized();
      return;
    }
    this.setState(this.attempt === 0 ? "connecting" : "reconnecting");
    let ws: WebSocket;
    try {
      ws = this.opts.createSocket ? this.opts.createSocket(this.opts.url) : new WebSocket(this.opts.url);
    } catch {
      this.scheduleRetry();
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      if (this.ws !== ws) return;
      ws.send(JSON.stringify({ t: "auth", token }));
      this.lastFrameAt = Date.now();
    };
    ws.onmessage = (ev: MessageEvent) => {
      if (this.ws !== ws) return;
      this.lastFrameAt = Date.now();
      const frame = parseFrame(ev.data);
      if (!frame) return;
      if (frame.t === "hello") {
        this.attempt = 0;
        this.setState("online");
        this.startHeartbeat(ws);
      }
      if (frame.t === "pong") return;
      this.chain = this.chain.then(() => this.opts.onFrame(frame)).catch(() => undefined);
    };
    ws.onclose = (ev: CloseEvent) => {
      if (this.ws !== ws) return; // a connection this client already replaced
      this.ws = null;
      clearInterval(this.pingTimer);
      if (this.stopped) return;
      if (ev.code === 4401 || ev.code === 4001) void this.handleUnauthorized();
      else this.scheduleRetry();
    };
    ws.onerror = () => {
      /* onclose follows */
    };
  }

  /**
   * A new token is needed. When it can't be had right now (offline) this keeps retrying with backoff; a device that was
   * removed is stopped by its owner (the engine), not here.
   */
  private async handleUnauthorized(): Promise<void> {
    this.setState("reconnecting");
    const again = await this.opts.onUnauthorized().catch(() => false);
    this.scheduleRetry(again);
  }

  private scheduleRetry(immediate = false): void {
    if (this.stopped) return;
    clearTimeout(this.retryTimer);
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    this.setState(offline ? "offline" : "reconnecting");
    const delay = immediate ? 0 : Math.random() * Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** this.attempt);
    this.attempt = Math.min(this.attempt + 1, 10);
    this.retryTimer = setTimeout(() => this.connect(), delay);
  }

  private startHeartbeat(ws: WebSocket): void {
    clearInterval(this.pingTimer);
    this.pingTimer = setInterval(() => {
      if (this.ws !== ws) return;
      if (Date.now() - this.lastFrameAt > STALE_MS) {
        this.ws = null;
        ws.close(4000, "stale");
        this.scheduleRetry();
        return;
      }
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: "ping" }));
    }, PING_MS);
  }

  private setState(s: ConnectionState): void {
    if (this.state === s) return;
    this.state = s;
    this.opts.onState(s);
  }

  private onOnline = (): void => this.reconnectNow();
  private onOffline = (): void => this.setState("offline");
}

function parseFrame(data: unknown): Frame | null {
  if (typeof data !== "string" || data.length > 4 * 1024 * 1024) return null;
  try {
    const f = JSON.parse(data) as unknown;
    return f && typeof f === "object" && typeof (f as Frame).t === "string" ? (f as Frame) : null;
  } catch {
    return null;
  }
}
