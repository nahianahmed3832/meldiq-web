import { Bell, LogOut, Menu as MenuIcon, Monitor, Moon, Search, Settings, Smartphone, Sun, UserRound } from "lucide-react";
import { useEngine, useOrbit } from "../../app/orbit";
import { setPrefs, usePrefs } from "../../app/prefs";
import { navigate } from "../../app/router";
import { Avatar } from "../components/Avatar";
import { Menu, useMenu } from "../components/Overlay";
import { mentionCount } from "../selectors";

const CONN_LABEL = { online: "Online", connecting: "Connecting…", reconnecting: "Reconnecting…", offline: "Offline" } as const;

export function TopBar({ onMenu, onSearch }: { onMenu: () => void; onSearch: () => void }) {
  const engine = useEngine();
  const me = useOrbit((s) => s.me);
  const connection = useOrbit((s) => s.connection);
  const mentions = useOrbit(mentionCount);
  const prefs = usePrefs();
  const profile = useMenu();
  const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="icon-btn menu-toggle" onClick={onMenu} aria-label="Show conversations">
          <MenuIcon size={19} />
        </button>
      </div>
      <button className="searchbox" onClick={onSearch} aria-label="Search Orbit" aria-keyshortcuts={mac ? "Meta+K" : "Control+K"}>
        <Search size={16} />
        <span>Search conversations, people and messages</span>
        <kbd className="kbd">{mac ? "⌘K" : "Ctrl K"}</kbd>
      </button>
      <div className="topbar-right">
        <button
          className={`conn ${connection}`}
          onClick={() => connection !== "online" && engine.reconnect()}
          title={connection === "online" ? "Connected to your Orbit server" : "Not connected. Click to reconnect now; messages you send wait and go out when the connection is back."}
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
          <Avatar name={me?.displayName ?? "Me"} colorIndex={me?.avatarColor ?? 0} size={32} online={connection === "online"} decorative />
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
                    <Avatar name={me.displayName} colorIndex={me.avatarColor} size={40} decorative />
                    <div className="grow">
                      <div className="ellipsis" style={{ fontWeight: 700 }}>
                        {me.displayName}
                      </div>
                      <div className="faint ellipsis">@{me.username}</div>
                      {me.statusText && <div className="muted ellipsis">{me.statusText}</div>}
                    </div>
                  </div>
                ),
              },
              "separator",
              { label: "Profile", icon: <UserRound size={16} />, onSelect: () => navigate({ section: "settings", settingsPage: "profile" }) },
              { label: "Devices", icon: <Smartphone size={16} />, onSelect: () => navigate({ section: "settings", settingsPage: "devices" }) },
              { label: "Settings", icon: <Settings size={16} />, onSelect: () => navigate({ section: "settings", settingsPage: "notifications" }) },
              "separator",
              { heading: "Theme" },
              { label: "System", icon: <Monitor size={16} />, checked: prefs.theme === "system", onSelect: () => setPrefs({ theme: "system" }) },
              { label: "Light (Ivory)", icon: <Sun size={16} />, checked: prefs.theme === "light", onSelect: () => setPrefs({ theme: "light" }) },
              { label: "Dark (Cocoa)", icon: <Moon size={16} />, checked: prefs.theme === "dark", onSelect: () => setPrefs({ theme: "dark" }) },
              "separator",
              { label: "Sign out of this browser…", icon: <LogOut size={16} />, danger: true, onSelect: () => navigate({ section: "settings", settingsPage: "security" }) },
            ]}
          />
        )}
      </div>
    </header>
  );
}
