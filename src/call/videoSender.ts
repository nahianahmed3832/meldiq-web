import type { LocalVideoTrack } from "livekit-client";
import { encodingFor, type Limitation, sentVideo, VideoAdapter, videoLadder, type VideoQualityMode, type VideoTier } from "./shareQuality";

export class VideoSender {
  private adapter: VideoAdapter;
  private track: LocalVideoTrack | null = null;
  private writing: Promise<void> = Promise.resolve();

  constructor(
    private tier: VideoTier,
    private mode: VideoQualityMode,
  ) {
    this.adapter = new VideoAdapter(videoLadder(tier, mode));
  }

  configure(tier: VideoTier, mode: VideoQualityMode): void {
    if (this.tier === tier && this.mode === mode) return;
    this.tier = tier;
    this.mode = mode;
    this.adapter = new VideoAdapter(videoLadder(tier, mode));
  }

  async attach(track: LocalVideoTrack | null): Promise<void> {
    if (track !== this.track) {
      this.track = track;
      this.adapter = new VideoAdapter(videoLadder(this.tier, this.mode));
    }
    await this.apply();
  }

  async sample(now: number, networkLimited: boolean) {
    const track = this.track;
    const adapter = this.adapter;
    if (!track || track.isMuted) return null;
    const report = await track.getRTCStatsReport().catch(() => undefined);
    if (track !== this.track || adapter !== this.adapter) return null;
    const sent = report ? sentVideo(report.values() as Iterable<{ type: string }>) : null;
    const limitation: Limitation = networkLimited ? "bandwidth" : (sent?.limitation ?? "other");
    adapter.sample(limitation, now);
    await this.apply();
    return sent?.width ? { width: sent.width, height: sent.height, fps: sent.fps } : null;
  }

  private apply(): Promise<void> {
    // Read the current track and settings inside the queue, after any previous setParameters call.
    this.writing = this.writing.then(async () => {
      const track = this.track;
      const sender = track?.sender;
      if (!track || !sender || track.isMuted) return;
      const { width = 0, height = 0 } = track.mediaStreamTrack.getSettings();
      const want = encodingFor(this.adapter.current, width, height);
      const params = sender.getParameters();
      const encoding = params.encodings?.[0];
      if (!encoding) return;
      if (encoding.maxBitrate === want.maxBitrate && encoding.maxFramerate === want.maxFramerate && (encoding.scaleResolutionDownBy ?? 1) === want.scaleResolutionDownBy) return;
      params.encodings[0] = { ...encoding, ...want };
      // The browser can temporarily reject parameters during a device switch or reconnect. The next sample reapplies them.
      await sender.setParameters(params).catch(() => undefined);
    });
    return this.writing;
  }
}
