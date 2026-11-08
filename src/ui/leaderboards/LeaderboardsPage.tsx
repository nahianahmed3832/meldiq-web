import { formatUnit } from "../../i18n/format";
import { formatUiNumber } from "../../i18n/format";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { interfaceLocale } from "../../i18n/format";
import { useT as useLocalization } from "../../i18n";
import { RefreshCw } from "lucide-react";
import { useRef, useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { navigate } from "../../application/router";
import { LEADERBOARD_METRICS, loadLeaderboard, type LeaderboardEntry, type LeaderboardMetric } from "../../sync/leaderboards";
import { SettingsIcon, RankMedal } from "../components/SettingsIcon";
import { StyledAvatar } from "../people/ProfileStyle";
import { OPEN_PROFILE_EVENT } from "../people/ProfileDialog";
import { useLoad } from "../workspace/useLoad";
export const BOARD_INFO: Record<
  LeaderboardMetric,
  {
    label: string;
    description: string;
    empty: string;
  }
> = {
  level: {
    get label() {
      return uiText("workspace.interface.level_1709305");
    },
    get description() {
      return uiText("workspace.interface.the_next_chapter_starts_with_you_meet_meldiq_s_highest_account_le_45943b2");
    },
    get empty() {
      return uiText("workspace.interface.automatic_rank_level_empty");
    },
  },
  messages: {
    get label() {
      return uiText("workspace.nav_messages");
    },
    get description() {
      return uiText("workspace.interface.keeping_the_conversation_going_one_message_at_a_time_4fd7f24");
    },
    get empty() {
      return uiText("workspace.interface.rank_messages_empty");
    },
  },
  voice: {
    get label() {
      return uiText("auth.interface.voice_87bf2bc");
    },
    get description() {
      return uiText("workspace.interface.rank_voice_description");
    },
    get empty() {
      return uiText("workspace.interface.rank_voice_empty");
    },
  },
  embers: {
    get label() {
      return uiText("settings.settings_points");
    },
    get description() {
      return uiText("workspace.interface.a_little_warmth_goes_a_long_way_the_most_embers_earned_ever_796bf51");
    },
    get empty() {
      return uiText("workspace.interface.the_first_sparks_are_still_ahead_complete_quests_and_check_in_to_4677b32");
    },
  },
  gifts: {
    get label() {
      return uiText("workspace.interface.gifts_67a025d");
    },
    get description() {
      return uiText("workspace.interface.for_the_people_who_brighten_someone_else_s_day_verified_meldiq_pl_003b7d6");
    },
    get empty() {
      return uiText("workspace.interface.the_first_gift_is_yet_to_arrive_paid_meldiq_plus_gifts_appear_her_a526aa0");
    },
  },
  invites: {
    get label() {
      return uiText("workspace.interface.invites_f212a98");
    },
    get description() {
      return uiText("workspace.interface.making_room_for_more_invitations_that_became_lasting_connections_88efbc6");
    },
    get empty() {
      return uiText("workspace.interface.your_people_are_out_there_invite_credits_count_after_a_friend_sta_6286d9a");
    },
  },
};
function score(metric: LeaderboardMetric, value: number) {
  if (metric === "level") return uiText("billing.interface.level_value0_6095a3d", { value0: value.toLocaleString(interfaceLocale()) });
  if (metric === "messages") return uiText("common.counts.messages", { count: value });
  if (metric === "voice") return formatUnit(value, "minute");
  return `${BOARD_INFO[metric].label}: ${value.toLocaleString(interfaceLocale())}`;
}
function openPerson(e: LeaderboardEntry) {
  window.dispatchEvent(new CustomEvent(OPEN_PROFILE_EVENT, { detail: { userId: e.user.id, name: e.user.displayName } }));
}
function Face({ entry, size }: { entry: LeaderboardEntry; size: number }) {
  useLocaleRender();
  const u = entry.user;
  return <StyledAvatar userId={u.id} name={u.displayName} colorIndex={u.avatarColor} photoRev={u.photoRev} media={u.avatarMedia} decoration={u.decoration} size={size} />;
}
export function LeaderboardsPage() {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const self = useOrbit((s) => s.me?.userId);
  const [metric, setMetric] = useState<LeaderboardMetric>("level");
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const levelRev = useOrbit((s) => (metric === "level" ? s.profilesRev : 0));
  const loaded = useLoad(() => loadLeaderboard(engine, metric), [engine, metric, levelRev]);
  // useLoad retains the previous answer: never label one category's scores as another.
  const board = loaded.data?.metric === metric ? loaded.data : null;
  const info = BOARD_INFO[metric];
  const weekly = metric === "messages" || metric === "voice";
  const podium = board?.entries.slice(0, 3) ?? [];
  return (
    <div className="leaderboards-page">
      <header className="rankings-heading">
        <span className="rankings-emblem">
          <SettingsIcon name="leaderboards" size={34} />
        </span>
        <div>
          <span className="rankings-eyebrow">
            <Localized k="workspace.interface.the_meldiq_community_685de36" />
          </span>
          <h1>{l10n("settings.settings_leaderboards")}</h1>
          <p>
            <Localized k="workspace.interface.every_connection_leaves_a_little_glow_81282da" />
          </p>
        </div>
        <button className="icon-btn rankings-refresh" aria-label={uiText("workspace.interface.refresh_rankings_cfaf82a")} disabled={loaded.loading} onClick={loaded.reload}>
          <RefreshCw size={18} className={loaded.loading ? "rankings-refreshing" : ""} />
        </button>
      </header>
      <div className="rankings-tabs" role="tablist" aria-label={uiText("workspace.interface.leaderboard_categories_ec64ce3")}>
        {LEADERBOARD_METRICS.map((key, index) => (
          <button
            key={key}
            ref={(el) => {
              tabs.current[index] = el;
            }}
            role="tab"
            id={`ranking-tab-${key}`}
            aria-controls="ranking-panel"
            aria-selected={metric === key}
            tabIndex={metric === key ? 0 : -1}
            onClick={() => setMetric(key)}
            onKeyDown={(event) => {
              const offset = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
              const target =
                event.key === "Home" ? 0 : event.key === "End" ? LEADERBOARD_METRICS.length - 1 : offset ? (index + offset + LEADERBOARD_METRICS.length) % LEADERBOARD_METRICS.length : null;
              if (target === null) return;
              event.preventDefault();
              setMetric(LEADERBOARD_METRICS[target]);
              tabs.current[target]?.focus();
            }}
          >
            <SettingsIcon name={key} />
            {BOARD_INFO[key].label}
          </button>
        ))}
      </div>
      <section id="ranking-panel" role="tabpanel" aria-labelledby={`ranking-tab-${metric}`} aria-busy={loaded.loading} tabIndex={0}>
        <div className="rankings-caption">
          <p>{info.description}</p>
          <span className="rankings-period">{weekly ? uiText("workspace.interface.last_7_days_5eb7caf") : uiText("workspace.interface.all_time_848198c")}</span>
        </div>
        {loaded.error ? (
          <div className="rankings-error" role="alert">
            <p>{loaded.error}</p>
            <button className="btn btn-secondary" onClick={loaded.reload}>
              {l10n("common.actions.retry")}
            </button>
          </div>
        ) : loaded.loading ? (
          <div className="rankings-loading" role="status">
            <div className="skeleton" />
            <p>
              <Localized k="workspace.interface.gathering_the_glow_11339b4" />
            </p>
          </div>
        ) : (
          board && (
            <>
              <div className="rankings-your-place" aria-label={uiText("workspace.interface.your_ranking_5c18d9b")}>
                <SettingsIcon name={metric} size={28} />
                <div>
                  <strong>
                    <Localized k="workspace.interface.your_place_cc9cdfb" />
                  </strong>
                  <span>
                    {board.me
                      ? uiText("workspace.interface.value0_of_value1_ranked_people_e2453f5", {
                          value0: board.me.rank.toLocaleString(interfaceLocale()),
                          value1: board.total.toLocaleString(interfaceLocale()),
                        })
                      : uiText("workspace.interface.your_next_milestone_is_ahead_6e81f78")}
                  </span>
                </div>
                <b>{board.me ? score(metric, board.me.value) : uiText("workspace.interface.unranked_88b0e98")}</b>
              </div>
              {board.entries.length ? (
                <div className="rankings-arena">
                  <div className={`rankings-podium podium-count-${podium.length}`} aria-label={uiText("workspace.interface.top_three_people_6b64f49")}>
                    {podium.map((entry, index) => (
                      <button
                        key={entry.user.id}
                        className={`podium-person podium-position-${index + 1}${entry.user.id === self ? " is-you" : ""}`}
                        onClick={() => openPerson(entry)}
                        aria-label={uiText("workspace.interface.rank_value0_value1_value2_8bc5adb", { value0: entry.rank, value1: entry.user.displayName, value2: score(metric, entry.value) })}
                      >
                        <RankMedal rank={entry.rank} />
                        <span className="podium-avatar">
                          <Face entry={entry} size={80} />
                        </span>
                        <strong className="podium-name">{entry.user.displayName}</strong>
                        <span className="podium-handle">
                          @{entry.user.username}
                          {entry.user.id === self ? uiText("workspace.interface.you_ad008d8") : ""}
                        </span>
                        <span className="podium-value">{score(metric, entry.value)}</span>
                        <span className="podium-plinth" aria-hidden="true">
                          <SettingsIcon name={metric} size={24} />
                          <b>{formatUiNumber(entry.rank)}</b>
                        </span>
                      </button>
                    ))}
                  </div>
                  {board.entries.length > 3 && (
                    <div className="rankings-table">
                      <div className="rankings-table-heading">
                        <span>
                          <Localized k="workspace.interface.rank_person_3ab4bae" />
                        </span>
                        <span>{info.label.toUpperCase()}</span>
                      </div>
                      <ol start={4} aria-label={uiText("workspace.interface.ranked_people_db64386")}>
                        {board.entries.slice(3).map((entry) => (
                          <li key={entry.user.id} value={entry.rank}>
                            <button className={`rankings-row${entry.user.id === self ? " is-you" : ""}`} onClick={() => openPerson(entry)}>
                              <span className="rankings-place">{formatUiNumber(entry.rank)}</span>
                              <Face entry={entry} size={38} />
                              <span className="rankings-person">
                                <strong>
                                  {entry.user.displayName}
                                  {entry.user.id === self && <small>{l10n("workspace.nav_you")}</small>}
                                </strong>
                                <span>@{entry.user.username}</span>
                              </span>
                              <b className="rankings-score">{score(metric, entry.value)}</b>
                            </button>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rankings-empty">
                  <SettingsIcon name={metric} size={48} />
                  <h2>
                    <Localized k="workspace.interface.be_part_of_the_first_glow_7258a23" />
                  </h2>
                  <p>{info.empty}</p>
                  {(metric === "level" || metric === "embers") && (
                    <button className="btn btn-primary" onClick={() => navigate({ section: "settings", settingsPage: "points" })}>
                      <Localized k="workspace.interface.explore_embers_6d062b6" />
                    </button>
                  )}
                </div>
              )}
              <footer className="rankings-footnote">
                <p>
                  {weekly
                    ? board.scope === "visible_communities"
                      ? uiText("workspace.interface.only_community_channels_you_can_view_count_here_direct_messages_a_a8b0f5b")
                      : uiText("workspace.interface.rank_visible_activity_scope")
                    : metric === "embers"
                      ? uiText("workspace.interface.lifetime_earnings_count_here_spending_embers_on_levels_never_lowe_a846e27")
                      : metric === "gifts"
                        ? uiText("workspace.interface.only_verified_paid_gifts_count_pending_refunded_and_disputed_gift_9d5dd99")
                        : metric === "invites"
                          ? uiText("workspace.interface.only_credited_invitations_count_a_friend_must_stay_for_seven_days_3cf1ecd")
                          : uiText("workspace.interface.automatic_rank_level_hint")}
                </p>
                <p>
                  <Localized
                    k="workspace.interface.top_100_equal_scores_share_a_rank_updated_9b163ce"
                    slots={[new Date(board.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })]}
                  />
                </p>
              </footer>
            </>
          )
        )}
      </section>
    </div>
  );
}
