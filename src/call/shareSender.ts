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
    const tracks = await local.createScreenTracks({
      audio,
      // Safari can capture at low resolution if the picker is passed size constraints.
      ...(isSafari() ? {} : { resolution: cameraResolution(this.tier) }),
      contentHint: "motion",
      systemAudio: audio ? "include" : "exclude",
    });
    try {
      const video = tracks.find((track) => track.source === Track.Source.ScreenShare);
      if (video) await capCapture(video.mediaStreamTrack, this.tier);
      if (local !== this.participant()) {
        tracks.forEach((track) => track.stop());
        return;
      }
      for (const track of tracks) {
        await local.publishTrack(track, {
          screenShareEncoding: { maxBitrate, maxFramerate: frameRate, priority: "medium" },
          videoCodec: "vp8",
          backupCodec: false,
          simulcast: false,
        });
      }
    } catch (error) {
      tracks.forEach((track) => track.stop());
      await Promise.allSettled(tracks.map((track) => local.unpublishTrack(track)));
      throw error;
    }
    await this.sender.attach(this.track());
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
    if (track && changedTier) await capCapture(track.mediaStreamTrack, tier);
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

async function capCapture(track: MediaStreamTrack, tier: VideoTier): Promise<void> {
  const before = track.getSettings();
  const portrait = (before.height ?? 0) > (before.width ?? 0);
  await track.applyConstraints(displayConstraints(tier, portrait)).catch(() => undefined);
  const { width = 0, height = 0, frameRate = 0 } = track.getSettings();
  const cap = CALL_VIDEO[tier];
  if (Math.max(width, height) > cap.width || Math.min(width, height) > cap.height || frameRate > cap.frameRate) {
    throw new DOMException("The display capture exceeds the plan limit.", "OverconstrainedError");
  }
}

const isSafari = (): boolean => typeof navigator !== "undefined" && /^((?!chrome|chromium|crios|fxios|android).)*safari/i.test(navigator.userAgent);
