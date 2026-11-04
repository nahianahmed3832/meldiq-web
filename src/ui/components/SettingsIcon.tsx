import { formatUiNumber } from "../../i18n/format";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { EmberIcon } from "./EmberIcon";
import { Icon, type IconName, type IconSize } from "../icons/Icon";

const settingsIcons = {
  account: "settings.account",
  profile: "settings.profile",
  security: "settings.security",
  devices: "settings.devices",
  mojo: "settings.membership",
  spark: "settings.spark",
  appearance: "settings.appearance",
  voice: "settings.voice",
  notifications: "settings.notifications",
  shortcuts: "settings.shortcuts",
  advanced: "settings.advanced",
  developer: "settings.developer",
  creators: "settings.creators",
  leaderboards: "settings.leaderboards",
  level: "settings.level",
  messages: "settings.messages",
  gifts: "settings.gifts",
  invites: "settings.invites",
} as const satisfies Record<string, IconName>;
export type SettingsSymbol = keyof typeof settingsIcons | "embers";
export function SettingsIcon({ name, size = 24 }: { name: SettingsSymbol; size?: number }) {
  if (name === "embers") return <EmberIcon size={size} />;
  const standardSize = [16, 18, 20, 24, 32].reduce((a, b) => (Math.abs(b - size) < Math.abs(a - size) ? b : a)) as IconSize;
  return <Icon name={settingsIcons[name]} size={standardSize} className={`meldiq-symbol symbol-${name}`} />;
}
/** A faceted Meldiq medal, with a rank that also makes tied podium places explicit. */
export function RankMedal({ rank }: { rank: number }) {
  useLocaleRender();
  return (
    <span className={`rank-medal medal-${Math.min(rank, 3)}`} aria-label={uiText("workspace.interface.rank_value0_f67e8ab", { value0: rank })}>
      <svg width="36" height="42" viewBox="0 0 36 42" aria-hidden="true">
        <path d="m8 1 6 1 4 13-7 3L8 1Zm20 0-6 1-4 13 7 3 3-17Z" fill="currentColor" opacity=".55" />
        <path d="m18 10 13 7v15l-13 8-13-8V17l13-7Z" fill="currentColor" />
        <path d="m18 14 9 5v11l-9 6-9-6V19l9-5Z" fill="none" stroke="currentColor" className="medal-inset" />
      </svg>
      <b aria-hidden="true">{formatUiNumber(rank)}</b>
    </span>
  );
}
