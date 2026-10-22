import type { CSSProperties } from "react";

/** The phone's eight avatar tones (android ui/theme/Color.kt `AvatarTones`), each given a glossy lighter top-left. */
const TONES: [string, string][] = [
  ["#3a9483", "#2b7a6b"],
  ["#6676c2", "#5363ae"],
  ["#bb7533", "#a35f1e"],
  ["#4c9562", "#3a7f4e"],
  ["#4285b6", "#2e70a1"],
  ["#bf5e80", "#aa4a6c"],
  ["#8a66bc", "#7652a8"],
  ["#677b84", "#52666f"],
];

/** android ui/components/Display.kt `initialsOf`. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return [...parts[0]].slice(0, 2).join("").toUpperCase();
  return ([...parts[0]][0] + [...parts[parts.length - 1]][0]).toUpperCase();
}

/** A stable colour index for things without one (workspaces). */
export function colorIndexOf(id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

interface AvatarProps {
  name: string;
  colorIndex: number;
  size?: number;
  online?: boolean | null;
  square?: boolean;
  /** Hidden from assistive tech when the name is already next to it. */
  decorative?: boolean;
  /** A photo (object URL) shown instead of the initials. */
  photoUrl?: string | null;
  /** Batch B6b: idle (amber) or do not disturb (red) instead of the plain online dot. */
  presence?: "online" | "idle" | "dnd" | "offline" | null;
}

const PRESENCE_TEXT = { online: "Online", idle: "Idle", dnd: "Do not disturb", offline: "Offline" } as const;

export function Avatar({ name, colorIndex, size = 36, online, square, decorative, photoUrl, presence }: AvatarProps) {
  const [a1, a2] = TONES[((colorIndex % TONES.length) + TONES.length) % TONES.length];
  const style = { width: size, height: size, fontSize: Math.round(size * 0.36), "--a1": a1, "--a2": a2 } as CSSProperties;
  return (
    <span className={`avatar${square ? " square" : ""}`} style={style} role={decorative ? undefined : "img"} aria-label={decorative ? undefined : name} aria-hidden={decorative || undefined}>
      {photoUrl ? <img src={photoUrl} alt="" className="avatar-photo" draggable={false} /> : initialsOf(name)}
      {presence && online ? (
        <span className={`presence on${presence === "idle" ? " idle" : presence === "dnd" ? " dnd" : ""}`} aria-label={PRESENCE_TEXT[presence]} />
      ) : (
        online !== undefined && online !== null && <span className={`presence${online ? " on" : ""}`} aria-label={online ? "Online" : "Offline"} />
      )}
    </span>
  );
}
