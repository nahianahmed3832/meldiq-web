import { text as uiText } from "../../i18n";
import type { SettingsPage } from "../../application/router";
type SettingInfo = {
  scope: string;
  description: string;
  keywords: string;
};
/** Search routes to the existing settings pages; availability is filtered by the caller's features and permissions. */
export const SETTINGS_INFO: Partial<Record<SettingsPage, SettingInfo>> = {
  account: {
    scope: "Your account",
    get description() {
      return uiText("settings.interface.email_password_and_account_recovery_d701c4f");
    },
    keywords: "login sign in delete recovery codes google apple discord connected accounts",
  },
  profile: {
    scope: "Your global profile",
    get description() {
      return uiText("settings.interface.avatar_banner_name_style_decoration_and_bio_e335b90");
    },
    keywords: "photo picture pronouns badge tag identity color colour font animation",
  },
  security: {
    scope: "Your account",
    get description() {
      return uiText("settings.interface.privacy_encryption_and_account_protection_bec055a");
    },
    keywords: "keys recovery safety block passkey",
  },
  devices: {
    scope: "Your account",
    get description() {
      return uiText("settings.interface.manage_signed_in_devices_and_link_a_browser_7030ae7");
    },
    keywords: "sessions phone approve sign out",
  },
  gifts: {
    scope: "Your account",
    get description() {
      return uiText("settings.interface.send_receive_and_redeem_plus_gifts_615c2bd");
    },
    keywords: "gift friend email link present credit redeem",
  },
  mojo: {
    scope: "Your account",
    get description() {
      return uiText("settings.interface.meldiq_plus_plans_benefits_and_gifts_9f17a89");
    },
    keywords: "subscription plus free billing payment upload limit",
  },
  spark: {
    scope: "Community boosts",
    get description() {
      return uiText("settings.interface.manage_sparks_and_community_benefits_2a334dc");
    },
    keywords: "boost level subscription",
  },
  appearance: {
    get scope() {
      return uiText("settings.interface.this_browser_101f4d9");
    },
    get description() {
      return uiText("settings.interface.themes_colors_text_size_and_message_layout_f30d673");
    },
    get keywords() {
      return uiText("settings.interface.colour_color_font_dark_light_contrast_background_language_emoji_a_65ff089");
    },
  },
  calls: {
    get scope() {
      return uiText("settings.interface.this_browser_101f4d9");
    },
    get description() {
      return uiText("settings.interface.microphone_speakers_and_voice_controls_f296854");
    },
    get keywords() {
      return uiText("settings.interface.audio_sound_video_input_output_noise_echo_push_to_talk_screen_sha_39c2ec7");
    },
  },
  notifications: {
    get scope() {
      return uiText("settings.interface.this_browser_101f4d9");
    },
    get description() {
      return uiText("settings.interface.desktop_alerts_sounds_read_receipts_and_typing_237db41");
    },
    get keywords() {
      return uiText("settings.interface.mute_chime_volume_privacy_unread_mentions_groups_ringtone_1680cbe");
    },
  },
  shortcuts: {
    get scope() {
      return uiText("settings.interface.this_browser_101f4d9");
    },
    get description() {
      return uiText("settings.interface.keyboard_shortcuts_and_key_bindings_c36cfd7");
    },
    get keywords() {
      return uiText("settings.interface.hotkeys_keyboard_navigation_64f716e");
    },
  },
  leaderboards: {
    get scope() {
      return uiText("settings.interface.meldiq_community_0de29a7");
    },
    get description() {
      return uiText("settings.interface.rankings_levels_and_community_milestones_005c502");
    },
    get keywords() {
      return uiText("settings.interface.leaderboard_podium_rank_trophy_messages_voice_embers_gifts_invite_95623ef");
    },
  },
  points: {
    get scope() {
      return uiText("settings.interface.your_account_dbb5f63");
    },
    get description() {
      return uiText("settings.interface.embers_achievements_and_account_levels_7e9da0b");
    },
    get keywords() {
      return uiText("settings.interface.xp_rewards_progress_points_quests_badges_milestones_5efca48");
    },
  },
  advanced: {
    get scope() {
      return uiText("settings.interface.this_browser_101f4d9");
    },
    get description() {
      return uiText("settings.interface.builder_mode_and_trusted_sites_fc4324c");
    },
    get keywords() {
      return uiText("settings.interface.developer_copy_id_links_privacy_4f84d6f");
    },
  },
  developer: {
    get scope() {
      return uiText("settings.interface.your_account_dbb5f63");
    },
    get description() {
      return uiText("settings.interface.bots_and_log_in_with_meldiq_apps_b86d293");
    },
    get keywords() {
      return uiText("settings.interface.oauth_token_application_client_api_d139446");
    },
  },
  creators: {
    get scope() {
      return uiText("settings.interface.your_account_dbb5f63");
    },
    get description() {
      return uiText("settings.interface.creator_programme_and_submissions_fa001fe");
    },
    get keywords() {
      return uiText("settings.interface.art_decoration_publish_84c57b5");
    },
  },
  storage: {
    get scope() {
      return uiText("settings.interface.your_storage_1bd61bf");
    },
    get description() {
      return uiText("settings.interface.files_downloads_and_storage_usage_b9402c9");
    },
    get keywords() {
      return uiText("settings.interface.media_attachments_cache_space_1eea8e8");
    },
  },
  about: {
    scope: "Meldiq Web",
    get description() {
      return uiText("settings.interface.version_updates_and_installation_9c61508");
    },
    get keywords() {
      return uiText("settings.interface.help_install_app_introduction_release_8b94dcd");
    },
  },
  health: {
    get scope() {
      return uiText("settings.interface.platform_administration_9216e23");
    },
    get description() {
      return uiText("settings.interface.service_health_and_diagnostics_47b17ec");
    },
    get keywords() {
      return uiText("settings.interface.server_status_errors_905a13d");
    },
  },
  usage: {
    get scope() {
      return uiText("settings.interface.platform_administration_9216e23");
    },
    get description() {
      return uiText("settings.interface.community_usage_and_limits_375fc8e");
    },
    get keywords() {
      return uiText("settings.interface.admin_quota_7b1a2ba");
    },
  },
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
