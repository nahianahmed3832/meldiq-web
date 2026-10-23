import { type LocalParticipant, type LocalTrackPublication, type ScreenShareCaptureOptions, Track } from "livekit-client";
import { displayConstraints, encodingFor, SHARE_LADDERS, SHARE_QUALITIES, ShareAdapter, type ShareQuality, type ShareStats, sentVideo } from "./shareQuality";
import type { ShareOptions } from "./types";

/**
 * This browser's screen share (2026-10-24): captured and encoded at the chosen quality, then stepped down and back up
 * with the sender's stats ([ShareAdapter]). The capture asks getDisplayMedia for the mode's size and rate directly
 * (livekit-client's own `resolution` option only sets an ideal size), and the encoding is passed as
 * `screenShareEncoding`: for a screen share livekit-client ignores `videoEncoding` and used its default, 1080p at
 * 15 frames a second, whatever was captured — why shares looked like 720p30 at best before.
 */
export class ShareSender {
  quality: ShareQuality | null = null;
  private adapter: ShareAdapter | null = null;

  constructor(
    private readonly participant: () => LocalParticipant | null,
    private readonly report: (stats: ShareStats | null) => void,
  ) {}

  async start(opts: ShareOptions): Promise<void> {
    const local = this.participant();
    if (!local) return;
    const q = SHARE_QUALITIES[opts.quality];
    const adapter = new ShareAdapter(SHARE_LADDERS[opts.quality]);
    const top = adapter.current;
    await local.setScreenShareEnabled(
      true,
      {
        audio: opts.audio,
        // Constraints as they are (no `resolution`, which would replace them): see displayConstraints.
        video: displayConstraints(opts.quality, isSafari()) as ScreenShareCaptureOptions["video"],
        contentHint: q.contentHint,
        systemAudio: opts.audio ? "include" : "exclude",
      },
      {
        screenShareEncoding: { maxBitrate: top.maxBitrate, maxFramerate: top.frameRate, priority: "medium" },
        videoCodec: "vp8",
        backupCodec: false,
        simulcast: false,
        degradationPreference: "balanced",
      },
    );
    this.quality = opts.quality;
    this.adapter = adapter;
    await this.apply();
  }

  async stop(): Promise<void> {
    this.quality = null;
    this.adapter = null;
    this.report(null);
    await this.participant()?.setScreenShareEnabled(false);
  }

  /** Switches a running share to [quality]: new capture constraints and a fresh ladder from its top. */
  async setQuality(quality: ShareQuality): Promise<void> {
    const track = this.track();
    if (!track) return;
    this.quality = quality;
    this.adapter = new ShareAdapter(SHARE_LADDERS[quality]);
    track.mediaStreamTrack.contentHint = SHARE_QUALITIES[quality].contentHint;
    await track.mediaStreamTrack.applyConstraints(displayConstraints(quality, isSafari())).catch(() => undefined);
    await this.apply();
  }

  /** One stats sample (every two seconds): adapts the level, keeps it applied, and reports what's captured and sent. */
  async sample(now: number): Promise<void> {
    const track = this.track();
    const adapter = this.adapter;
    if (!track || !adapter || !this.quality) return;
    const report = await track.getRTCStatsReport().catch(() => undefined);
    const sent = report ? sentVideo([...report.values()] as { type: string }[]) : null;
    if (sent && sent.width > 0) adapter.sample(sent.limitation, now);
    // Also undoes livekit-client restoring its own encoding (Firefox re-enabling a layer).
    await this.apply();
    const settings = track.mediaStreamTrack.getSettings();
    this.report({
      quality: this.quality,
      captured: settings.width && settings.height ? { width: settings.width, height: settings.height, frameRate: settings.frameRate ?? null } : null,
      sent: sent && sent.width > 0 ? { width: sent.width, height: sent.height, fps: sent.fps } : null,
      level: adapter.level,
      limitation: sent?.limitation ?? "none",
    });
  }

  private track() {
    const pub = this.participant()?.getTrackPublication(Track.Source.ScreenShare) as LocalTrackPublication | undefined;
    return pub?.videoTrack ?? null;
  }

  /** Sets the sender's encoding to the adapter's level when it isn't already. */
  private async apply(): Promise<void> {
    const track = this.track();
    const sender = track?.sender;
    if (!track || !sender || !this.adapter) return;
    const want = encodingFor(this.adapter.current, track.mediaStreamTrack.getSettings().height ?? 0);
    const params = sender.getParameters();
    const e = params.encodings?.[0];
    if (!e || (e.maxBitrate === want.maxBitrate && e.maxFramerate === want.maxFramerate && (e.scaleResolutionDownBy ?? 1) === want.scaleResolutionDownBy)) return;
    params.encodings[0] = { ...e, ...want };
    await sender.setParameters(params).catch(() => undefined);
  }
}

/** Safari (not Chrome or another browser on iOS or Android that names Safari in its user agent). */
const isSafari = (): boolean => typeof navigator !== "undefined" && /^((?!chrome|chromium|crios|fxios|android).)*safari/i.test(navigator.userAgent);
