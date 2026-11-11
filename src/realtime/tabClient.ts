import type { ClientFrame, Frame } from "./frames";
import { RealtimeClient, type ConnectionState, type RealtimeOptions } from "./socket";

type Event =
  | { kind: "join" }
  | { kind: "state"; owner: string; state: ConnectionState }
  | { kind: "frame"; frame: Frame }
  | { kind: "send"; frame: ClientFrame }
  | { kind: "reconnect" }
  | { kind: "attention"; id: string; focused: boolean; conversationId: string | null }
  | { kind: "leave"; owner: string };

/** All tabs can work; only the socket and delivery acknowledgements have a single owner per account/device. */
export class TabRealtimeClient {
  private socket: RealtimeClient | null = null;
  private channel: BroadcastChannel | null = null;
  private controller: AbortController | null = null;
  private release: (() => void) | null = null;
  private chain: Promise<void> = Promise.resolve();
  private state: ConnectionState = "offline";
  private owner: string | null = null;
  private readonly id = crypto.randomUUID();
  private generation = 0;
  private stopped = true;
  private heartbeat: ReturnType<typeof setInterval> | undefined;
  private focused = false;
  private conversationId: string | null = null;
  private readonly peers = new Map<string, { focused: boolean; conversationId: string | null; at: number }>();

