import { RefreshCw } from "lucide-react";
import { useRef, useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { navigate } from "../../application/router";
import { LEADERBOARD_METRICS, loadLeaderboard, type LeaderboardEntry, type LeaderboardMetric } from "../../sync/leaderboards";
import { SettingsIcon, RankMedal } from "../components/SettingsIcon";
import { StyledAvatar } from "../people/ProfileStyle";
import { OPEN_PROFILE_EVENT } from "../people/ProfileDialog";
import { useLoad } from "../workspace/useLoad";

export const BOARD_INFO: Record<LeaderboardMetric, { label: string; description: string; unit: string; empty: string }> = {
  level: {
    label: "Level",
    description: "The next chapter starts with you. Meet Meldiq’s highest account levels.",
    unit: "level",
    empty: "A new chapter is waiting. Spend earned Embers on your first level to join the board.",
  },
  messages: {
    label: "Messages",
    description: "Keeping the conversation going, one message at a time.",
    unit: "messages",
    empty: "No messages this week yet. Start a conversation in one of your community channels.",
  },
  voice: {
    label: "Voice",
    description: "Good company, great conversations. Recorded voice room time this week.",
    unit: "minutes",
    empty: "It’s quiet around the campfire. Spend a minute in a community voice room to get started.",
  },
  embers: {
    label: "Embers",
    description: "A little warmth goes a long way. The most Embers earned, ever.",
    unit: "Embers",
    empty: "The first sparks are still ahead. Complete quests and check in to earn Embers.",
  },
  gifts: {
    label: "Gifts",
    description: "For the people who brighten someone else’s day. Verified Meldiq Plus gifts sent.",
    unit: "gifts",
    empty: "The first gift is yet to arrive. Paid Meldiq Plus gifts appear here after payment is verified.",
  },
  invites: {
    label: "Invites",
    description: "Making room for more. Invitations that became lasting connections.",
    unit: "invites",
    empty: "Your people are out there. Invite credits count after a friend stays for seven days.",
  },
};
function score(metric: LeaderboardMetric, value: number) {
  if (metric === "level") return `Level ${value.toLocaleString()}`;
  const unit = BOARD_INFO[metric].unit;
  return `${value.toLocaleString()} ${value === 1 && metric !== "embers" ? unit.slice(0, -1) : unit}`;
}
function openPerson(e: LeaderboardEntry) {
  window.dispatchEvent(new CustomEvent(OPEN_PROFILE_EVENT, { detail: { userId: e.user.id, name: e.user.displayName } }));
}
function Face({ entry, size }: { entry: LeaderboardEntry; size: number }) {
  const u = entry.user;
  return <StyledAvatar userId={u.id} name={u.displayName} colorIndex={u.avatarColor} photoRev={u.photoRev} media={u.avatarMedia} decoration={u.decoration} size={size} />;
}
export function LeaderboardsPage() {
  const engine = useEngine();
  const self = useOrbit((s) => s.me?.userId);
  const [metric, setMetric] = useState<LeaderboardMetric>("level");
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const loaded = useLoad(() => loadLeaderboard(engine, metric), [engine, metric]);
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
          <span className="rankings-eyebrow">THE MELDIQ COMMUNITY</span>
          <h1>Leaderboards</h1>
          <p>Every connection leaves a little glow.</p>
        </div>
        <button className="icon-btn rankings-refresh" aria-label="Refresh rankings" disabled={loaded.loading} onClick={loaded.reload}>
          <RefreshCw size={18} className={loaded.loading ? "rankings-refreshing" : ""} />
        </button>
      </header>
      <div className="rankings-tabs" role="tablist" aria-label="Leaderboard categories">
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
          <span className="rankings-period">{weekly ? "LAST 7 DAYS" : "ALL TIME"}</span>
        </div>
        {loaded.error ? (
          <div className="rankings-error" role="alert">
            <p>{loaded.error}</p>
            <button className="btn btn-secondary" onClick={loaded.reload}>
              Try again
            </button>
          </div>
        ) : loaded.loading ? (
          <div className="rankings-loading" role="status">
            <div className="skeleton" />
            <p>Gathering the glow…</p>
          </div>
        ) : (
          board && (
            <>
              <div className="rankings-your-place" aria-label="Your ranking">
                <SettingsIcon name={metric} size={28} />
                <div>
                  <strong>Your place</strong>
                  <span>{board.me ? `#${board.me.rank.toLocaleString()} of ${board.total.toLocaleString()} ranked people` : "Your next milestone is ahead"}</span>
                </div>
                <b>{board.me ? score(metric, board.me.value) : "Unranked"}</b>
              </div>
              {board.entries.length ? (
                <div className="rankings-arena">
                  <div className={`rankings-podium podium-count-${podium.length}`} aria-label="Top three people">
                    {podium.map((entry, index) => (
                      <button
                        key={entry.user.id}
                        className={`podium-person podium-position-${index + 1}${entry.user.id === self ? " is-you" : ""}`}
                        onClick={() => openPerson(entry)}
                        aria-label={`Rank ${entry.rank}, ${entry.user.displayName}, ${score(metric, entry.value)}`}
                      >
                        <RankMedal rank={entry.rank} />
                        <span className="podium-avatar">
                          <Face entry={entry} size={80} />
                        </span>
                        <strong className="podium-name">{entry.user.displayName}</strong>
                        <span className="podium-handle">
                          @{entry.user.username}
                          {entry.user.id === self ? " · You" : ""}
                        </span>
                        <span className="podium-value">{score(metric, entry.value)}</span>
                        <span className="podium-plinth" aria-hidden="true">
                          <SettingsIcon name={metric} size={24} />
                          <b>{entry.rank}</b>
                        </span>
                      </button>
                    ))}
                  </div>
                  {board.entries.length > 3 && (
                    <div className="rankings-table">
                      <div className="rankings-table-heading">
                        <span>RANK / PERSON</span>
                        <span>{info.label.toUpperCase()}</span>
                      </div>
                      <ol start={4} aria-label="Ranked people">
                        {board.entries.slice(3).map((entry) => (
                          <li key={entry.user.id} value={entry.rank}>
                            <button className={`rankings-row${entry.user.id === self ? " is-you" : ""}`} onClick={() => openPerson(entry)}>
                              <span className="rankings-place">{entry.rank}</span>
                              <Face entry={entry} size={38} />
                              <span className="rankings-person">
                                <strong>
                                  {entry.user.displayName}
                                  {entry.user.id === self && <small>You</small>}
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
                  <h2>Be part of the first glow</h2>
                  <p>{info.empty}</p>
                  {(metric === "level" || metric === "embers") && (
                    <button className="btn btn-primary" onClick={() => navigate({ section: "settings", settingsPage: "points" })}>
                      Explore Embers
                    </button>
                  )}
                </div>
              )}
              <footer className="rankings-footnote">
                <p>
                  {weekly
                    ? "Only community channels you can view count here. Direct messages and private calls never count. Voice time uses retained participation records; overlapping devices count once."
                    : metric === "embers"
                      ? "Lifetime earnings count here. Spending Embers on levels never lowers this score."
                      : metric === "gifts"
                        ? "Only verified paid gifts count. Pending, refunded and disputed gifts are excluded; recipients and payment details stay private."
                        : metric === "invites"
                          ? "Only credited invitations count: a friend must stay for seven days, within the monthly reward limit."
                          : "Account levels start ranking at level 2. Earn Embers through quests, visits and conversations, then spend them to level up."}
                </p>
                <p>Top 100 · Equal scores share a rank · Updated {new Date(board.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
              </footer>
            </>
          )
        )}
      </section>
    </div>
  );
}
