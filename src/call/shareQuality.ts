/**
 * Screen sharing quality (2026-10-24): two modes the presenter picks before or during a share, the capture constraints
 * and encoding each asks for, what the browser actually delivers, and a step-down ladder driven by the sender's WebRTC
 * stats. Pure, so it's unit-tested directly (test/share-quality.test.ts); livekitSession.ts applies it.
 */
export type ShareQuality = "standard" | "smooth" | "sharp" | "high" | "max";

/** Lowest to highest (a list of choices shows them in this order). */
export const SHARE_QUALITY_ORDER: readonly ShareQuality[] = ["standard", "smooth", "sharp", "high", "max"];

export interface ShareQualitySpec {
  width: number;
  height: number;
  frameRate: number;
  /** Encoder ceiling at the top of the ladder, bits per second. */
  maxBitrate: number;
  /** MediaStreamTrack.contentHint: sharp text and detail, or smooth motion. */
  contentHint: "detail" | "motion";
  label: string;
  hint: string;
}

export const SHARE_QUALITIES: Record<ShareQuality, ShareQualitySpec> = {
  standard: {
    width: 1280,
    height: 720,
    frameRate: 30,
    maxBitrate: 2_500_000,
    contentHint: "detail",
    label: "Standard",
    hint: "1280×720 at 30 frames a second. Works on most connections.",
  },
  // Meldiq Mojo (server docs/MOJO.md): Mojo Go shares at 720p 60 or 1080p 30; Plus at 1080p 60 or 2K 30.
  smooth: {
    width: 1280,
    height: 720,
    frameRate: 60,
    maxBitrate: 3_500_000,
    contentHint: "motion",
    label: "Smooth",
    hint: "1280×720 at 60 frames a second, for motion.",
  },
  sharp: {
    width: 1920,
    height: 1080,
    frameRate: 30,
    maxBitrate: 4_000_000,
    contentHint: "detail",
    label: "Sharp",
    hint: "1920×1080 at 30 frames a second, for text and detail.",
  },
  high: {
    width: 1920,
    height: 1080,
    frameRate: 60,
    maxBitrate: 6_000_000,
    contentHint: "motion",
    label: "High",
    hint: "1920×1080 at 60 frames a second, for games and video. Needs a fast connection and computer.",
  },
  max: {
    width: 2560,
    height: 1440,
    frameRate: 30,
    maxBitrate: 8_000_000,
    contentHint: "detail",
    label: "2K",
    hint: "2560×1440 at 30 frames a second. Needs a fast connection and computer.",
  },
};

/** A screen-share ceiling as the server sends it in a call's media grant (Meldiq Mojo). */
export interface SharePresetLimit {
  width: number;
  height: number;
  fps: number;
}

/**
 * The qualities [limits] allow, lowest first: one is allowed when some ceiling covers its size and frame rate (the
 * server's rule, docs/MOJO.md). Without limits (a server before Mojo, or limits not enforced) Standard and High, as
 * before.
 */
export function allowedShareQualities(limits: readonly SharePresetLimit[] | null | undefined): ShareQuality[] {
  if (!limits) return ["standard", "high"];
  const allowed = SHARE_QUALITY_ORDER.filter((q) => {
    const spec = SHARE_QUALITIES[q];
    return limits.some((l) => spec.width <= Math.max(l.width, l.height) && spec.height <= Math.min(l.width, l.height) && spec.frameRate <= l.fps);
  });
  return allowed.length ? allowed : ["standard"];
}

/** [wanted] if allowed, else the best allowed quality below it (Standard at least). */
export function clampShareQuality(wanted: ShareQuality, allowed: readonly ShareQuality[]): ShareQuality {
  if (allowed.includes(wanted)) return wanted;
  const rank = SHARE_QUALITY_ORDER.indexOf(wanted);
  return [...allowed].reverse().find((q) => SHARE_QUALITY_ORDER.indexOf(q) <= rank) ?? allowed[0] ?? "standard";
}

/** The saved choice, or Standard for anything else (including the older text/motion modes). */
export const shareQualityOf = (saved: unknown): ShareQuality => ((SHARE_QUALITY_ORDER as readonly unknown[]).includes(saved) ? (saved as ShareQuality) : "standard");

/**
 * getDisplayMedia's video constraints for [quality]. `ideal` asks for the size and rate, `max` keeps a larger screen from
 * being captured above them (scaled down, whole, never cropped). Safari 17 captures at a low resolution when any size is
 * asked for, so there only the frame rate is capped and the encoder scales instead (see [encodingFor]).
 */
export function displayConstraints(quality: ShareQuality, safari: boolean): MediaTrackConstraints {
  const q = SHARE_QUALITIES[quality];
  const frameRate = { ideal: q.frameRate, max: q.frameRate };
  if (safari) return { frameRate };
  return { width: { ideal: q.width, max: q.width }, height: { ideal: q.height, max: q.height }, frameRate };
}

/** One rung of the adaptive ladder: how far below the mode the encoder sends. */
export interface ShareLevel {
  /** Height the encoder sends at most (the capture is scaled down to it, keeping its shape). */
  height: number;
  frameRate: number;
  maxBitrate: number;
}

