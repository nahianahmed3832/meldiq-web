import { Lock, LockOpen } from "lucide-react";
import { LOCK_CHOICES } from "../../sync/communityParity";
import { running } from "../../sync/reports";
import type { MenuEntry } from "../components/Overlay";
import { untilWhen } from "../format";

interface LockEntryOptions {
  /** When the current lock (for now: the join pause) ends, or null. */
  lockedUntil: number | null;
  /** The server has a real lock (no joins, only moderators chat), not just the join pause. */
  realLock: boolean;
  /** Locks for [ms] from now. */
  onLock: (ms: number) => void;
  onUnlock: () => void;
  now?: number;
}

/**
 * The community menu's Lock item (the reference's Lock Server): a small popover asking how long, or Unlock while locked.
 * Until the server's lock route exists it pauses joining (Security actions).
 */
export function lockEntry({ lockedUntil, realLock, onLock, onUnlock, now = Date.now() }: LockEntryOptions): MenuEntry {
  if (running(lockedUntil, now)) return { label: "Unlock community", icon: <LockOpen size={16} />, hint: `Locked until ${untilWhen(lockedUntil!, now)}`, onSelect: onUnlock };
  const heading = realLock ? "Lock for how long? Nobody new can join and only moderators can chat." : "Lock for how long? Nobody new can join.";
  return {
    label: "Lock community",
    icon: <Lock size={16} />,
    submenu: [{ heading }, ...LOCK_CHOICES.map((c) => ({ label: c.label, onSelect: () => onLock(c.ms) })), "separator", { label: "Cancel", onSelect: () => undefined }],
  };
}
