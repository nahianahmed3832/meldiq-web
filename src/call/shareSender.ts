import { type LocalParticipant, Track } from "livekit-client";
import { CALL_VIDEO, cameraResolution, displayConstraints, type ShareStats, type VideoQualityMode, type VideoTier } from "./shareQuality";
import { VideoSender } from "./videoSender";

export class ShareSender {
  private tier: VideoTier = "720p60";
  private readonly sender = new VideoSender(this.tier, "auto");

  constructor(
    private readonly participant: () => LocalParticipant | null,
    private readonly report: (stats: ShareStats | null) => void,
  ) {}

  async start(audio: boolean): Promise<void> {
    const local = this.participant();
    if (!local) return;
    const { maxBitrate, frameRate } = CALL_VIDEO[this.tier];
    const safari = isSafari();
    await local.setScreenShareEnabled(
      true,
      {
        audio,
        // The SDK forwards dimensions and capture frame rate through resolution.
        ...(safari ? {} : { resolution: cameraResolution(this.tier) }),
        contentHint: "motion",
        systemAudio: audio ? "include" : "exclude",
      },
      {
        screenShareEncoding: { maxBitrate, maxFramerate: frameRate, priority: "medium" },
        videoCodec: "vp8",
        backupCodec: false,
        simulcast: false,
      },
    );
    const track = this.track();
    // Apply the upper limit after selection, including on Safari builds with uncapped picker capture.
    if (track) await track.mediaStreamTrack.applyConstraints(displayConstraints(this.tier, safari)).catch(() => undefined);
    await this.sender.attach(track);
  }

  async stop(): Promise<void> {
    await this.sender.attach(null);
    this.report(null);
    await this.participant()?.setScreenShareEnabled(false);
  }

  async configure(tier: VideoTier, mode: VideoQualityMode): Promise<void> {
    const track = this.track();
    const changedTier = this.tier !== tier;
    this.tier = tier;
    this.sender.configure(tier, mode);
    if (track && changedTier) await track.mediaStreamTrack.applyConstraints(displayConstraints(tier, isSafari())).catch(() => undefined);
    await this.sender.attach(track);
  }

  async sample(now: number, networkLimited: boolean): Promise<void> {
    const track = this.track();
    if (!track) return;
    await this.sender.attach(track);
    const sent = await this.sender.sample(now, networkLimited);
    if (track === this.track()) this.report({ tier: this.tier, sent });
  }

  private track() {
    return this.participant()?.getTrackPublication(Track.Source.ScreenShare)?.videoTrack ?? null;
  }
}

const isSafari = (): boolean => typeof navigator !== "undefined" && /^((?!chrome|chromium|crios|fxios|android).)*safari/i.test(navigator.userAgent);
