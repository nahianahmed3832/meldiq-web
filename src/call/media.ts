import type { CallParticipantView, DeviceIssues, MediaFactory, MediaGrant, MediaSession } from "./types";

/**
 * The browser's call media, loaded on first use: LiveKit and its encryption worker stay out of the main bundle until
 * someone calls or answers.
 */
export const liveKitMedia: MediaFactory = (events) => new DeferredSession(import("./livekitSession").then((m) => new m.LiveKitSession(events)));

class DeferredSession implements MediaSession {
  private ready: MediaSession | null = null;

  constructor(private readonly inner: Promise<MediaSession>) {
    inner.then(
      (s) => (this.ready = s),
      () => undefined,
    );
  }

  async prepare(video: boolean): Promise<DeviceIssues> {
    return (await this.inner).prepare(video);
  }

  async connect(grant: MediaGrant, key: string): Promise<void> {
    return (await this.inner).connect(grant, key);
  }

  async setMicrophone(on: boolean): Promise<void> {
    return (await this.inner).setMicrophone(on);
  }

  async setCamera(on: boolean): Promise<void> {
    return (await this.inner).setCamera(on);
  }

  participants(): CallParticipantView[] {
    return this.ready?.participants() ?? [];
  }

  remoteCount(): number {
    return this.ready?.remoteCount() ?? 0;
  }

  attachVideo(identity: string, el: HTMLVideoElement): () => void {
    return this.ready?.attachVideo(identity, el) ?? (() => undefined);
  }

  async startAudio(): Promise<void> {
    return (await this.inner).startAudio();
  }

  async disconnect(): Promise<void> {
    const s = await this.inner.catch(() => null);
    await s?.disconnect();
  }
}
