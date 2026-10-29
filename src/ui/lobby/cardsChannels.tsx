import { BookText, Hash, Headphones, MessagesSquare, Radio } from "lucide-react";
import type { LobbyButton, LobbyChannel } from "../../api/lobbySchemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { SafeLink } from "../chat/SafeLink";
import { UserAvatar } from "../components/OrgAvatar";
import { relative } from "../format";
import { EditableCard } from "./LobbyCard";
import { openChannel, useLobby } from "./lobbyContext";

/** The top of the page: the tagline and up to four buttons, the first one primary. Always first. */
export function TopCard() {
  const { view, editing, editor } = useLobby();
  const tagline = view.settings.tagline?.trim() ?? "";
  const buttons = view.settings.buttons.filter((b) => b.label.trim());
  const empty = !tagline && buttons.length === 0;
  if (empty && !editing) return null;
  return (
    <EditableCard id="top" label="Top of the page" column="main" chip={empty ? "Empty" : null} untitled>
      {empty ? (
        <div className="lobby-empty">
          <p>A line about your community and a few buttons: a channel to start in, your site, anything.</p>
          <button
            className="btn btn-secondary btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              editor?.select("top");
            }}
          >
            Write it
          </button>
        </div>
      ) : (
        <div className="lobby-card-content lobby-top">
          {tagline && <p className="lobby-tagline">{tagline}</p>}
          {buttons.length > 0 && (
            <div className="lobby-buttons">
              {buttons.map((b, i) => (
                <TopButton key={i} button={b} primary={i === 0} />
              ))}
            </div>
          )}
        </div>
      )}
    </EditableCard>
  );
}

function TopButton({ button, primary }: { button: LobbyButton; primary: boolean }) {
  const engine = useEngine();
  const { orgId } = useLobby();
  const cls = `btn ${primary ? "btn-primary lobby-primary" : "btn-secondary"}`;
  if (button.channelId) {
    const id = button.channelId;
    return (
      <button className={cls} onClick={() => void openChannel(engine, orgId, id)}>
        <Hash size={15} aria-hidden="true" /> {button.label}
      </button>
    );
  }
  if (!button.url) return null;
  return (
    <SafeLink href={button.url} className={cls}>
      {button.label}
    </SafeLink>
  );
}

const channelIcon = (c: LobbyChannel) => (c.voice ? <Headphones size={17} /> : c.format === "forum" ? <MessagesSquare size={17} /> : <Hash size={17} />);

/** Main channels in tap order (or this week's busiest when none are picked), each with when it was last active. */
export function MainChannelsCard() {
  const engine = useEngine();
  const { view, orgId } = useLobby();
  return (
    <div className="lobby-channels">
      {view.mainChannels.map((c) => (
        <button key={c.id} className="lobby-channel" onClick={() => void openChannel(engine, orgId, c.id)}>
          <span className="lobby-channel-icon">{channelIcon(c)}</span>
          <span className="lines">
            <span className="ellipsis lobby-channel-name">{c.name ?? "channel"}</span>
            <small>{c.lastActiveAt ? `Active ${relative(c.lastActiveAt).toLowerCase()}` : "Quiet so far"}</small>
          </span>
        </button>
      ))}
    </div>
  );
}

/** Voice rooms with people in them now, busiest first; Join drops into the room's call. */
export function LiveNowCard() {
  const engine = useEngine();
  const { view, orgId } = useLobby();
  const busy = useOrbit((s) => s.call.phase !== "idle" && s.call.phase !== "ended");
  const canCall = useOrbit((s) => s.server?.calling === true) && engine.calls.supported();
  return (
    <div className="lobby-live">
      {view.liveNow.map((r) => (
        <div key={r.channelId} className="lobby-live-room">
          <span className="lobby-live-badge">
            <Radio size={14} aria-hidden="true" /> Live
          </span>
          <span className="lines grow">
            <span className="ellipsis lobby-channel-name">{r.name ?? "Voice room"}</span>
            <small>
              {r.participantCount} {r.participantCount === 1 ? "person" : "people"} · since {relative(r.startedAt).toLowerCase()}
            </small>
          </span>
          <span className="lobby-faces" aria-hidden="true">
            {r.participants.slice(0, 5).map((p) => (
              <UserAvatar key={p.id} userId={p.id} name={p.displayName} colorIndex={p.avatarColor} photoRev={p.photoRev} size={24} decorative />
            ))}
          </span>
          {canCall ? (
            <button
              className="btn btn-primary btn-sm lobby-primary"
              disabled={busy}
              onClick={() => void openChannel(engine, orgId, r.channelId).then(() => (engine.state.get().conversations[r.channelId] ? engine.calls.startCall(r.channelId, false) : undefined))}
            >
              Join
            </button>
          ) : (
            <button className="btn btn-secondary btn-sm" onClick={() => void openChannel(engine, orgId, r.channelId)}>
              Open
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/** The rules channel, one button away. */
export function RulesCard() {
  const engine = useEngine();
  const { view, orgId } = useLobby();
  const id = view.rules?.channelId;
  if (!id) return null;
  return (
    <div className="lobby-rules">
      <p className="muted">Read these before you post. They keep this place good for everyone.</p>
      <button className="btn btn-secondary" onClick={() => void openChannel(engine, orgId, id)}>
        <BookText size={15} aria-hidden="true" /> Read the rules
      </button>
    </div>
  );
}
