import { Bell, BellOff, CircleDot, LogOut, Menu as MenuIcon, Monitor, Moon, Search, Settings, Smartphone, Smile, Sun, UserRound } from "lucide-react";
import { useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { setPrefs, usePrefs } from "../../application/prefs";
import { navigate } from "../../application/router";
import { UserAvatar } from "../components/OrgAvatar";
import { Menu, useMenu } from "../components/Overlay";
import { mentionCount } from "../selectors";
import { clock } from "../format";
import { paused, statusLine } from "../../sync/status";
import { PauseDialog, PresenceDialog, StatusDialog } from "../dialogs/StatusDialogs";
import { currentPresence, PRESENCE_LABEL } from "../../sync/social";
import { useT } from "../../i18n";

const CONN_LABEL = { online: "Online", connecting: "Connecting…", reconnecting: "Reconnecting…", offline: "Offline" } as const;

export function TopBar({ onMenu, onSearch }: { onMenu: () => void; onSearch: () => void }) {
  const engine = useEngine();
  const t = useT();
  const me = useOrbit((s) => s.me);
  const myPhoto = useOrbit((s) => (s.me ? s.users[s.me.userId]?.photoRev : null));
  const connection = useOrbit((s) => s.connection);
  const mentions = useOrbit(mentionCount);
  const prefs = usePrefs();
  const profile = useMenu();
  const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  // Round 3 (the reference's profile popover): status and pausing notifications, on servers that keep them.
  const statusOffered = useOrbit((s) => s.server?.features.includes("status-expiry") ?? false);
  const [dialog, setDialog] = useState<"status" | "pause" | "presence" | null>(null);
  const presenceOffered = useOrbit((s) => s.server?.features.includes("presence-modes") ?? false);
  const now = Date.now();
  const myStatus = statusLine(me, now);
  const pausedUntil = paused(me?.notificationsPausedUntil, now) ? (me?.notificationsPausedUntil ?? null) : null;

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="icon-btn menu-toggle" onClick={onMenu} aria-label="Show conversations">
          <MenuIcon size={19} />
        </button>
      </div>
      <button className="searchbox" onClick={onSearch} aria-label="Search Meldiq" aria-keyshortcuts={mac ? "Meta+K" : "Control+K"}>
        <Search size={16} />
        <span>{t("search_placeholder")}</span>
        <kbd className="kbd">{mac ? "⌘K" : "Ctrl K"}</kbd>
      </button>
      <div className="topbar-right">
        <button
          className={`conn ${connection}`}
          onClick={() => connection !== "online" && engine.reconnect()}
          title={connection === "online" ? "Connected to your Meldiq server" : "Not connected. Click to reconnect now; messages you send wait and go out when the connection is back."}
          aria-live="polite"
        >
          <i aria-hidden="true" />
          <span>{CONN_LABEL[connection]}</span>
        </button>
        <button className="icon-btn" onClick={() => navigate({ section: "activity" })} aria-label={mentions ? `Notifications, ${mentions} unread mentions` : "Notifications"}>
          <Bell size={19} />
          {mentions > 0 && <span className="dot" />}
        </button>
        <button className="icon-btn hide-sm" onClick={() => navigate({ section: "settings", settingsPage: "notifications" })} aria-label="Settings">
          <Settings size={19} />
        </button>
        <button className="me-btn" onClick={(e) => profile.open(e.currentTarget)} aria-label="Your profile and settings" aria-haspopup="menu" aria-expanded={!!profile.anchor}>
          <UserAvatar userId={me?.userId ?? ""} name={me?.displayName ?? "Me"} colorIndex={me?.avatarColor ?? 0} photoRev={myPhoto} size={32} online={connection === "online"} decorative />
        </button>
        {profile.anchor && me && (
          <Menu
            anchor={profile.anchor}
            align="end"
            label="Profile"
            onClose={profile.close}
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
              { label: "Profile", icon: <UserRound size={16} />, onSelect: () => navigate({ section: "settings", settingsPage: "profile" }) },
              { label: "Devices", icon: <Smartphone size={16} />, onSelect: () => navigate({ section: "settings", settingsPage: "devices" }) },
              { label: "Settings", icon: <Settings size={16} />, onSelect: () => navigate({ section: "settings", settingsPage: "notifications" }) },
              "separator",
              { heading: "Theme" },
              { label: "System", icon: <Monitor size={16} />, checked: prefs.theme === "system", onSelect: () => setPrefs({ theme: "system" }) },
              { label: "Light", icon: <Sun size={16} />, checked: prefs.theme === "light", onSelect: () => setPrefs({ theme: "light" }) },
              { label: "Dark", icon: <Moon size={16} />, checked: prefs.theme === "dark", onSelect: () => setPrefs({ theme: "dark" }) },
              "separator",
              { label: "Sign out of this browser…", icon: <LogOut size={16} />, danger: true, onSelect: () => navigate({ section: "settings", settingsPage: "security" }) },
            ]}
          />
        )}
      </div>
      {dialog === "status" && <StatusDialog onClose={() => setDialog(null)} />}
      {dialog === "pause" && <PauseDialog onClose={() => setDialog(null)} />}
      {dialog === "presence" && <PresenceDialog onClose={() => setDialog(null)} />}
    </header>
  );
}
