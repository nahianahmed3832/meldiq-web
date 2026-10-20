import { Activity, Bell, HardDrive, Info, KeyRound, Laptop, Palette, Shield, Smartphone, UserRound } from "lucide-react";
import { useEngine } from "../../app/orbit";
import { isPlatformAdmin } from "../../sync/ops";
import { useLoad } from "../workspace/useLoad";
import { ServiceHealthPage } from "./ServiceHealthPage";
import { navigate, type SettingsPage } from "../../app/router";
import { AboutPage, AppearancePage, NotificationsPage } from "./PreferencePages";
import { AccountSettingsPage } from "./AccountSettingsPage";
import { DevicesPage, SecurityPage } from "./AccountPages";
import { ProfilePage } from "./ProfilePage";
import { StoragePage } from "./StoragePage";

const PAGES: { key: SettingsPage; label: string; icon: React.ReactNode }[] = [
  { key: "profile", label: "Profile", icon: <UserRound size={17} /> },
  { key: "account", label: "Account", icon: <KeyRound size={17} /> },
  { key: "devices", label: "Devices", icon: <Smartphone size={17} /> },
  { key: "notifications", label: "Notifications", icon: <Bell size={17} /> },
  { key: "appearance", label: "Appearance", icon: <Palette size={17} /> },
  { key: "storage", label: "Storage", icon: <HardDrive size={17} /> },
  { key: "security", label: "Privacy & security", icon: <Shield size={17} /> },
  { key: "about", label: "About", icon: <Info size={17} /> },
];

export function SettingsView({ page, onSignedOut }: { page: SettingsPage; onSignedOut: () => void }) {
  const engine = useEngine();
  // Service health is for platform administrators only (android round 7 C1); the server checks it again.
  const admin = useLoad(() => isPlatformAdmin(engine).catch(() => false), [engine]).data === true;
  const pages = admin ? [...PAGES, { key: "health" as const, label: "Service health", icon: <Activity size={17} /> }] : PAGES;
  return (
    <section className="main" aria-label="Settings" style={{ display: "flex", flexDirection: "column" }}>
      <div className="settings">
        <nav className="settings-nav" aria-label="Settings pages">
          <h2>Settings</h2>
          {pages.map((p) => (
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
            {page === "account" && <AccountSettingsPage />}
            {page === "devices" && <DevicesPage />}
            {page === "notifications" && <NotificationsPage />}
            {page === "appearance" && <AppearancePage />}
            {page === "storage" && <StoragePage />}
            {page === "security" && <SecurityPage onSignedOut={onSignedOut} />}
            {page === "about" && <AboutPage />}
            {page === "health" && <ServiceHealthPage />}
          </div>
        </div>
      </div>
    </section>
  );
}
