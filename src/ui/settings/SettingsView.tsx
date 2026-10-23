import { Activity, BarChart3, Bell, HardDrive, Info, KeyRound, Laptop, Palette, PhoneCall, Shield, Smartphone, UserRound } from "lucide-react";
import { CallsPage } from "./CallsPage";
import { useEngine } from "../../application/orbit";
import { isPlatformAdmin } from "../../sync/ops";
import { useLoad } from "../workspace/useLoad";
import { ServiceHealthPage } from "./ServiceHealthPage";
import { AdminUsagePage } from "./AdminUsagePage";
import { navigate, type SettingsPage } from "../../application/router";
import { AboutPage, AppearancePage, NotificationsPage } from "./PreferencePages";
import { AccountSettingsPage } from "./AccountSettingsPage";
import { DevicesPage, SecurityPage } from "./AccountPages";
import { ProfilePage } from "./ProfilePage";
import { StoragePage } from "./StoragePage";
import { type StringKey, useT } from "../../i18n";

const PAGES: { key: SettingsPage; label: StringKey; icon: React.ReactNode }[] = [
  { key: "profile", label: "settings_profile", icon: <UserRound size={17} /> },
  { key: "account", label: "settings_account", icon: <KeyRound size={17} /> },
  { key: "devices", label: "settings_devices", icon: <Smartphone size={17} /> },
  { key: "notifications", label: "settings_notifications", icon: <Bell size={17} /> },
  { key: "calls", label: "settings_calls", icon: <PhoneCall size={17} /> },
  { key: "appearance", label: "settings_appearance", icon: <Palette size={17} /> },
  { key: "storage", label: "settings_storage", icon: <HardDrive size={17} /> },
  { key: "security", label: "settings_security", icon: <Shield size={17} /> },
  { key: "about", label: "settings_about", icon: <Info size={17} /> },
];

export function SettingsView({ page, onSignedOut }: { page: SettingsPage; onSignedOut: () => void }) {
  const engine = useEngine();
  // Service health and workspace usage are for platform administrators only (android round 7 C1, C7); the server checks again.
  const admin = useLoad(() => isPlatformAdmin(engine).catch(() => false), [engine]).data === true;
  const t = useT();
  const shown: { key: SettingsPage; label: string; icon: React.ReactNode }[] = PAGES.map((p) => ({ ...p, label: t(p.label) }));
  const pages = admin
    ? [...shown, { key: "health" as const, label: "Service health", icon: <Activity size={17} /> }, { key: "usage" as const, label: "Workspace usage", icon: <BarChart3 size={17} /> }]
    : shown;
  return (
    <section className="main" aria-label="Settings" style={{ display: "flex", flexDirection: "column" }}>
      <div className="settings">
        <nav className="settings-nav" aria-label="Settings pages">
          <h2>{t("settings_title")}</h2>
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
            {page === "account" && <AccountSettingsPage onSignedOut={onSignedOut} />}
            {page === "devices" && <DevicesPage />}
            {page === "notifications" && <NotificationsPage />}
            {page === "calls" && <CallsPage />}
            {page === "appearance" && <AppearancePage />}
            {page === "storage" && <StoragePage />}
            {page === "security" && <SecurityPage onSignedOut={onSignedOut} />}
            {page === "about" && <AboutPage />}
            {page === "health" && <ServiceHealthPage />}
            {page === "usage" && <AdminUsagePage />}
          </div>
        </div>
      </div>
    </section>
  );
}
