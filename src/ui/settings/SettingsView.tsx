import {
  Activity,
  BarChart3,
  Bell,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Coins,
  Clapperboard,
  Code2,
  HardDrive,
  Headphones,
  Info,
  Keyboard,
  KeyRound,
  Laptop,
  Palette,
  Shield,
  Search,
  X,
  SlidersHorizontal,
  Smartphone,
  Gem,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { matchesSetting, SETTINGS_INFO } from "./settingsSearch";
import { ShortcutsPage } from "./ShortcutsPage";
import { AdvancedPage } from "./AdvancedPage";
import { CallsPage } from "./CallsPage";
import { useEngine, useOrbit } from "../../application/orbit";
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
import { MojoPage } from "../mojo/MojoPage";
import { SparkPage } from "../mojo/SparkPage";
import { PointsPage } from "../points/PointsPage";
import { CreatorsPage } from "../creators/CreatorsPage";
import { DeveloperPage } from "../developer/DeveloperPage";

/** [features]: the page shows when the server has any of them. */
type PageEntry = { key: SettingsPage; label: StringKey; icon: React.ReactNode; features?: string[] };
const NO_FEATURES: string[] = [];

/** The reference's two groups (2026-10-28): you and your account, then how the app looks and behaves here. */
const USER_PAGES: PageEntry[] = [
  { key: "account", label: "settings_account", icon: <KeyRound size={17} /> },
  { key: "profile", label: "settings_profile", icon: <UserRound size={17} /> },
  { key: "security", label: "settings_security", icon: <Shield size={17} /> },
  { key: "devices", label: "settings_devices", icon: <Smartphone size={17} /> },
  // Meldiq Mojo (server docs/MOJO.md): with the account, not pushed anywhere else.
  { key: "mojo", label: "settings_mojo", icon: <Sparkles size={17} /> },
  // Meldiq Spark: its own page (2026-10-28), boosting the communities you love.
  { key: "spark", label: "settings_spark", icon: <Gem size={17} /> },
];
const APP_PAGES: PageEntry[] = [
  { key: "appearance", label: "settings_appearance", icon: <Palette size={17} /> },
  { key: "calls", label: "settings_calls", icon: <Headphones size={17} /> },
  { key: "notifications", label: "settings_notifications", icon: <Bell size={17} /> },
  { key: "shortcuts", label: "settings_shortcuts", icon: <Keyboard size={17} /> },
  // API 0.65.0: points, quests and account levels (Gem is Spark's).
  { key: "points", label: "settings_points", icon: <Coins size={17} />, features: ["points"] },
  { key: "advanced", label: "settings_advanced", icon: <SlidersHorizontal size={17} /> },
  // API 0.65.0 batch B: bots and "Log in with Meldiq" apps.
  { key: "developer", label: "settings_developer", icon: <Code2 size={17} />, features: ["bots", "oauth-apps"] },
  // API 0.65.0 batch B: the creator programme.
  { key: "creators", label: "settings_creators", icon: <Clapperboard size={17} />, features: ["creator-program"] },
  { key: "storage", label: "settings_storage", icon: <HardDrive size={17} /> },
  { key: "about", label: "settings_about", icon: <Info size={17} /> },
];

export function SettingsView({ page, onSignedOut }: { page: SettingsPage; onSignedOut: () => void }) {
  const engine = useEngine();
  const [query, setQuery] = useState("");
  // Service health and workspace usage are for platform administrators only (android round 7 C1, C7); the server checks again.
  const admin = useLoad(() => isPlatformAdmin(engine).catch(() => false), [engine]).data === true;
  const t = useT();
  const features = useOrbit((s) => s.server?.features ?? NO_FEATURES);
  const named = (list: PageEntry[]) => list.filter((p) => !p.features || p.features.some((f) => features.includes(f))).map((p) => ({ ...p, label: t(p.label) }));
  const groups: { title: string; pages: { key: SettingsPage; label: string; icon: React.ReactNode }[] }[] = [
    { title: t("settings_user_group"), pages: named(USER_PAGES) },
    { title: t("settings_app_group"), pages: named(APP_PAGES) },
    ...(admin
      ? [
          {
            title: "Administration",
            pages: [
              { key: "health" as const, label: "Service health", icon: <Activity size={17} /> },
              { key: "usage" as const, label: "Community usage", icon: <BarChart3 size={17} /> },
            ],
          },
        ]
      : []),
  ];
  const filtered = groups.map((g) => ({ ...g, pages: g.pages.filter((p) => matchesSetting(p.key, p.label, query)) })).filter((g) => g.pages.length);
  const scope = SETTINGS_INFO[page === "you" ? "profile" : page];
  return (
    <section className="main main-split" aria-label="Settings" style={{ display: "flex", flexDirection: "column" }}>
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
          <div className="settings-search">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              aria-label="Search settings"
              placeholder="Search settings"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setQuery("");
              }}
            />
            {query && (
              <button className="icon-btn" aria-label="Clear settings search" onClick={() => setQuery("")}>
                <X size={14} />
              </button>
            )}
          </div>
          {query && !filtered.length && (
            <p className="faint settings-search-empty" role="status">
              No settings found for “{query}”. Try a different word.
            </p>
          )}
          {filtered.map((g) => (
            <div key={g.title} role="group" aria-label={g.title} className="settings-nav-group">
              <div className="settings-nav-title">{g.title}</div>
              {g.pages.map((p) => (
                <button key={p.key} className="side-item" aria-current={page === p.key ? "page" : undefined} onClick={() => navigate({ section: "settings", settingsPage: p.key })}>
                  <span className="glyph">{p.icon}</span>
                  <span className="grow settings-search-result">
                    <span>{p.label}</span>
                    {query && <small>{SETTINGS_INFO[p.key]?.description}</small>}
                  </span>
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
          <div className={`inner${page === "mojo" || page === "spark" || page === "profile" ? " wide" : ""}`}>
            <button className="settings-back" aria-label="Back to settings" onClick={() => navigate({ section: "settings", settingsPage: "you" })}>
              <ChevronLeft size={18} aria-hidden="true" /> {t("nav_you")}
            </button>
            {scope && (
              <p className="settings-scope">
                {scope.scope}
                <span>{scope.description}</span>
              </p>
            )}
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
            {page === "mojo" && <MojoPage />}
            {page === "spark" && <SparkPage />}
            {page === "points" && <PointsPage />}
            {page === "creators" && <CreatorsPage />}
            {page === "developer" && <DeveloperPage />}
          </div>
        </div>
      </div>
    </section>
  );
}
