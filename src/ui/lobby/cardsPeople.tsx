import { Crown, Shield, ShieldCheck } from "lucide-react";
import { useState } from "react";
import type { LobbyBoard, LobbyPerson, LobbyStaff } from "../../api/lobbySchemas";
import { levelFromXp } from "../../sync/officialBotRules";
import { UserAvatar } from "../components/OrgAvatar";
import { OPEN_PROFILE_EVENT } from "../people/ProfileDialog";
import { BOARD_LABELS } from "./lobbyInfo";
import { useLobby } from "./lobbyContext";

const BADGES: Record<LobbyStaff["badge"], { label: string; icon: typeof Crown }> = {
  owner: { label: "Owner", icon: Crown },
  admin: { label: "Admin", icon: ShieldCheck },
  mod: { label: "Moderator", icon: Shield },
};

function openProfile(p: LobbyPerson, orgId: string) {
  window.dispatchEvent(new CustomEvent(OPEN_PROFILE_EVENT, { detail: { userId: p.id, name: p.displayName, orgId } }));
}

/** The owner, admins and moderators, each with a badge. */
export function WhoRunsItCard() {
  const { view, orgId } = useLobby();
  return (
    <div className="lobby-people">
      {view.whoRunsIt.map(({ user, badge }) => {
        const b = BADGES[badge];
        return (
          <button key={user.id} className="lobby-person" onClick={() => openProfile(user, orgId)}>
            <UserAvatar userId={user.id} name={user.displayName} colorIndex={user.avatarColor} photoRev={user.photoRev} size={32} decorative />
            <span className="lines grow">
              <span className="ellipsis">{user.displayName}</span>
              <small className="ellipsis">@{user.username}</small>
            </span>
            <span className={`lobby-badge badge-${badge}`}>
              <b.icon size={12} aria-hidden="true" /> {b.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

const UNITS: Record<LobbyBoard, [string, string]> = { levels: ["XP", "XP"], messages_week: ["message", "messages"], invites: ["invite", "invites"] };

/** A board's number: the Levels board's `count` is XP (the Levels bot), shown with the level it makes. */
function boardCount(board: LobbyBoard, count: number, unit: [string, string]): string {
  const n = `${count.toLocaleString()} ${count === 1 ? unit[0] : unit[1]}`;
  return board === "levels" ? `Level ${levelFromXp(count)} · ${n}` : n;
}

/** The top ten on each of the lobby's boards; several boards are tabs. */
export function LeaderboardCard() {
  const { view, orgId } = useLobby();
  const boards = view.leaderboards.filter((l) => (Object.keys(BOARD_LABELS) as string[]).includes(l.board));
  const [chosen, setChosen] = useState<string | null>(null);
  const current = boards.find((b) => b.board === chosen) ?? boards.find((b) => b.entries.length) ?? boards[0];
  if (!current) return null;
  const unit = UNITS[current.board as LobbyBoard];
  return (
    <div className="lobby-board">
      {boards.length > 1 && (
        <div className="lobby-tabs" role="tablist" aria-label="Leaderboards">
          {boards.map((b) => (
            <button key={b.board} role="tab" aria-selected={b.board === current.board} onClick={() => setChosen(b.board)}>
              {BOARD_LABELS[b.board as LobbyBoard]}
            </button>
          ))}
        </div>
      )}
      {current.entries.length === 0 ? (
        <p className="muted lobby-quiet">Nobody on this board yet.</p>
      ) : (
        <ol className="lobby-ranks">
          {current.entries.map((e) => (
            <li key={e.user.id}>
              <button className="lobby-person" onClick={() => openProfile(e.user, orgId)}>
                <span className={`lobby-rank rank-${e.rank}`}>{e.rank}</span>
                <UserAvatar userId={e.user.id} name={e.user.displayName} colorIndex={e.user.avatarColor} photoRev={e.user.photoRev} size={26} decorative />
                <span className="ellipsis grow">{e.user.displayName}</span>
                <small className="muted">{boardCount(current.board as LobbyBoard, e.count, unit)}</small>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