/** Top rung first. Each step down gives up frame rate before resolution, so text stays readable longest. */
export const SHARE_LADDERS: Record<ShareQuality, readonly ShareLevel[]> = {
  max: [
    { height: 1440, frameRate: 30, maxBitrate: 8_000_000 },
    { height: 1080, frameRate: 30, maxBitrate: 4_000_000 },
    { height: 720, frameRate: 30, maxBitrate: 2_500_000 },
    { height: 720, frameRate: 15, maxBitrate: 1_200_000 },
  ],
  sharp: [
    { height: 1080, frameRate: 30, maxBitrate: 4_000_000 },
    { height: 720, frameRate: 30, maxBitrate: 2_500_000 },
    { height: 720, frameRate: 15, maxBitrate: 1_200_000 },
  ],
  smooth: [
    { height: 720, frameRate: 60, maxBitrate: 3_500_000 },
    { height: 720, frameRate: 30, maxBitrate: 2_500_000 },
    { height: 720, frameRate: 15, maxBitrate: 1_200_000 },
  ],
  high: [
    { height: 1080, frameRate: 60, maxBitrate: 6_000_000 },
    { height: 1080, frameRate: 30, maxBitrate: 4_000_000 },
    { height: 720, frameRate: 30, maxBitrate: 2_500_000 },
    { height: 720, frameRate: 15, maxBitrate: 1_200_000 },
  ],
  standard: [
    { height: 720, frameRate: 30, maxBitrate: 2_500_000 },
    { height: 720, frameRate: 15, maxBitrate: 1_200_000 },
    { height: 480, frameRate: 15, maxBitrate: 600_000 },
  ],
};

/** The RTCRtpEncodingParameters for [level] given the captured frame height (0 when not known yet). */
export function encodingFor(level: ShareLevel, capturedHeight: number): { maxBitrate: number; maxFramerate: number; scaleResolutionDownBy: number } {
  const scale = capturedHeight > level.height ? capturedHeight / level.height : 1;
  return { maxBitrate: level.maxBitrate, maxFramerate: level.frameRate, scaleResolutionDownBy: Math.round(scale * 100) / 100 };
}

/** Why the browser's encoder is holding back (WebRTC `qualityLimitationReason`). */
export type Limitation = "none" | "bandwidth" | "cpu" | "other";

/** Two seconds between stats samples (livekitSession FLOW_SAMPLE_MS). */
const DOWN_AFTER_SAMPLES = 3;
const UP_AFTER_SAMPLES = 10;
const MIN_GAP_MS = 8_000;
/** Going back up waits this long at first; an upgrade that has to come down again soon doubles it (up to the cap). */
const UP_WAIT_MS = 20_000;
const UP_WAIT_MAX_MS = 160_000;
const FAILED_UPGRADE_MS = 30_000;

/**
 * Steps the share down its ladder when the encoder reports it's limited by bandwidth or CPU for a few samples in a row,
 * and back up only after a long clean stretch; an upgrade that fails again soon makes the next one wait longer, so the
 * quality doesn't flap. Audio isn't touched: under pressure the video gives way first.
 */
export class ShareAdapter {
  level = 0;
  private bad = 0;
  private good = 0;
  private changedAt = Number.NEGATIVE_INFINITY;
  private upgradedAt = Number.NEGATIVE_INFINITY;
  private upWaitMs = UP_WAIT_MS;

  constructor(readonly ladder: readonly ShareLevel[]) {}

  get current(): ShareLevel {
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

/** What the presenter's browser captures and sends, from the track's settings and the sender's stats. */
export interface ShareStats {
  quality: ShareQuality;
  /** The capture's size and frame rate as the browser reports them (null until known). */
  captured: { width: number; height: number; frameRate: number | null } | null;
  /** What the encoder sends now (null until the first stats). */
  sent: { width: number; height: number; fps: number } | null;
  /** The ladder rung in use: 0 is the mode itself. */
  level: number;
  limitation: Limitation;
}

type Stat = Record<string, unknown> & { type: string };

/** The video sender's numbers from a stats report: the outbound RTP stream with the largest frame. */
export function sentVideo(stats: Iterable<Stat>): { width: number; height: number; fps: number; limitation: Limitation } | null {
  let best: { width: number; height: number; fps: number; limitation: Limitation } | null = null;
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
export function receivedVideo(stats: Iterable<Stat>): { width: number; height: number; fps: number } | null {
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

/**
 * What to tell the presenter when they get less than they chose: the browser captures less (a smaller window, or the
 * browser's own limit), or the connection made the share step down. Null when it's what was asked for.
 */
export function shareShortfall(stats: ShareStats): string | null {
  const q = SHARE_QUALITIES[stats.quality];
  const notes: string[] = [];
  const c = stats.captured;
  // A screen with another shape is fit inside the box, so only being smaller on both sides counts as less.
  if (c && c.width < q.width * 0.95 && c.height < q.height * 0.95) notes.push(`your browser captures ${c.width}×${c.height}`);
  if (c?.frameRate && c.frameRate < q.frameRate * 0.9) notes.push(`at most ${Math.round(c.frameRate)} frames a second`);
  if (stats.level > 0) {
    const l = SHARE_LADDERS[stats.quality][stats.level];
    notes.push(`lowered to ${l.height}p at ${l.frameRate} fps for your ${stats.limitation === "cpu" ? "computer" : "connection"}`);
  }
  if (!notes.length) return null;
  return `${q.label} asks for ${q.width}×${q.height} at ${q.frameRate} fps: ${notes.join(", ")}.`;
}
