import { useEffect, useState } from "react";
import { isClassicDecoration, type ProfileStyle } from "../../api/schemas";
import { decorationImage } from "../../sync/decorations";
import { UserAvatar } from "../components/OrgAvatar";
import { usePhoto } from "../components/photos";

/**
 * Profile customisation as people see it (continuation brief v3 §10, API 0.45.0): an animated avatar (a GIF, WebP or a
 * silent looping clip), a decoration frame around it, and an effect over the banner. Meldiq's own frames and effects,
 * drawn in CSS (styles/profile.css). With reduced motion asked for, everything is still: the photo (or a clip's poster)
 * and no effect. Effects stay inside the banner, so they never cover the name, status or avatar. Since API 0.60.0 a
 * decoration can also be an image (Meldiq's own or a community one, server docs/PROFILE_DECORATIONS.md), drawn over
 * the avatar at 1.2 times its size; the presence dot stays on top.
 */

export const DECORATION_LABEL: Record<string, string> = { aurora: "Aurora", ember: "Ember", frost: "Frost", neon: "Neon", sakura: "Sakura", pixel: "Pixel" };
export const EFFECT_LABEL: Record<string, string> = { sparkles: "Sparkles", glow: "Glow", stars: "Stars", bubbles: "Bubbles" };

export function useReducedMotion(): boolean {
  const query = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  const [reduced, setReduced] = useState(!!query?.matches);
  useEffect(() => {
    if (!query) return;
    const on = () => setReduced(query.matches);
    query.addEventListener("change", on);
    return () => query.removeEventListener("change", on);
  }, [query]);
  return reduced;
}

/** How thick a frame is around an avatar of [size]: thin on list rows, up to 6 px on a profile. It sits wholly outside the face. */
export function decorationWidth(size: number): number {
  return Math.min(6, Math.max(2, Math.round(size * 0.08)));
}

interface StyledAvatarProps {
  userId: string;
  name: string;
  colorIndex: number;
  photoRev: number | null;
  media: { kind: "gif" | "webp" | "video"; rev: number } | null;
  decoration: string | null;
  size: number;
  online?: boolean | null;
  presence?: "online" | "idle" | "dnd" | "offline" | null;
  /** A local preview (Settings) instead of the stored media. */
  previewUrl?: { url: string; video: boolean } | null;
}

/** An avatar with its animation and decoration; the plain photo where neither applies. */
export function StyledAvatar(p: StyledAvatarProps) {
  const reduced = useReducedMotion();
  const kind = p.media?.kind ?? null;
  const mime = kind === "video" ? "video/mp4" : kind === "gif" ? "image/gif" : kind === "webp" ? "image/webp" : undefined;
  const stored = usePhoto("avatarMedia", p.userId, p.previewUrl ? null : p.media?.rev, mime);
  const poster = usePhoto("avatarPoster", p.userId, !p.previewUrl && kind === "video" ? p.media?.rev : null);
  const url = p.previewUrl?.url ?? stored;
  const video = p.previewUrl ? p.previewUrl.video : kind === "video";
  const animate = !!url && !reduced;
  return (
    <span className="styled-avatar" style={{ width: p.size, height: p.size }}>
      {/* First, so the avatar and its presence dot are drawn over the frame (2026-10-28: the frame cut through the dot). */}
      {p.decoration && isClassicDecoration(p.decoration) && (
        <span className={`deco deco-${p.decoration}`} style={{ "--deco-w": `${decorationWidth(p.size)}px` } as React.CSSProperties} aria-hidden="true" />
      )}
      {animate ? (
        <span className="avatar-media" style={{ width: p.size, height: p.size }}>
          {video ? <video src={url} poster={poster ?? undefined} muted loop autoPlay playsInline disablePictureInPicture aria-hidden="true" /> : <img src={url} alt="" draggable={false} />}
        </span>
      ) : reduced && video && poster ? (
        <span className="avatar-media" style={{ width: p.size, height: p.size }}>
          <img src={poster} alt="" draggable={false} />
        </span>
      ) : (
        <UserAvatar userId={p.userId} name={p.name} colorIndex={p.colorIndex} photoRev={p.photoRev} size={p.size} online={p.online} presence={p.presence} decorative />
      )}
      {p.decoration && !isClassicDecoration(p.decoration) && <DecorationImage id={p.decoration} size={p.size} />}
    </span>
  );
}

/** An image decoration over an avatar of [size]: 1.2 times as large, centred, gone if it can't be loaded. */
export function DecorationImage({ id, size }: { id: string; size: number }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [id]);
  if (failed) return null;
  const side = Math.round(size * 1.2);
  const offset = Math.round((size - side) / 2);
  return (
    <img
      className="deco-img"
      src={decorationImage(id)}
      width={side}
      height={side}
      style={{ left: offset, top: offset }}
      alt=""
      aria-hidden="true"
      draggable={false}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

/** The banner's effect layer (nothing with reduced motion). */
export function ProfileEffect({ effect }: { effect: ProfileStyle["effect"] | null | undefined }) {
  const reduced = useReducedMotion();
  if (!effect || reduced) return null;
  return <span className={`fx fx-${effect}`} aria-hidden="true" />;
}
