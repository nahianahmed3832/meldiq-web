import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useAccountActions } from "../shell/AccountActions";
import { ArrowRightLeft, LogOut, Bookmark, ChevronLeft, ChevronRight, Laptop } from "lucide-react";
import { useState } from "react";
import { SETTINGS_INFO } from "./settingsSearch";
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
import { useT } from "../../i18n";
import { YouCard } from "./YouCard";
import { InstallButton } from "./InstallButton";
import { CheckoutPage } from "../billing/CheckoutPage";
import { GiftsPage } from "../billing/GiftsPage";
import { BillingPage } from "../billing/BillingPage";
import { MojoPage } from "../mojo/MojoPage";
import { SparkPage } from "../mojo/SparkPage";
import { PointsPage } from "../points/PointsPage";
import { SettingsNavigation, SettingsUnavailable } from "../components/SettingsNavigation";
import { personalSettingsAvailable, personalSettingsGroups } from "./settingsCatalog";
import { AccessibilityPage, LanguagePage } from "./SpecializedPages";
import { StoragePage } from "./StoragePage";
import { LeaderboardsPage } from "../leaderboards/LeaderboardsPage";
import { CreatorsPage } from "../creators/CreatorsPage";
import { DeveloperPage } from "../developer/DeveloperPage";
const NO_FEATURES: string[] = [];
export function SettingsView({ page: requestedPage, onSignedOut }: { page: SettingsPage; onSignedOut: () => void }) {
  useLocaleRender();
  const page = requestedPage;
  const engine = useEngine();
  const accountAction = useAccountActions();
  const [query, setQuery] = useState("");
  // Service health and workspace usage are for platform administrators only (android round 7 C1, C7); the server checks again.
  const administration = useLoad(() => isPlatformAdmin(engine).catch(() => false), [engine]);
  const admin = administration.data === true;
  const t = useT();
  const features = useOrbit((s) => s.server?.features ?? NO_FEATURES);
  const serverKnown = useOrbit((s) => s.server !== null);
  const loadingAccess = !serverKnown || ((page === "health" || page === "usage") && administration.loading);
  const groups = personalSettingsGroups(features, admin);
  const available = personalSettingsAvailable(page, features, admin);
  const scope = SETTINGS_INFO[page === "you" ? "profile" : page];
  return (
    <section className="main main-split" aria-label={t("settings.title")} style={{ display: "flex", flexDirection: "column" }}>
      <div className={`settings user-settings${page === "you" ? " at-you" : ""}`}>
        <nav className="settings-nav" aria-label={uiText("settings.interface.settings_pages_05ec055")}>
          <div className="settings-brand not-phone">
            <img src="/meldling-96.webp" width={28} height={28} alt="" />
            <span>
              Meldiq{" "}
              <small>
                <Localized k="settings.interface.your_space_your_way_fe82363" />
              </small>
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
          <SettingsNavigation
            groups={groups}
            current={page === "you" ? "profile" : page === "checkout" ? "billing" : page}
            query={query}
            onQuery={setQuery}
            label={uiText("settings.interface.search_settings_255b076")}
            onSelect={(key) => navigate({ section: "settings", settingsPage: key })}
          />
          <div className="settings-account-actions">
            <button className="side-item" onClick={() => accountAction("switch")}>
              <span className="glyph">
                <ArrowRightLeft size={17} />
              </span>
              <span>
                <Localized k="settings.interface.switch_account_fedce01" />
              </span>
            </button>
            <button className="side-item settings-logout" onClick={() => accountAction("logout")}>
              <span className="glyph">
                <LogOut size={17} />
              </span>
              <span>
                <Localized k="settings.interface.log_out_4961614" />
              </span>
            </button>
            <button className="side-item not-phone" onClick={() => navigate({ section: "home" })}>
              <span className="glyph">
                <Laptop size={17} />
              </span>
              <span>{t("messaging.conv_back")}</span>
            </button>
          </div>
        </nav>
        <div className="settings-page scroll">
          <div key={page} className={`inner${page === "leaderboards" || page === "mojo" || page === "spark" || page === "profile" || page === "billing" || page === "checkout" ? " wide" : ""}`}>
            <button className="settings-back" aria-label={uiText("settings.interface.back_to_settings_dc9c609")} onClick={() => navigate({ section: "settings", settingsPage: "you" })}>
              <ChevronLeft size={18} aria-hidden="true" /> {t("nav_you")}
            </button>
            {scope && (
              <p className={`settings-scope${page === "profile" || page === "you" || page === "leaderboards" ? " sr-only" : ""}`}>
                {scope.scope}
                <span>{scope.description}</span>
              </p>
            )}
            {!available && (loadingAccess ? <div className="skeleton" aria-busy="true" style={{ height: 160 }} /> : <SettingsUnavailable />)}
            {available && (
              <>
                {(page === "profile" || page === "you") && <ProfilePage />}
                {page === "account" && <AccountSettingsPage onSignedOut={onSignedOut} />}
                {page === "devices" && <DevicesPage onSignedOut={onSignedOut} />}
                {page === "notifications" && <NotificationsPage />}
                {page === "calls" && <CallsPage />}
                {page === "appearance" && <AppearancePage />}
                {page === "accessibility" && <AccessibilityPage />}
                {page === "language" && <LanguagePage />}
                {page === "storage" && <StoragePage />}
                {page === "about" && <AboutPage />}
                {page === "security" && <SecurityPage />}
                {page === "advanced" && <AdvancedPage />}
                {page === "shortcuts" && <ShortcutsPage />}
                {page === "health" && <ServiceHealthPage />}
                {page === "usage" && <AdminUsagePage />}
                {page === "checkout" && <CheckoutPage />}
                {page === "billing" && <BillingPage />}
                {page === "gifts" && <GiftsPage />}
                {page === "mojo" && <MojoPage />}
                {page === "spark" && <SparkPage />}
                {page === "leaderboards" && <LeaderboardsPage />}
                {page === "points" && <PointsPage />}
                {page === "creators" && <CreatorsPage />}
                {page === "developer" && <DeveloperPage />}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
