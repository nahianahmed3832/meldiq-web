import { text as uiText } from "../../i18n";
import { Lock, LockOpen } from "lucide-react";
import { type LockChoice, LOCK_CHOICES } from "../../sync/communityParity";
import { running } from "../../sync/reports";
import type { MenuEntry } from "../components/Overlay";
import { untilWhen } from "../format";
interface LockEntryOptions {
  /** When the current lock (on older servers: the join pause) ends, or null. */
  lockedUntil: number | null;
  /** The server has a real lock (community-safety: no joins, only moderators chat), not just the join pause. */
  realLock: boolean;
  onLock: (choice: LockChoice) => void;
  onUnlock: () => void;
  now?: number;
}
/**
 * The community menu's Lock item (the reference's Lock Server): a small popover asking how long, or Unlock while locked.
 * Servers without community-safety pause joining instead (Security actions).
 */
export function lockEntry({ lockedUntil, realLock, onLock, onUnlock, now = Date.now() }: LockEntryOptions): MenuEntry {
  if (running(lockedUntil, now))
    return {
      get label() {
        return uiText("organization.interface.unlock_community_357580e");
      },
      icon: <LockOpen size={16} />,
      hint: uiText("organization.interface.locked_until_value0_bb8302e", { value0: untilWhen(lockedUntil!, now) }),
      onSelect: onUnlock,
    };
  const heading = realLock
    ? uiText("organization.interface.lock_for_how_long_nobody_new_can_join_and_only_moderators_can_cha_8108ff1")
    : uiText("organization.interface.lock_for_how_long_nobody_new_can_join_cb5f194");
  return {
    get label() {
      return uiText("organization.interface.lock_community_e991da3");
    },
    icon: <Lock size={16} />,
    submenu: [
      { heading },
      ...LOCK_CHOICES.map((c) => ({ label: c.label, onSelect: () => onLock(c) })),
      "separator",
      {
        get label() {
          return uiText("common.actions.cancel");
        },
        onSelect: () => undefined,
      },
    ],
  };
}
