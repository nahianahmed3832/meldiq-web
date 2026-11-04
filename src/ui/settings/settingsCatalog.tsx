import { Accessibility, Activity, BarChart3, CreditCard, Gift, HardDrive, Info, Languages } from "lucide-react";
import type { SettingsPage } from "../../application/router";
import { text as t, type MessageKey } from "../../i18n";
import { SettingsIcon } from "../components/SettingsIcon";
import type { SettingsGroup } from "../components/SettingsNavigation";
import { SETTINGS_INFO } from "./settingsSearch";

type Entry = { key: SettingsPage; labelKey: MessageKey; icon: React.ReactNode; features?: readonly string[]; admin?: boolean };
const pages: readonly Entry[] = [
  { key: "account", labelKey: "settings.settings_account", icon: <SettingsIcon name="account" /> },
  { key: "profile", labelKey: "settings.settings_profile", icon: <SettingsIcon name="profile" /> },
  { key: "security", labelKey: "settings.settings_security", icon: <SettingsIcon name="security" /> },
  { key: "devices", labelKey: "settings.navigation.devices", icon: <SettingsIcon name="devices" /> },
  { key: "notifications", labelKey: "settings.notifications", icon: <SettingsIcon name="notifications" /> },
  { key: "appearance", labelKey: "settings.appearance", icon: <SettingsIcon name="appearance" /> },
  { key: "calls", labelKey: "settings.settings_calls", icon: <SettingsIcon name="voice" /> },
  { key: "accessibility", labelKey: "settings.navigation.accessibility", icon: <Accessibility size={18} /> },
  { key: "language", labelKey: "common.language.label", icon: <Languages size={18} /> },
  { key: "shortcuts", labelKey: "settings.settings_shortcuts", icon: <SettingsIcon name="shortcuts" /> },
  { key: "mojo", labelKey: "settings.settings_mojo", icon: <SettingsIcon name="mojo" /> },
  { key: "billing", labelKey: "billing.interface.billing_purchases_3a698f7", icon: <CreditCard size={18} /> },
  { key: "gifts", labelKey: "settings.gifts", icon: <Gift size={18} /> },
  { key: "spark", labelKey: "settings.settings_spark", icon: <SettingsIcon name="spark" /> },
  { key: "leaderboards", labelKey: "settings.settings_leaderboards", icon: <SettingsIcon name="leaderboards" /> },
  { key: "points", labelKey: "settings.settings_points", icon: <SettingsIcon name="embers" />, features: ["points"] },
  { key: "advanced", labelKey: "settings.settings_advanced", icon: <SettingsIcon name="advanced" /> },
  { key: "developer", labelKey: "settings.settings_developer", icon: <SettingsIcon name="developer" />, features: ["bots", "oauth-apps"] },
  { key: "creators", labelKey: "settings.settings_creators", icon: <SettingsIcon name="creators" />, features: ["creator-program"] },
  { key: "storage", labelKey: "settings.settings_storage", icon: <HardDrive size={18} /> },
  { key: "about", labelKey: "settings.settings_about", icon: <Info size={18} /> },
  { key: "health", labelKey: "admin.health", icon: <Activity size={18} />, admin: true },
  { key: "usage", labelKey: "admin.usage", icon: <BarChart3 size={18} />, admin: true },
];
const sections: readonly { key: string; labelKey: MessageKey; pages: readonly SettingsPage[] }[] = [
  { key: "personal", labelKey: "settings.navigation.personal", pages: ["account", "profile", "security", "devices"] },
  { key: "preferences", labelKey: "settings.navigation.preferences", pages: ["notifications", "appearance", "calls", "accessibility", "language", "shortcuts"] },
  { key: "billing", labelKey: "settings.navigation.billing", pages: ["mojo", "billing", "gifts", "spark"] },
  { key: "programs", labelKey: "settings.navigation.programs", pages: ["leaderboards", "points", "advanced", "developer", "creators"] },
  { key: "support", labelKey: "settings.navigation.support", pages: ["storage", "about"] },
  { key: "admin", labelKey: "admin.title", pages: ["health", "usage"] },
];
export function personalSettingsGroups(features: readonly string[], admin: boolean): SettingsGroup<SettingsPage>[] {
  return sections
    .map((group) => ({
      key: group.key,
      title: t(group.labelKey),
      pages: group.pages.flatMap((key) => {
        const p = pages.find((p) => p.key === key)!;
        if ((p.admin && !admin) || (p.features && !p.features.some((f) => features.includes(f)))) return [];
        const info = SETTINGS_INFO[key];
        return [{ key, label: t(p.labelKey), icon: p.icon, description: info?.description, keywords: `${info?.keywords ?? ""} ${info?.scope ?? ""}` }];
      }),
    }))
    .filter((g) => g.pages.length);
}
/** Rendering and navigation use exactly the same availability rules, including direct links. */
export function personalSettingsAvailable(page: SettingsPage, features: readonly string[], admin: boolean): boolean {
  if (page === "you") return true;
  const key = page === "checkout" ? "billing" : page;
  return personalSettingsGroups(features, admin).some((g) => g.pages.some((p) => p.key === key));
}
