import { AtSign, BellOff, Bookmark, CircleDot, LogOut, Monitor, Moon, Settings, Smartphone, Smile, Sun, UserRound, Sparkles } from "lucide-react";
import { useState } from "react";
import { useOrbit } from "../../application/orbit";
import { setPrefs, usePrefs } from "../../application/prefs";
import { navigate } from "../../application/router";
import { useT } from "../../i18n";
import { paused, statusLine } from "../../sync/status";
import { currentPresence, PRESENCE_LABEL } from "../../sync/social";
import { UserAvatar } from "../components/OrgAvatar";
import { Menu, useMenu } from "../components/Overlay";
import { PauseDialog, PresenceDialog, StatusDialog } from "../dialogs/StatusDialogs";
import { clock } from "../format";
import { mentionCount } from "../selectors";

/**
 * The profile menu (the reference's profile popover): who you are, presence, status and pausing notifications, Activity
 * and Saved, profile, devices and settings, the theme, and signing out. Opened from the user panel at the bottom of the
 * sidebar (desktop) or the avatar in the phone's top bar.
 */
export function useProfileMenu(): { open: (anchor: HTMLElement) => void; expanded: boolean; ui: React.ReactNode } {
  const t = useT();
  const mojoOffered = useOrbit((s) => s.server?.features.includes("mojo") ?? false);
  const me = useOrbit((s) => s.me);
  const myPhoto = useOrbit((s) => (s.me ? s.users[s.me.userId]?.photoRev : null));
  const prefs = usePrefs();
  const mentions = useOrbit(mentionCount);
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
          label="Profile"
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
            "separator",
            ...(presenceOffered
              ? [
                  {
                    label: `Presence: ${PRESENCE_LABEL[currentPresence(me.presenceMode, me.presenceUntil, now)].label}…`,
                    icon: <CircleDot size={16} />,
                    onSelect: () => setDialog("presence"),
                  },
                ]
              : []),
            ...(statusOffered
              ? [
                  { label: myStatus ? "Change status…" : "Set a status…", icon: <Smile size={16} />, onSelect: () => setDialog("status") },
                  {
                    label: pausedUntil ? `Notifications paused until ${clock(pausedUntil)}…` : "Pause notifications…",
                    icon: <BellOff size={16} />,
                    onSelect: () => setDialog("pause"),
                  },
                  "separator" as const,
                ]
              : []),
            // Activity has its own button (the user panel on desktop, the top bar on phones); Saved for later lives here.
            { label: mentions ? `${t("top_activity")} (${mentions})` : t("top_activity"), icon: <AtSign size={16} />, onSelect: () => navigate({ section: "activity" }) },
            { label: t("top_saved"), icon: <Bookmark size={16} />, onSelect: () => navigate({ section: "later" }) },
            "separator",
            { label: "Profile", icon: <UserRound size={16} />, onSelect: () => navigate({ section: "settings", settingsPage: "profile" }) },
            { label: "Devices", icon: <Smartphone size={16} />, onSelect: () => navigate({ section: "settings", settingsPage: "devices" }) },
            // Meldiq Mojo (server docs/MOJO.md): findable here, never pushed at people.
            ...(mojoOffered ? [{ label: "Meldiq Mojo", icon: <Sparkles size={16} />, onSelect: () => navigate({ section: "settings", settingsPage: "mojo" }) }] : []),
            { label: "Settings", icon: <Settings size={16} />, onSelect: () => navigate({ section: "settings", settingsPage: "notifications" }) },
            "separator",
            { heading: "Theme" },
            { label: "System", icon: <Monitor size={16} />, checked: prefs.theme === "system", onSelect: () => setPrefs({ theme: "system", themeChosen: true }) },
            { label: "Light", icon: <Sun size={16} />, checked: prefs.theme === "light", onSelect: () => setPrefs({ theme: "light", themeChosen: true }) },
            { label: "Dark", icon: <Moon size={16} />, checked: prefs.theme === "dark", onSelect: () => setPrefs({ theme: "dark", themeChosen: true }) },
            { label: "Black", icon: <Moon size={16} fill="currentColor" />, checked: prefs.theme === "black", onSelect: () => setPrefs({ theme: "black", themeChosen: true }) },
            "separator",
            { label: "Sign out…", icon: <LogOut size={16} />, danger: true, onSelect: () => navigate({ section: "settings", settingsPage: "security" }) },
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
