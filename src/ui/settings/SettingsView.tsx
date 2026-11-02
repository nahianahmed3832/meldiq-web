import { useAccountActions } from "../shell/AccountActions";
import { ArrowRightLeft, LogOut, Activity, BarChart3, Bookmark, ChevronLeft, ChevronRight, Laptop, Search, X } from "lucide-react";
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
import { AppearancePage, NotificationsPage } from "./PreferencePages";
import { AccountSettingsPage } from "./AccountSettingsPage";
import { DevicesPage, SecurityPage } from "./AccountPages";
import { ProfilePage } from "./ProfilePage";
import { type StringKey, useT } from "../../i18n";
import { YouCard } from "./YouCard";
import { InstallButton } from "./InstallButton";
import { CheckoutPage } from "../billing/CheckoutPage";
import { BillingPage } from "../billing/BillingPage";
import { MojoPage } from "../mojo/MojoPage";
import { SparkPage } from "../mojo/SparkPage";
import { PointsPage } from "../points/PointsPage";
import { SettingsIcon } from "../components/SettingsIcon";
import { LeaderboardsPage } from "../leaderboards/LeaderboardsPage";
import { CreatorsPage } from "../creators/CreatorsPage";
import { DeveloperPage } from "../developer/DeveloperPage";

/** [features]: the page shows when the server has any of them. */
type PageEntry = { key: SettingsPage; label: StringKey; icon: React.ReactNode; features?: string[] };
const NO_FEATURES: string[] = [];

/** The reference's two groups (2026-10-28): you and your account, then how the app looks and behaves here. */
const USER_PAGES: PageEntry[] = [
  { key: "account", label: "settings_account", icon: <SettingsIcon name="account" /> },
  { key: "profile", label: "settings_profile", icon: <SettingsIcon name="profile" /> },
  { key: "security", label: "settings_security", icon: <SettingsIcon name="security" /> },
  { key: "devices", label: "settings_devices", icon: <SettingsIcon name="devices" /> },
  // Meldiq Plus (server docs/MOJO.md): with the account, not pushed anywhere else.
  { key: "mojo", label: "settings_mojo", icon: <SettingsIcon name="mojo" /> },
  // Meldiq Spark: its own page (2026-10-28), boosting the communities you love.
  { key: "spark", label: "settings_spark", icon: <SettingsIcon name="spark" /> },
];
const APP_PAGES: PageEntry[] = [
  { key: "appearance", label: "settings_appearance", icon: <SettingsIcon name="appearance" /> },
  { key: "calls", label: "settings_calls", icon: <SettingsIcon name="voice" /> },
  { key: "notifications", label: "settings_notifications", icon: <SettingsIcon name="notifications" /> },
  { key: "shortcuts", label: "settings_shortcuts", icon: <SettingsIcon name="shortcuts" /> },
  // API 0.65.0: points, quests and account levels (Gem is Spark's).
  { key: "leaderboards", label: "settings_leaderboards", icon: <SettingsIcon name="leaderboards" /> },
  { key: "points", label: "settings_points", icon: <SettingsIcon name="embers" />, features: ["points"] },
  { key: "advanced", label: "settings_advanced", icon: <SettingsIcon name="advanced" /> },
  // API 0.65.0 batch B: bots and "Log in with Meldiq" apps.
  { key: "developer", label: "settings_developer", icon: <SettingsIcon name="developer" />, features: ["bots", "oauth-apps"] },
  // API 0.65.0 batch B: the creator programme.
  { key: "creators", label: "settings_creators", icon: <SettingsIcon name="creators" />, features: ["creator-program"] },
];

export function SettingsView({ page: requestedPage, onSignedOut }: { page: SettingsPage; onSignedOut: () => void }) {
  const page = requestedPage === "storage" || requestedPage === "about" ? "profile" : requestedPage;
  const engine = useEngine();
  const accountAction = useAccountActions();
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
      <div className={`settings user-settings${page === "you" ? " at-you" : ""}`}>
        <nav className="settings-nav" aria-label="Settings pages">
          <div className="settings-brand not-phone">
            <img src="/meldling-96.webp" width={28} height={28} alt="" />
            <span>
              Meldiq <small>Your space, your way</small>
            </span>
          </div>
          <h2 className="you-only">{t("settings_title")}</h2>
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
              onKeyDownCapture={(e) => {
                if (e.key === "Escape" && query) {
                  e.preventDefault();
                  e.stopPropagation();
                  setQuery("");
                }
              }}
            />
            {query && (
              <button className="icon-btn" aria-label="Clear settings search" onClick={() => setQuery("")}>
                <X size={14} />
              </button>
            )}
          </div>
          <div className="settings-nav-pages">
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
          </div>
          <div className="settings-account-actions">
            <button className="side-item" onClick={() => accountAction("switch")}>
              <span className="glyph">
                <ArrowRightLeft size={17} />
              </span>
              <span>Switch account</span>
            </button>
            <button className="side-item settings-logout" onClick={() => accountAction("logout")}>
              <span className="glyph">
                <LogOut size={17} />
              </span>
              <span>Log out</span>
            </button>
            <button className="side-item not-phone" onClick={() => navigate({ section: "home" })}>
              <span className="glyph">
                <Laptop size={17} />
              </span>
              <span>Back to conversations</span>
            </button>
          </div>
        </nav>
        <div className="settings-page scroll">
          <div className={`inner${page === "leaderboards" || page === "mojo" || page === "spark" || page === "profile" || page === "billing" || page === "checkout" ? " wide" : ""}`}>
            <button className="settings-back" aria-label="Back to settings" onClick={() => navigate({ section: "settings", settingsPage: "you" })}>
              <ChevronLeft size={18} aria-hidden="true" /> {t("nav_you")}
            </button>
            {scope && (
              <p className={`settings-scope${page === "profile" || page === "you" || page === "leaderboards" ? " sr-only" : ""}`}>
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
            {page === "security" && <SecurityPage onSignedOut={onSignedOut} />}
            {page === "advanced" && <AdvancedPage />}
            {page === "shortcuts" && <ShortcutsPage />}
            {page === "health" && <ServiceHealthPage />}
            {page === "usage" && <AdminUsagePage />}
            {page === "checkout" && <CheckoutPage />}
            {page === "billing" && <BillingPage />}
            {page === "mojo" && <MojoPage />}
            {page === "spark" && <SparkPage />}
            {page === "leaderboards" && <LeaderboardsPage />}
            {page === "points" && <PointsPage />}
            {page === "creators" && <CreatorsPage />}
            {page === "developer" && <DeveloperPage />}
          </div>
        </div>
      </div>
    </section>
  );
}
