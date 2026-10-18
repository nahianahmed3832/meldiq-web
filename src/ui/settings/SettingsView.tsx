import { Bell, Info, Laptop, Palette, Shield, Smartphone, UserRound } from "lucide-react";
import { navigate, type SettingsPage } from "../../app/router";
import { AboutPage, AppearancePage, NotificationsPage } from "./PreferencePages";
import { DevicesPage, ProfilePage, SecurityPage } from "./AccountPages";

const PAGES: { key: SettingsPage; label: string; icon: React.ReactNode }[] = [
  { key: "profile", label: "Profile", icon: <UserRound size={17} /> },
  { key: "devices", label: "Devices", icon: <Smartphone size={17} /> },
  { key: "notifications", label: "Notifications", icon: <Bell size={17} /> },
  { key: "appearance", label: "Appearance", icon: <Palette size={17} /> },
  { key: "security", label: "Privacy & security", icon: <Shield size={17} /> },
  { key: "about", label: "About", icon: <Info size={17} /> },
];

export function SettingsView({ page, onSignedOut }: { page: SettingsPage; onSignedOut: () => void }) {
  return (
    <section className="main" aria-label="Settings" style={{ display: "flex", flexDirection: "column" }}>
      <div className="settings">
        <nav className="settings-nav" aria-label="Settings pages">
          <h2>Settings</h2>
          {PAGES.map((p) => (
            <button key={p.key} className="side-item" aria-current={page === p.key ? "page" : undefined} onClick={() => navigate({ section: "settings", settingsPage: p.key })}>
              <span className="glyph">{p.icon}</span>
              <span className="grow">{p.label}</span>
            </button>
          ))}
          <button className="side-item" onClick={() => navigate({ section: "home" })} style={{ marginTop: 8 }}>
            <span className="glyph">
              <Laptop size={17} />
            </span>
            <span className="grow">Back to conversations</span>
          </button>
        </nav>
        <div className="settings-page scroll">
          <div className="inner">
            {page === "profile" && <ProfilePage />}
            {page === "devices" && <DevicesPage />}
            {page === "notifications" && <NotificationsPage />}
            {page === "appearance" && <AppearancePage />}
            {page === "security" && <SecurityPage onSignedOut={onSignedOut} />}
            {page === "about" && <AboutPage />}
          </div>
        </div>
      </div>
    </section>
  );
}
