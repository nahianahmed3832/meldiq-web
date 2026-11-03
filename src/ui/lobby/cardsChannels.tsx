import { countLabel } from "../../i18n/counts";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
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
  useLocaleRender();
  const { view, editing, editor } = useLobby();
  const tagline = view.settings.tagline?.trim() ?? "";
  const buttons = view.settings.buttons.filter((b) => b.label.trim());
  const empty = !tagline && buttons.length === 0;
  if (empty && !editing) return null;
  return (
    <EditableCard id="top" label={uiText("organization.interface.top_of_the_page_8287ff5")} column="main" chip={empty ? "Empty" : null} untitled>
      {empty ? (
        <div className="lobby-empty">
          <p>
            <Localized k="organization.interface.a_line_about_your_community_and_a_few_buttons_a_channel_to_start_e712457" />
          </p>
          <button
            className="btn btn-secondary btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              editor?.select("top");
            }}
          >
            <Localized k="organization.interface.write_it_195e6a4" />
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
  useLocaleRender();
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
  useLocaleRender();
  const engine = useEngine();
  const { view, orgId } = useLobby();
  return (
    <div className="lobby-channels">
      {view.mainChannels.map((c) => (
        <button key={c.id} className="lobby-channel" onClick={() => void openChannel(engine, orgId, c.id)}>
          <span className="lobby-channel-icon">{channelIcon(c)}</span>
          <span className="lines">
            <span className="ellipsis lobby-channel-name">{c.name ?? uiText("messaging.interface.channel_69e3656")}</span>
            <small>
              {c.lastActiveAt ? uiText("organization.interface.active_value0_08f5905", { value0: relative(c.lastActiveAt).toLowerCase() }) : uiText("organization.interface.quiet_so_far_24a92fe")}
            </small>
          </span>
        </button>
      ))}
    </div>
  );
}
/** Voice rooms with people in them now, busiest first; Join drops into the room's call. */
export function LiveNowCard() {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const { view, orgId } = useLobby();
  const busy = useOrbit((s) => s.call.phase !== "idle" && s.call.phase !== "ended");
  const canCall = useOrbit((s) => s.server?.calling === true) && engine.calls.supported();
  return (
    <div className="lobby-live">
      {view.liveNow.map((r) => (
        <div key={r.channelId} className="lobby-live-room">
          <span className="lobby-live-badge">
            <Localized k="calls.interface.live_d20cec7" slots={[<Radio size={14} aria-hidden="true" />]} />
          </span>
          <span className="lines grow">
            <span className="ellipsis lobby-channel-name">{r.name ?? uiText("calls.interface.voice_room_aa0cfa3")}</span>
            <small>
              <Localized k="organization.interface.native_count_6f09b52ea" slots={[countLabel(r.participantCount, "people"), "", relative(r.startedAt).toLowerCase()]} />
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
              {l10n("workspace.discover_join")}
            </button>
          ) : (
            <button className="btn btn-secondary btn-sm" onClick={() => void openChannel(engine, orgId, r.channelId)}>
              {l10n("workspace.discover_open_btn")}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
/** The rules channel, one button away. */
export function RulesCard() {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const { view, orgId } = useLobby();
  const id = view.rules?.channelId;
  if (!id) return null;
  return (
    <div className="lobby-rules">
      <p className="muted">
        <Localized k="organization.interface.read_these_before_you_post_they_keep_this_place_good_for_everyone_e132b60" />
      </p>
      <button className="btn btn-secondary" onClick={() => void openChannel(engine, orgId, id)}>
        <BookText size={15} aria-hidden="true" /> {l10n("organization.rules_read")}
      </button>
    </div>
  );
}