  constructor(
    private readonly scope: string,
    private readonly opts: RealtimeOptions,
  ) {}

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    const generation = ++this.generation;
    // Tests/non-browser hosts and older browsers retain the ordinary direct transport.
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined" || !navigator.locks) {
      this.socket = this.connect(false);
      return;
    }
    this.channel = new BroadcastChannel(`meldiq-realtime-v1:${this.scope}`);
    this.channel.onmessage = (event: MessageEvent<Event>) => this.receive(event.data);
    this.setState("connecting");
    this.post({ kind: "join" });
    this.announceAttention();
    this.heartbeat = setInterval(() => {
      this.announceAttention();
      if (this.socket) this.post({ kind: "state", owner: this.id, state: this.state });
    }, 2000);
    const controller = new AbortController();
    this.controller = controller;
    void navigator.locks
      .request(`meldiq-realtime-v1:${this.scope}`, { signal: controller.signal }, async () => {
        if (this.stopped || generation !== this.generation) return;
        this.owner = this.id;
        const socket = this.connect(true);
        this.socket = socket;
        await new Promise<void>((resolve) => {
          this.release = resolve;
        });
        socket.stop();
      })
      .catch(() => {
        // stop() aborts a pending acquisition; it never steals a live tab's lock.
        if (!this.stopped && generation === this.generation) this.setState("offline");
      });
    window.addEventListener("pagehide", this.onPageHide);
    document.addEventListener("freeze", this.onFreeze);
  }

  stop(): void {
    if (typeof window !== "undefined") window.removeEventListener("pageshow", this.onResume);
    if (typeof document !== "undefined") document.removeEventListener("resume", this.onResume);
    if (this.stopped) return;
    this.stopped = true;
    this.generation++;
    this.post({ kind: "attention", id: this.id, focused: false, conversationId: null });
    if (this.owner === this.id) this.post({ kind: "leave", owner: this.id });
    this.socket?.stop();
    this.socket = null;
    clearInterval(this.heartbeat);
    this.controller?.abort();
    this.controller = null;
    this.release?.();
    this.release = null;
    this.channel?.close();
    this.channel = null;
    this.owner = null;
    this.peers.clear();
    if (typeof window !== "undefined") window.removeEventListener("pagehide", this.onPageHide);
    if (typeof document !== "undefined") document.removeEventListener("freeze", this.onFreeze);
    this.setState("offline");
  }

  send(frame: ClientFrame): boolean {
    if (this.stopped) return false;
    // A follower has processed the copy, but the socket owner alone acknowledges the server's delivery.
    if (this.channel && !this.socket && frame.t === "ack") return true;
    if (this.socket) return this.socket.send(frame);
    if (this.state !== "online" || frame.t !== "typing") return false;
    this.post({ kind: "send", frame });
    return true;
  }

  /** Server-accepted sends do not echo to this same device. Notify its other tabs after acceptance, never before. */
  publish(frame: Frame): void {
    this.post({ kind: "frame", frame });
  }

  attention(focused: boolean, conversationId: string | null): void {
    this.focused = focused;
    this.conversationId = conversationId;
    this.announceAttention();
  }

  /** One alert, preferably in the focused tab; none for a conversation being read in any tab. */
  canNotify(conversationId?: string): boolean {
    if (!this.channel) return true;
    const focused = [...this.peers.entries()].filter(([, peer]) => peer.focused && Date.now() - peer.at < 7000);
    if (this.focused) focused.push([this.id, { focused: true, conversationId: this.conversationId, at: Date.now() }]);
    if (conversationId && focused.some(([, peer]) => peer.conversationId === conversationId)) return false;
    const target = focused.map(([id]) => id).sort()[0] ?? this.owner;
    return target === this.id;
  }

  reconnectNow(): void {
    if (this.socket) this.socket.reconnectNow();
    else this.post({ kind: "reconnect" });
  }

  async idle(): Promise<void> {
    await this.socket?.idle();
    await this.chain;
  }

  private connect(shared: boolean): RealtimeClient {
    const socket = new RealtimeClient({
      ...this.opts,
      onFrame: async (frame) => {
        if (shared) this.publish(frame);
        await this.deliver(frame);
      },
      onState: (state) => {
        this.setState(state);
        if (shared) this.post({ kind: "state", owner: this.id, state });
      },
    });
    socket.start();
    return socket;
  }

  private deliver(frame: Frame): Promise<void> {
    this.chain = this.chain.then(() => (this.stopped ? undefined : this.opts.onFrame(frame))).catch(() => undefined);
    return this.chain;
  }

  private receive(event: Event): void {
    if (this.stopped || !event || typeof event !== "object") return;
    switch (event.kind) {
      case "join":
        this.announceAttention();
        if (this.socket) this.post({ kind: "state", owner: this.id, state: this.state });
        return;
      case "state": {
        if (this.socket || !["connecting", "online", "reconnecting", "offline"].includes(event.state)) return;
        const joined = this.owner !== event.owner || this.state !== "online";
        this.owner = event.owner;
        this.setState(event.state);
        // Joining an existing connection still refreshes this tab from the authorized server APIs.
        if (joined && event.state === "online") void this.deliver({ t: "hello" });
        return;
      }
      case "frame":
        if (event.frame && typeof event.frame.t === "string") void this.deliver(event.frame);
        return;
      case "send":
        if (event.frame?.t === "typing") this.socket?.send(event.frame);
        return;
      case "reconnect":
        this.socket?.reconnectNow();
        return;
      case "attention":
        if (typeof event.id === "string" && (event.conversationId === null || typeof event.conversationId === "string"))
          this.peers.set(event.id, { focused: event.focused === true, conversationId: event.conversationId, at: Date.now() });
        return;
      case "leave":
        if (!this.socket && this.owner === event.owner) this.setState("reconnecting");
    }
  }

  private post(event: Event): void {
    this.channel?.postMessage(event);
  }
  private announceAttention(): void {
    for (const [id, peer] of this.peers) if (Date.now() - peer.at >= 7000) this.peers.delete(id);
    this.post({ kind: "attention", id: this.id, focused: this.focused, conversationId: this.conversationId });
  }
  private setState(state: ConnectionState): void {
    if (this.state === state) return;
    this.state = state;
    this.opts.onState(state);
  }
  private readonly onPageHide = (event: PageTransitionEvent) => {
    this.stop();
    if (event.persisted) window.addEventListener("pageshow", this.onResume, { once: true });
  };
  private readonly onFreeze = () => {
    this.stop();
    document.addEventListener("resume", this.onResume, { once: true });
  };
  private readonly onResume = () => this.start();
}
