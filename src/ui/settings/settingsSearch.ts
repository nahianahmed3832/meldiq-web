import type { SettingsPage } from "../../application/router";

type SettingInfo = { scope: string; description: string; keywords: string };
/** Search routes to the existing settings pages; availability is filtered by the caller's features and permissions. */
export const SETTINGS_INFO: Partial<Record<SettingsPage, SettingInfo>> = {
  account: { scope: "Your account", description: "Email, password and account recovery", keywords: "login sign in delete recovery codes" },
  profile: { scope: "Your global profile", description: "Avatar, banner, name style, decoration and bio", keywords: "photo picture pronouns badge tag identity color colour font animation" },
  security: { scope: "Your account", description: "Privacy, encryption and account protection", keywords: "keys recovery safety block passkey" },
  devices: { scope: "Your account", description: "Manage signed-in devices and link a browser", keywords: "sessions phone approve sign out" },
  mojo: { scope: "Your account", description: "Mojo plans, benefits and gifts", keywords: "subscription plus free billing payment upload limit" },
  spark: { scope: "Community boosts", description: "Manage Sparks and community benefits", keywords: "boost level subscription" },
  appearance: {
    scope: "This browser",
    description: "Themes, colors, text size and message layout",
    keywords: "colour color font dark light contrast background language emoji animation bubbles photo gestures reaction density spacing motion accessibility",
  },
  calls: { scope: "This browser", description: "Microphone, speakers and voice controls", keywords: "audio sound video input output noise echo push to talk screen share" },
  notifications: { scope: "This browser", description: "Desktop alerts, sounds, read receipts and typing", keywords: "mute chime volume privacy unread mentions groups ringtone" },
  shortcuts: { scope: "This browser", description: "Keyboard shortcuts and key bindings", keywords: "hotkeys keyboard navigation" },
  leaderboards: { scope: "Meldiq community", description: "Rankings, levels and community milestones", keywords: "leaderboard podium rank trophy messages voice embers gifts invites top" },
  points: { scope: "Your account", description: "Embers, achievements and account levels", keywords: "xp rewards progress points quests badges milestones" },
  advanced: { scope: "This browser", description: "Builder mode and trusted sites", keywords: "developer copy id links privacy" },
  developer: { scope: "Your account", description: "Bots and Log in with Meldiq apps", keywords: "oauth token application client api" },
  creators: { scope: "Your account", description: "Creator programme and submissions", keywords: "art decoration publish" },
  storage: { scope: "Your storage", description: "Files, downloads and storage usage", keywords: "media attachments cache space" },
  about: { scope: "Meldiq Web", description: "Version, updates and installation", keywords: "help install app introduction release" },
  health: { scope: "Platform administration", description: "Service health and diagnostics", keywords: "server status errors" },
  usage: { scope: "Platform administration", description: "Community usage and limits", keywords: "admin quota" },
};

const normalize = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export function matchesSetting(key: SettingsPage, label: string, query: string): boolean {
  const info = SETTINGS_INFO[key];
  const text = normalize([label, info?.scope, info?.description, info?.keywords].join(" "));
  return normalize(query)
    .trim()
    .split(/\s+/)
    .every((word) => text.includes(word));
}
