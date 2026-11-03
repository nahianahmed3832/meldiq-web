import { text as uiText } from "../../i18n";
import type { PointsHistoryRow, Quest } from "../../sync/points";
/**
 * What the points page calls things (API 0.65.0). The server sends quest ids and ledger kinds; the words are Meldiq's
 * own. The base amounts below are the server's rules (docs/SETTINGS_PARITY_API.md), shown before Meldiq Plus's 1.5×.
 */
export const EARN = { visit: 5, streak: 30, streakDays: 7, chatPoints: 5, chatMinutes: 5, invite: 100, inviteDays: 7 } as const;
/** Each quest's task: with its goal on the quest list, and as a short name in the history. */
const QUESTS: Record<
  string,
  {
    task: (goal: number) => string;
    name: string;
  }
> = {
  "daily-chats": {
    task: (n) => uiText("workspace.interface.talk_in_value0_different_chats_e36d633", { value0: n }),
    get name() {
      return uiText("workspace.interface.talk_in_different_chats_80bb54f");
    },
  },
  "daily-reactions": {
    task: (n) => uiText("workspace.interface.react_to_value0_messages_from_other_people_08803c9", { value0: n }),
    get name() {
      return uiText("workspace.interface.react_to_messages_db29f16");
    },
  },
  "daily-reply": {
    task: () => uiText("workspace.interface.reply_to_someone_else_s_message_43de6ec"),
    get name() {
      return uiText("workspace.interface.reply_to_someone_84824c0");
    },
  },
  profile: {
    task: () => uiText("workspace.interface.add_a_profile_picture_and_an_about_me_3967e84"),
    get name() {
      return uiText("workspace.interface.profile_picture_and_about_me_db39e94");
    },
  },
  friend: {
    task: () => uiText("workspace.interface.make_a_friend_e443ea0"),
    get name() {
      return uiText("workspace.interface.make_a_friend_e443ea0");
    },
  },
  communities: {
    task: (n) => uiText("workspace.interface.join_value0_communities_3ba10f7", { value0: n }),
    get name() {
      return uiText("workspace.interface.join_communities_c3f7802");
    },
  },
  decoration: {
    task: () => uiText("workspace.interface.wear_an_avatar_decoration_52561d0"),
    get name() {
      return uiText("workspace.interface.wear_a_decoration_cd04004");
    },
  },
  "two-step": {
    task: () => uiText("workspace.interface.turn_on_two_step_sign_in_01393b9"),
    get name() {
      return uiText("workspace.interface.two_step_sign_in_cd5a53d");
    },
  },
  "daily-active": {
    task: (n) => uiText("workspace.interface.chat_during_value0_different_active_minutes_cea2ecb", { value0: n }),
    get name() {
      return uiText("workspace.interface.keep_the_conversation_going_4656fe2");
    },
  },
  "daily-appreciation": {
    task: (n) => uiText("workspace.interface.appreciate_value0_messages_from_other_people_d2adac5", { value0: n }),
    get name() {
      return uiText("workspace.interface.share_some_appreciation_b7e0811");
    },
  },
  "daily-thoughtful": {
    task: (n) => uiText("workspace.interface.reply_thoughtfully_to_value0_different_messages_637d9a1", { value0: n }),
    get name() {
      return uiText("workspace.interface.thoughtful_replies_eb4ecbe");
    },
  },
  "daily-conversations": {
    task: (n) => uiText("workspace.interface.join_the_conversation_in_value0_different_chats_62f72f5", { value0: n }),
    get name() {
      return uiText("workspace.interface.make_the_rounds_0737e3a");
    },
  },
  avatar: {
    task: () => uiText("workspace.interface.choose_a_profile_picture_bd3c06e"),
    get name() {
      return uiText("workspace.interface.a_face_to_remember_24e1c35");
    },
  },
  bio: {
    task: () => uiText("workspace.interface.write_your_about_me_ea6d8b6"),
    get name() {
      return uiText("workspace.interface.tell_your_story_875d136");
    },
  },
  banner: {
    task: () => uiText("workspace.interface.add_a_profile_banner_f8e467f"),
    get name() {
      return uiText("workspace.interface.set_the_scene_f774139");
    },
  },
  pronouns: {
    task: () => uiText("workspace.interface.add_your_pronouns_if_you_d_like_to_share_them_69a3af1"),
    get name() {
      return uiText("workspace.interface.introduce_yourself_d0247b1");
    },
  },
  "first-community": {
    task: () => uiText("workspace.interface.join_your_first_community_6b0c117"),
    get name() {
      return uiText("workspace.interface.find_your_campfire_07ccc1d");
    },
  },
  "community-explorer": {
    task: (n) => uiText("workspace.interface.explore_value0_communities_78a73cb", { value0: n }),
    get name() {
      return uiText("workspace.interface.explore_together_5e2084c");
    },
  },
  "close-circle": {
    task: (n) => uiText("workspace.interface.make_value0_connections_e006d1b", { value0: n }),
    get name() {
      return uiText("workspace.interface.build_your_circle_6933091");
    },
  },
};
/** An id this version doesn't know, read as words ("new-quest" → "New quest"). */
const fromId = (id: string): string => id.replace(/[-_]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());
/** A quest's task in a few words. */
export function questLabel(q: Pick<Quest, "id" | "goal">): string {
  return QUESTS[q.id]?.task(q.goal) ?? fromId(q.id);
}
/** A history row's line: what earned or spent it. */
export function historyLabel(row: Pick<PointsHistoryRow, "kind" | "detail">): string {
  switch (row.kind) {
    case "visit":
      return uiText("workspace.interface.daily_visit_eeb5e20");
    case "streak":
      return uiText("workspace.interface.7_day_streak_e5e03c3");
    case "chat":
      return uiText("workspace.interface.chatting_7bc1daa");
    case "invite":
      return uiText("workspace.interface.someone_you_invited_stayed_e25cf43");
    case "quest":
      return row.detail ? uiText("workspace.interface.quest_value0_852601c", { value0: QUESTS[row.detail]?.name ?? fromId(row.detail) }) : uiText("workspace.interface.quest_2332591");
    case "level":
      return row.detail ? uiText("workspace.interface.reached_level_value0_cae28ab", { value0: row.detail }) : uiText("workspace.interface.level_up_46538b5");
    default:
      return uiText("settings.settings_points");
  }
}
/** "+5", "−100": the sign always shown. */
export const signed = (n: number): string => (n < 0 ? `−${Math.abs(n)}` : `+${n}`);
/** How far towards the next level, 0–1. */
export const levelProgress = (balance: number, cost: number): number => (cost > 0 ? Math.min(1, Math.max(0, balance / cost)) : 0);
/** The days of the current 7-day run already visited (0–7; a full week shows full until the next day starts a new one). */
export function streakInWeek(streak: number): number {
  if (streak <= 0) return 0;
  const r = streak % EARN.streakDays;
  return r === 0 ? EARN.streakDays : r;
}
