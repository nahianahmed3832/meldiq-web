import { text as uiText } from "../../i18n";
import type { LobbyBoard, LobbyLook, LobbySectionKey, LobbyTemplateKey } from "../../api/lobbySchemas";
import type { WorkspacePage } from "../../application/router";
/** The lobby's words and choices, in Meldiq's own voice (docs/MELDIQ_COMMUNITY_PARITY.md › Lobby live editor). */
/** What an empty card offers an editor: fill it in here ("card"), set it up elsewhere ("page"), or the feed URL. */
export type CardAction =
  | {
      kind: "card";
    }
  | {
      kind: "page";
      page: WorkspacePage;
    }
  | {
      kind: "feed";
    };
export interface SectionInfo {
  label: string;
  /** Shown to editors while the card is empty or quiet. */
  empty: string;
  cta: string | null;
  action: CardAction | null;
}
export const SECTION_INFO: Record<LobbySectionKey, SectionInfo> = {
  about: {
    get label() {
      return uiText("settings.settings_about");
    },
    get empty() {
      return uiText("workspace.interface.tell_newcomers_what_this_place_is_about_a88119b");
    },
    get cta() {
      return uiText("organization.interface.write_it_195e6a4");
    },
    action: { kind: "card" },
  },
  main_channels: {
    get label() {
      return uiText("workspace.interface.main_channels_272f38c");
    },
    get empty() {
      return uiText("workspace.interface.pick_the_channels_people_should_open_first_until_then_the_busiest_c32ccc4");
    },
    get cta() {
      return uiText("workspace.interface.pick_channels_bcea998");
    },
    action: { kind: "card" },
  },
  live_now: {
    get label() {
      return uiText("workspace.interface.live_now_96436bc");
    },
    get empty() {
      return uiText("workspace.interface.voice_rooms_with_people_in_them_show_here_128c812");
    },
    cta: null,
    action: null,
  },
  giveaways: {
    get label() {
      return uiText("workspace.interface.giveaways_8134d69");
    },
    get empty() {
      return uiText("workspace.interface.running_giveaways_show_here_once_a_giveaway_bot_is_running_560f9d3");
    },
    get cta() {
      return uiText("workspace.interface.open_bots_d5cec25");
    },
    action: { kind: "page", page: "bots" },
  },
  feed: {
    get label() {
      return uiText("workspace.interface.feed_396c3cb");
    },
    get empty() {
      return uiText("workspace.interface.posts_that_your_apps_send_to_the_lobby_s_feed_url_show_here_bb942a1");
    },
    get cta() {
      return uiText("workspace.interface.get_a_feed_url_71056de");
    },
    action: { kind: "feed" },
  },
  faq: {
    get label() {
      return uiText("workspace.interface.faq_dbc468a");
    },
    get empty() {
      return uiText("workspace.interface.answer_what_newcomers_ask_most_03df742");
    },
    get cta() {
      return uiText("workspace.interface.add_questions_f0690ee");
    },
    action: { kind: "card" },
  },
  leaderboard: {
    get label() {
      return uiText("workspace.interface.leaderboard_31b4712");
    },
    get empty() {
      return uiText("workspace.interface.the_most_active_people_show_here_once_there_s_activity_99d39e1");
    },
    cta: null,
    action: null,
  },
  pick_roles: {
    get label() {
      return uiText("workspace.interface.pick_your_roles_7327673");
    },
    get empty() {
      return uiText("workspace.interface.let_people_pick_roles_from_your_onboarding_questions_46d16f9");
    },
    get cta() {
      return uiText("workspace.interface.set_up_onboarding_a2651b4");
    },
    action: { kind: "page", page: "onboarding" },
  },
  rules: {
    get label() {
      return uiText("organization.rules_title");
    },
    get empty() {
      return uiText("workspace.interface.point_people_to_your_rules_channel_0d0ea13");
    },
    get cta() {
      return uiText("workspace.interface.pick_a_rules_channel_1344db7");
    },
    action: { kind: "page", page: "rules" },
  },
  who_runs_it: {
    get label() {
      return uiText("workspace.interface.who_runs_it_7fcc185");
    },
    get empty() {
      return uiText("workspace.interface.the_owner_and_moderators_show_here_53bed1d");
    },
    cta: null,
    action: null,
  },
  links: {
    get label() {
      return uiText("messaging.interface.links_9024c19");
    },
    get empty() {
      return uiText("workspace.interface.your_community_s_links_show_here_64a68dc");
    },
    get cta() {
      return uiText("workspace.interface.add_links_8d85c52");
    },
    action: { kind: "page", page: "overview" },
  },
};
export const BOARD_LABELS: Record<LobbyBoard, string> = {
  get levels() {
    return uiText("workspace.interface.levels_b148213");
  },
  get messages_week() {
    return uiText("workspace.interface.messages_this_week_81859b2");
  },
  get invites() {
    return uiText("workspace.interface.invites_f212a98");
  },
};
export interface TemplateInfo {
  key: LobbyTemplateKey;
  name: string;
  blurb: string;
  /** The thumbnail's colour bars, top to bottom. */
  bars: string[];
}
export const TEMPLATES: readonly TemplateInfo[] = [
  {
    key: "gaming",
    get name() {
      return uiText("organization.interface.gaming_0fadfa2");
    },
    get blurb() {
      return uiText("workspace.interface.live_rooms_up_top_leaderboards_on_the_side_3cb3364");
    },
    bars: ["#8b5cf6", "#22d3ee", "#6d28d9", "#a78bfa"],
  },
  {
    key: "study",
    get name() {
      return uiText("workspace.interface.study_3ff5620");
    },
    get blurb() {
      return uiText("workspace.interface.calm_and_easy_to_read_one_column_1d760e7");
    },
    bars: ["#4f7cac", "#cbd5e1", "#94a3b8", "#e2e8f0"],
  },
  {
    key: "creators",
    get name() {
      return uiText("settings.settings_creators");
    },
    get blurb() {
      return uiText("workspace.interface.a_big_banner_your_feed_and_links_first_b2ada59");
    },
    bars: ["#ec4899", "#f9a8d4", "#be185d", "#fbcfe8"],
  },
  {
    key: "hangout",
    get name() {
      return uiText("workspace.interface.hangout_5bf724b");
    },
    get blurb() {
      return uiText("workspace.interface.warm_colours_friendly_and_relaxed_dfa505a");
    },
    bars: ["#f59e0b", "#fdba74", "#ea580c", "#fde68a"],
  },
  {
    key: "minimal",
    get name() {
      return uiText("workspace.interface.minimal_057b5de");
    },
    get blurb() {
      return uiText("workspace.interface.just_the_essentials_nothing_extra_b99846f");
    },
    bars: ["#64748b", "#cbd5e1", "#94a3b8", "#e5e7eb"],
  },
];
export interface Choice<T extends string> {
  value: T;
  label: string;
}
export const LAYOUTS: readonly (Choice<LobbyLook["layout"]> & {
  hint: string;
})[] = [
  {
    value: "classic",
    get label() {
      return uiText("workspace.interface.classic_ae25d64");
    },
    get hint() {
      return uiText("workspace.interface.two_columns_ff4a013");
    },
  },
  {
    value: "spotlight",
    get label() {
      return uiText("workspace.interface.spotlight_fca7aa8");
    },
    get hint() {
      return uiText("workspace.interface.one_centred_column_8495994");
    },
  },
  {
    value: "magazine",
    get label() {
      return uiText("workspace.interface.magazine_9042ee8");
    },
    get hint() {
      return uiText("workspace.interface.big_hero_big_tiles_1435a05");
    },
  },
  {
    value: "compact",
    get label() {
      return uiText("workspace.interface.compact_9945264");
    },
    get hint() {
      return uiText("workspace.interface.dense_list_646e7cf");
    },
  },
];
export const BACKGROUNDS: readonly Choice<LobbyLook["background"]>[] = [
  {
    value: "glow",
    get label() {
      return uiText("workspace.interface.glow_f534ed9");
    },
  },
  {
    value: "mesh",
    get label() {
      return uiText("workspace.interface.mesh_f2b783e");
    },
  },
  {
    value: "banner_blur",
    get label() {
      return uiText("workspace.interface.banner_blur_f1e11dd");
    },
  },
  {
    value: "plain",
    get label() {
      return uiText("workspace.interface.plain_8b854ad");
    },
  },
];
export const CARD_STYLES: readonly Choice<LobbyLook["cards"]>[] = [
  {
    value: "filled",
    get label() {
      return uiText("workspace.interface.filled_3a1bc53");
    },
  },
  {
    value: "glass",
    get label() {
      return uiText("workspace.interface.glass_82c2681");
    },
  },
  {
    value: "outline",
    get label() {
      return uiText("workspace.interface.outline_eabbf3a");
    },
  },
];
export const FONTS: readonly Choice<LobbyLook["font"]>[] = [
  {
    value: "default",
    get label() {
      return uiText("settings.ap_default");
    },
  },
  {
    value: "rounded",
    get label() {
      return uiText("workspace.interface.rounded_0a62cd8");
    },
  },
  {
    value: "serif",
    get label() {
      return uiText("workspace.interface.serif_1b5e747");
    },
  },
  {
    value: "mono",
    get label() {
      return uiText("workspace.interface.mono_6f00156");
    },
  },
  {
    value: "display",
    get label() {
      return uiText("workspace.interface.display_34e108c");
    },
  },
];
export const BANNER_HEIGHTS: readonly Choice<LobbyLook["bannerHeight"]>[] = [
  {
    value: "tall",
    get label() {
      return uiText("workspace.interface.tall_0eeb780");
    },
  },
  {
    value: "normal",
    get label() {
      return uiText("workspace.interface.normal_a7248ee");
    },
  },
  {
    value: "short",
    get label() {
      return uiText("workspace.interface.short_f5d61ea");
    },
  },
];
export const TITLES: readonly Choice<LobbyLook["title"]>[] = [
  {
    value: "left",
    get label() {
      return uiText("workspace.interface.left_58eb903");
    },
  },
  {
    value: "centered",
    get label() {
      return uiText("workspace.interface.centred_4d244e6");
    },
  },
];
