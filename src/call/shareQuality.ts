import { text as uiText } from "../i18n";
import { formatNumber } from "../i18n/format";

export type VideoQualityMode = "auto" | "plan";
export type VideoTier = "720p60" | "1080p60";

export const CALL_VIDEO = {
  "720p60": { width: 1280, height: 720, frameRate: 60, maxBitrate: 3500000 },
  "1080p60": { width: 1920, height: 1080, frameRate: 60, maxBitrate: 6000000 },
} as const;

export function videoTier(plan: string | null | undefined): VideoTier {
  return plan === "plus" ? "1080p60" : "720p60";
}

export function videoTierLabel(tier: VideoTier): string {
  const { height, frameRate } = CALL_VIDEO[tier];
  return uiText("calls.videoQuality.format", { height: formatNumber(height, { useGrouping: false }), fps: frameRate });
}

export const videoModeOf = (saved: unknown): VideoQualityMode => (saved === "plan" ? "plan" : "auto");

export function cameraResolution(tier: VideoTier) {
  const { width, height, frameRate } = CALL_VIDEO[tier];
  return { width, height, frameRate };
}

export function displayConstraints(tier: VideoTier, portrait = false): MediaTrackConstraints {
  const { width, height, frameRate } = CALL_VIDEO[tier];
  const dimension = (size: number) => ({ ideal: size, max: size });
  return { width: dimension(portrait ? height : width), height: dimension(portrait ? width : height), frameRate: dimension(frameRate) };
}

export interface VideoLevel {
  width: number;
  height: number;
  frameRate: number;
  maxBitrate: number;
}

export function videoLadder(tier: VideoTier, mode: VideoQualityMode): readonly VideoLevel[] {
  const top = CALL_VIDEO[tier];
  if (mode === "plan") return [top];
  return [
    top,
    { ...top, frameRate: 30, maxBitrate: tier === "1080p60" ? 4000000 : 2500000 },
    ...(tier === "1080p60" ? [{ width: 1280, height: 720, frameRate: 30, maxBitrate: 2500000 }] : []),
    { width: 854, height: 480, frameRate: 24, maxBitrate: 1150000 },
    { width: 640, height: 360, frameRate: 15, maxBitrate: 550000 },
  ];
}

export function encodingFor(level: VideoLevel, width: number, height: number) {
  const scale = Math.max(1, Math.max(width, height) / level.width, Math.min(width, height) / level.height);
  return { maxBitrate: level.maxBitrate, maxFramerate: level.frameRate, scaleResolutionDownBy: Math.ceil(scale * 1000) / 1000 };
}

export interface ShareStats {
  tier: VideoTier;
  /** Measured sender output, available after the first stats sample. */
  sent: { width: number; height: number; fps: number } | null;
}

/** Why the browser's encoder is holding back (WebRTC `qualityLimitationReason`). */
export type Limitation = "none" | "bandwidth" | "cpu" | "other";
/** Two seconds between stats samples (livekitSession FLOW_SAMPLE_MS). */
const DOWN_AFTER_SAMPLES = 3;
const UP_AFTER_SAMPLES = 10;
const MIN_GAP_MS = 8000;
/** Going back up waits this long at first; an upgrade that has to come down again soon doubles it (up to the cap). */
const UP_WAIT_MS = 20000;
const UP_WAIT_MAX_MS = 160000;
const FAILED_UPGRADE_MS = 30000;
/**
 * Steps the video down its ladder when the encoder reports it's limited by bandwidth or CPU for a few samples in a row,
 * and back up only after a long clean stretch; an upgrade that fails again soon makes the next one wait longer, so the
 * quality doesn't flap. Audio isn't touched: under pressure the video gives way first.
 */
export class VideoAdapter {
  level = 0;
  private bad = 0;
  private good = 0;
  private changedAt = Number.NEGATIVE_INFINITY;
  private upgradedAt = Number.NEGATIVE_INFINITY;
  private upWaitMs = UP_WAIT_MS;
  constructor(readonly ladder: readonly VideoLevel[]) {}
  get current(): VideoLevel {
    return this.ladder[this.level];
  }
  /** Feeds one stats sample; returns the new level when it changed, else null. */
  sample(limitation: Limitation, now: number): number | null {
    if (limitation === "bandwidth" || limitation === "cpu") {
      this.bad++;
      this.good = 0;
    } else if (limitation === "none") {
      this.good++;
      this.bad = 0;
    } else {
      this.bad = 0;
      this.good = 0;
    }
    if (this.bad >= DOWN_AFTER_SAMPLES && this.level < this.ladder.length - 1 && now - this.changedAt >= MIN_GAP_MS) {
      if (now - this.upgradedAt < FAILED_UPGRADE_MS) this.upWaitMs = Math.min(UP_WAIT_MAX_MS, this.upWaitMs * 2);
      return this.move(this.level + 1, now);
    }
    if (this.good >= UP_AFTER_SAMPLES && this.level > 0 && now - this.changedAt >= this.upWaitMs) {
      this.upgradedAt = now;
      return this.move(this.level - 1, now);
    }
    return null;
  }
  private move(level: number, now: number): number {
    this.level = level;
    this.changedAt = now;
    this.bad = 0;
    this.good = 0;
    return level;
  }
}
type Stat = Record<string, unknown> & {
  type: string;
};
/** The video sender's numbers from a stats report: the outbound RTP stream with the largest frame. */
export function sentVideo(stats: Iterable<Stat>): {
  width: number;
  height: number;
  fps: number;
  limitation: Limitation;
} | null {
  let best: {
    width: number;
    height: number;
    fps: number;
    limitation: Limitation;
  } | null = null;
  for (const s of stats) {
    if (s.type !== "outbound-rtp" || (s.kind !== "video" && s.mediaType !== "video")) continue;
    const width = typeof s.frameWidth === "number" ? s.frameWidth : 0;
    const height = typeof s.frameHeight === "number" ? s.frameHeight : 0;
    if (best && width * height <= best.width * best.height) continue;
    const fps = typeof s.framesPerSecond === "number" ? s.framesPerSecond : 0;
    best = { width, height, fps: Math.round(fps), limitation: limitationOf(s.qualityLimitationReason) };
  }
  return best;
}
/** The received video's numbers from a stats report (a viewer's inbound RTP stream). */
export function receivedVideo(stats: Iterable<Stat>): {
  width: number;
  height: number;
  fps: number;
} | null {
  for (const s of stats) {
    if (s.type !== "inbound-rtp" || (s.kind !== "video" && s.mediaType !== "video")) continue;
    const width = typeof s.frameWidth === "number" ? s.frameWidth : 0;
    const height = typeof s.frameHeight === "number" ? s.frameHeight : 0;
    if (!width || !height) continue;
    return { width, height, fps: Math.round(typeof s.framesPerSecond === "number" ? s.framesPerSecond : 0) };
  }
  return null;
}
function limitationOf(v: unknown): Limitation {
  return v === "bandwidth" || v === "cpu" || v === "none" ? v : v === undefined ? "none" : "other";
}
