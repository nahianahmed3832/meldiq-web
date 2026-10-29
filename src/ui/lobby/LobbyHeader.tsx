import { Paintbrush } from "lucide-react";
import { OrgAvatar } from "../components/OrgAvatar";
import { members } from "../format";
import { useLobby } from "./lobbyContext";

interface LobbyHeaderProps {
  bannerUrl: string | null;
  /** Customize, for people who can edit the lobby (hidden while the editor is open). */
  onCustomize: (() => void) | null;
  opening: boolean;
}

/** The lobby's banner: the community's picture (or a band of its accent), icon, name and counts, and Customize. */
export function LobbyHeader({ bannerUrl, onCustomize, opening }: LobbyHeaderProps) {
  const { view } = useLobby();
  const c = view.community;
  return (
    <header className="lobby-header">
      <div className="lobby-banner" style={bannerUrl ? { backgroundImage: `url(${bannerUrl})` } : undefined} aria-hidden="true" />
      <div className="lobby-id">
        <span className="lobby-icon">
          <OrgAvatar orgId={c.id} name={c.name} photoRev={c.photoRev} size={72} />
        </span>
        <div className="lobby-titles">
          <h1 className="lobby-name">{c.name}</h1>
          <p className="lobby-counts">
            {members(c.memberCount)} · <span className="lobby-online-dot" aria-hidden="true" /> {c.onlineCount} online
          </p>
        </div>
      </div>
      {onCustomize && (
        <button className="btn btn-secondary btn-sm lobby-customize" onClick={onCustomize} disabled={opening}>
          <Paintbrush size={15} aria-hidden="true" /> Customize
        </button>
      )}
    </header>
  );
}
