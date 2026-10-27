import {
  Activity,
  BarChart3,
  Bell,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  HardDrive,
  Headphones,
  Info,
  Keyboard,
  KeyRound,
  Laptop,
  Palette,
  Shield,
  SlidersHorizontal,
  Smartphone,
  UserRound,
} from "lucide-react";
import { ShortcutsPage } from "./ShortcutsPage";
import { AdvancedPage } from "./AdvancedPage";
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
import { YouCard } from "./YouCard";
import { InstallButton } from "./InstallButton";

type PageEntry = { key: SettingsPage; label: StringKey; icon: React.ReactNode };

/** The reference's two groups (2026-10-28): you and your account, then how the app looks and behaves here. */
const USER_PAGES: PageEntry[] = [
  { key: "account", label: "settings_account", icon: <KeyRound size={17} /> },
  { key: "profile", label: "settings_profile", icon: <UserRound size={17} /> },
  { key: "security", label: "settings_security", icon: <Shield size={17} /> },
  { key: "devices", label: "settings_devices", icon: <Smartphone size={17} /> },
];
const APP_PAGES: PageEntry[] = [
  { key: "appearance", label: "settings_appearance", icon: <Palette size={17} /> },
  { key: "calls", label: "settings_calls", icon: <Headphones size={17} /> },
  { key: "notifications", label: "settings_notifications", icon: <Bell size={17} /> },
  { key: "shortcuts", label: "settings_shortcuts", icon: <Keyboard size={17} /> },
  { key: "advanced", label: "settings_advanced", icon: <SlidersHorizontal size={17} /> },
  { key: "storage", label: "settings_storage", icon: <HardDrive size={17} /> },
  { key: "about", label: "settings_about", icon: <Info size={17} /> },
];

export function SettingsView({ page, onSignedOut }: { page: SettingsPage; onSignedOut: () => void }) {
  const engine = useEngine();
  // Service health and workspace usage are for platform administrators only (android round 7 C1, C7); the server checks again.
  const admin = useLoad(() => isPlatformAdmin(engine).catch(() => false), [engine]).data === true;
  const t = useT();
  const named = (list: PageEntry[]) => list.map((p) => ({ ...p, label: t(p.label) }));
  const groups: { title: string; pages: { key: SettingsPage; label: string; icon: React.ReactNode }[] }[] = [
    { title: t("settings_user_group"), pages: named(USER_PAGES) },
    { title: t("settings_app_group"), pages: named(APP_PAGES) },
    ...(admin
      ? [
          {
            title: "Administration",
            pages: [
              { key: "health" as const, label: "Service health", icon: <Activity size={17} /> },
              { key: "usage" as const, label: "Workspace usage", icon: <BarChart3 size={17} /> },
            ],
          },
        ]
      : []),
  ];
  return (
    <section className="main" aria-label="Settings" style={{ display: "flex", flexDirection: "column" }}>
      <div className={`settings${page === "you" ? " at-you" : ""}`}>
        <nav className="settings-nav" aria-label="Settings pages">
          <h2>{t("settings_title")}</h2>
          {/* Phones' You tab (brief v4 §18, as the Android app): you, then Saved, then every page as a list. */}
          <YouCard />
          <div className="you-only you-install">
            <InstallButton className="btn btn-primary" />
          </div>
          <button className="side-item you-only" onClick={() => navigate({ section: "later" })}>
            <span className="glyph">
              <Bookmark size={17} />
            </span>
            <span className="grow">{t("top_saved")}</span>
            <ChevronRight size={16} className="faint you-only" aria-hidden="true" />
          </button>
          {groups.map((g) => (
            <div key={g.title} role="group" aria-label={g.title} className="settings-nav-group">
              <div className="settings-nav-title">{g.title}</div>
              {g.pages.map((p) => (
                <button key={p.key} className="side-item" aria-current={page === p.key ? "page" : undefined} onClick={() => navigate({ section: "settings", settingsPage: p.key })}>
                  <span className="glyph">{p.icon}</span>
                  <span className="grow">{p.label}</span>
                  <ChevronRight size={16} className="faint you-only" aria-hidden="true" />
                </button>
              ))}
            </div>
          ))}
          <button className="side-item not-phone" onClick={() => navigate({ section: "home" })} style={{ marginTop: 8 }}>
            <span className="glyph">
              <Laptop size={17} />
            </span>
            <span className="grow">Back to conversations</span>
          </button>
        </nav>
        <div className="settings-page scroll">
          <div className="inner">
            <button className="settings-back" onClick={() => navigate({ section: "settings", settingsPage: "you" })}>
              <ChevronLeft size={18} aria-hidden="true" /> {t("nav_you")}
            </button>
            {(page === "profile" || page === "you") && <ProfilePage />}
            {page === "account" && <AccountSettingsPage onSignedOut={onSignedOut} />}
            {page === "devices" && <DevicesPage />}
            {page === "notifications" && <NotificationsPage />}
            {page === "calls" && <CallsPage />}
            {page === "appearance" && <AppearancePage />}
            {page === "storage" && <StoragePage />}
            {page === "security" && <SecurityPage onSignedOut={onSignedOut} />}
            {page === "about" && <AboutPage />}
            {page === "advanced" && <AdvancedPage />}
            {page === "shortcuts" && <ShortcutsPage />}
            {page === "health" && <ServiceHealthPage />}
            {page === "usage" && <AdminUsagePage />}
          </div>
        </div>
      </div>
    </section>
  );
}
