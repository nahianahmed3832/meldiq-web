import { text as uiText } from "../../i18n";
import { useAccountActions } from "./AccountActions";
import { ArrowRightLeft, BellOff, Bookmark, CircleDot, Languages, LogOut, Palette, Settings, Smile, UserRound } from "lucide-react";
import { useState } from "react";
import { useOrbit } from "../../application/orbit";
import { navigate } from "../../application/router";
import { useT } from "../../i18n";
import { paused, statusLine } from "../../sync/status";
import { currentPresence, PRESENCE_LABEL } from "../../sync/social";
import { UserAvatar } from "../components/OrgAvatar";
import { Menu, useMenu } from "../components/Overlay";
import { PauseDialog, PresenceDialog, StatusDialog } from "../dialogs/StatusDialogs";
import { clock } from "../format";
/**
 * The profile menu (the reference's profile popover): who you are, presence, status and pausing notifications, Activity
 * and Saved, profile, devices and settings, the theme, and signing out. Opened from the user panel at the bottom of the
 * sidebar (desktop) or the avatar in the phone's top bar.
 */
export function useProfileMenu(): {
  open: (anchor: HTMLElement) => void;
  expanded: boolean;
  ui: React.ReactNode;
} {
  const accountAction = useAccountActions();
  const t = useT();
  const me = useOrbit((s) => s.me);
  const myPhoto = useOrbit((s) => (s.me ? s.users[s.me.userId]?.photoRev : null));
  const menu = useMenu();
  const statusOffered = useOrbit((s) => s.server?.features.includes("status-expiry") ?? false);
  const presenceOffered = useOrbit((s) => s.server?.features.includes("presence-modes") ?? false);
  const [dialog, setDialog] = useState<"status" | "pause" | "presence" | null>(null);
  const now = Date.now();
  const myStatus = statusLine(me, now);
  const pausedUntil = paused(me?.notificationsPausedUntil, now) ? (me?.notificationsPausedUntil ?? null) : null;
  const ui = (
    <>
      {menu.anchor && me && (
        <Menu
          anchor={menu.anchor}
          align="end"
          label={t("settings.profile")}
          onClose={menu.close}
          entries={[
            {
              custom: (
                <div className="row" style={{ padding: "8px 10px 10px", gap: 12 }}>
                  <UserAvatar userId={me.userId} name={me.displayName} colorIndex={me.avatarColor} photoRev={myPhoto} size={40} decorative />
                  <div className="grow">
                    <div className="ellipsis" style={{ fontWeight: 700 }}>
                      {me.displayName}
                    </div>
                    <div className="faint ellipsis">@{me.username}</div>
                    {(statusOffered ? myStatus : me.statusText) && <div className="muted ellipsis">{statusOffered ? myStatus : me.statusText}</div>}
                  </div>
                </div>
              ),
            },
            {
              get label() {
                return uiText("settings.interface.switch_account_fedce01");
              },
              icon: <ArrowRightLeft size={16} />,
              onSelect: () => accountAction("switch"),
            },
            {
              get label() {
                return uiText("settings.interface.log_out_4961614");
              },
              icon: <LogOut size={16} />,
              danger: true,
              onSelect: () => accountAction("logout"),
            },
            "separator",
            ...(presenceOffered
              ? [
                  {
                    label: uiText("workspace.interface.presence_39ae35f", { value0: PRESENCE_LABEL[currentPresence(me.presenceMode, me.presenceUntil, now)].label }),
                    icon: <CircleDot size={16} />,
                    onSelect: () => setDialog("presence"),
                  },
                ]
              : []),
            ...(statusOffered
              ? [
                  {
                    label: myStatus ? uiText("workspace.interface.change_status_b5996c9") : uiText("workspace.interface.set_a_status_da0aaf2"),
                    icon: <Smile size={16} />,
                    onSelect: () => setDialog("status"),
                  },
                  {
                    label: pausedUntil ? uiText("workspace.interface.notifications_paused_until_43c57f7", { value0: clock(pausedUntil) }) : uiText("workspace.interface.pause_notifications_71d4b07"),
                    icon: <BellOff size={16} />,
                    onSelect: () => setDialog("pause"),
                  },
                  "separator" as const,
                ]
              : []),
            { label: t("top_saved"), icon: <Bookmark size={16} />, onSelect: () => navigate({ section: "later" }) },
            "separator",
            { label: t("settings.profile"), icon: <UserRound size={16} />, onSelect: () => navigate({ section: "settings", settingsPage: "profile" }) },
            { label: t("settings.title"), icon: <Settings size={16} />, onSelect: () => navigate({ section: "settings", settingsPage: "account" }) },
            { label: t("settings.appearance"), icon: <Palette size={16} />, onSelect: () => navigate({ section: "settings", settingsPage: "appearance" }) },
            { label: t("common.language.label"), icon: <Languages size={16} />, onSelect: () => navigate({ section: "settings", settingsPage: "language" }) },
          ]}
        />
      )}
      {dialog === "status" && <StatusDialog onClose={() => setDialog(null)} />}
      {dialog === "pause" && <PauseDialog onClose={() => setDialog(null)} />}
      {dialog === "presence" && <PresenceDialog onClose={() => setDialog(null)} />}
    </>
  );
  return { open: menu.open, expanded: !!menu.anchor, ui };
}
