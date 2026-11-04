import { useLocaleRender } from "../../i18n/Localized";
import { BotTag } from "../components/BotTag";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { useLanguage } from "../../i18n";
import {
  AlertTriangle,
  Hand,
  HeadphoneOff,
  Headphones,
  Info,
  Lock,
  Mic,
  MicOff,
  Minimize2,
  MonitorOff,
  MonitorUp,
  PhoneOff,
  Settings2,
  UserPlus,
  ShieldAlert,
  ShieldQuestion,
  Video,
  VideoOff,
  Volume2,
  WifiOff,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { CallFailure } from "../../call/rules";
import { shareShortfall } from "../../call/shareQuality";
import { ScreenView, ShareDialog, SharePill, StreamTray } from "./ShareViews";
import type { CallParticipantView, CallUiState, DeviceKind, MediaDeviceChoice } from "../../call/types";
import { CallAvatar, CallTargetAvatar } from "./CallAvatar";
import { Menu, useMenu } from "../components/Overlay";
import { screenShareSupport, INVITE_EVENT } from "./callShared";
import { useNow } from "./useNow";
import { callStatus, SECURITY_LABEL } from "./callText";
import { HandButton, PeopleButton, RoomPeople, roomRows } from "./RoomControls";
/**
 * The call screen: who's in it, where it stands, what's proven about its encryption, and the controls. On a desktop
 * window it fills the middle and leaves the rail and channels usable (2026-10-28, after the owner's reference), with
 * the call's panel at the foot of the channel list (ConnectedCallPanel); on phones it covers the screen.
 */
export function CallStage() {
  useLocaleRender();
  // Pure call status/elapsed-time formatters must also refresh immediately when the language changes.
  useLanguage();
  const engine = useEngine();
  const call = useOrbit((s) => s.call);
  const now = useNow(call.phase === "connected");
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const ended = call.phase === "ended";
  const orgId = useOrbit((s) => (call.conversationId ? (s.conversations[call.conversationId]?.orgId ?? null) : null));
  return (
    <section className="call-stage" role="region" aria-label={uiText("calls.interface.call_with_value0_5a389c7", { value0: call.title })}>
      <header className="call-head">
        <button className="icon-btn" onClick={() => engine.calls.setMinimized(true)} aria-label={uiText("calls.interface.minimise_the_call_4ce16e3")} disabled={ended}>
          <Minimize2 size={18} />
        </button>
        <div className="grow">
          <h2 className="ellipsis">{call.title}</h2>
          <p className="status" role="status" aria-live="polite">
            {callStatus(call, now)}
          </p>
        </div>
        {call.verification && !ended && <SecurityBadge call={call} open={verifyOpen} onToggle={() => setVerifyOpen((o) => !o)} />}
      </header>
      <div className="call-notes">
        {verifyOpen && call.verification && <Verification call={call} />}
        {call.voiceRoom && peopleOpen && !ended && <RoomPeople call={call} />}
        <CallNotes call={call} />
      </div>
      <Tiles call={call} ended={ended} />
      {call.voiceRoom && orgId && !ended && (
        <div className="call-invite-row">
          <button className="btn call-invite" onClick={() => window.dispatchEvent(new CustomEvent(INVITE_EVENT, { detail: orgId }))}>
            <Localized k="calls.interface.invite_to_voice_f2d3ca5" slots={[<UserPlus size={17} aria-hidden="true" />]} />
          </button>
        </div>
      )}
      <Controls call={call} people={call.voiceRoom ? { open: peopleOpen, toggle: () => setPeopleOpen((o) => !o) } : null} />
    </section>
  );
}
function SecurityBadge({ call, open, onToggle }: { call: CallUiState; open: boolean; onToggle: () => void }) {
  useLocaleRender();
  const icon = call.security === "encrypted" ? <Lock size={14} /> : call.security === "problem" ? <ShieldAlert size={14} /> : <ShieldQuestion size={14} />;
  return (
    <button
      className={`e2ee-badge ${call.security}`}
      onClick={onToggle}
      aria-expanded={open}
      aria-label={uiText("calls.interface.value0_show_the_call_s_verification_code_0b5bced", { value0: SECURITY_LABEL[call.security] })}
    >
      {icon}
      {SECURITY_LABEL[call.security]}
    </button>
  );
}
/** The call's verification code (android CallVerification): the same on every device holding the same key. */
function Verification({ call }: { call: CallUiState }) {
  useLocaleRender();
  const l10n = useLocalization();
  const code = call.verification!;
  return (
    <section className="call-verify" aria-label={l10n("onboarding.setup_code_label")}>
      <p>
        <Localized k="calls.interface.meldiq_does_not_record_calls_or_create_clips_a_participant_report_bcd02fe" />
      </p>
      <div className="code">
        <span className="emoji" aria-label={uiText("calls.interface.emoji_value0_9057e7c", { value0: code.emoji.join(" ") })}>
          {code.emoji.join("")}
        </span>
        <span className="digits">{code.digits}</span>
      </div>
      <p>
        <Localized k="calls.interface.everyone_in_this_call_should_see_the_same_emoji_and_digits_they_c_b7d2a1e" />
      </p>
      {call.security !== "encrypted" && (
        <p>
          {call.security === "problem"
            ? uiText("calls.interface.media_from_someone_in_this_call_can_t_be_decrypted_with_this_key_7e608a0")
            : uiText("calls.interface.meldiq_shows_encrypted_call_only_after_it_has_encrypted_and_decry_33a4295")}
        </p>
      )}
    </section>
  );
}
function CallNotes({ call }: { call: CallUiState }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const notes = [];
  if (call.peerReconnecting)
    notes.push({ key: "peer", icon: <WifiOff size={16} />, text: uiText("calls.interface.value0_s_connection_dropped_waiting_for_them_to_reconnect_3945ec8", { value0: call.title }) });
  for (const device of ["microphone", "camera"] as const) {
    const issue = call.devices[device];
    if (issue && call.phase !== "ended") notes.push({ key: device, icon: <AlertTriangle size={16} />, text: CallFailure.device(device, issue), retry: device });
  }
  if (call.path && call.path.startsWith("tcp"))
    notes.push({
      key: "tcp",
      icon: <WifiOff size={16} />,
      get text() {
        return uiText("calls.interface.connected_over_tcp_this_network_may_block_udp_so_the_call_can_lag_27d75c5");
      },
    });
  // Less than the presenter chose: the browser captures less, or the connection made the share step down.
  const shortfall = call.shareStats && shareShortfall(call.shareStats);
  if (shortfall && call.phase !== "ended") notes.push({ key: "share", icon: <Info size={16} />, text: shortfall });
  return (
    <>
      {call.notice && call.phase !== "ended" && (
        <div className="banner info" role="status">
          <Info size={16} />
          <span className="grow">{call.notice}</span>
          <button className="icon-btn" onClick={() => engine.calls.dismissNotice()} aria-label={uiText("calls.interface.dismiss_48845bf")}>
            <X size={16} />
          </button>
        </div>
      )}
      {call.audioBlocked && call.phase !== "ended" && (
        <div className="banner" role="alert">
          <Volume2 size={16} />
          <span className="grow">
            <Localized k="calls.interface.your_browser_paused_the_call_s_sound_29f23a9" />
          </span>
          <button className="btn btn-secondary btn-sm" onClick={() => void engine.calls.startAudio()}>
            <Localized k="calls.interface.turn_on_sound_5b3654f" />
          </button>
        </div>
      )}
      {notes.map((n) => (
        <div key={n.key} className={`banner${n.retry ? " danger" : ""}`} role={n.retry ? "alert" : "note"}>
          {n.icon}
          <span className="grow">{n.text}</span>
          {n.retry && (
            <button className="btn btn-secondary btn-sm" onClick={() => void (n.retry === "microphone" ? engine.calls.toggleMicrophone() : engine.calls.toggleCamera())}>
              {l10n("common.actions.retry")}
            </button>
          )}
        </div>
      ))}
    </>
  );
}
function Tiles({ call, ended }: { call: CallUiState; ended: boolean }) {
  useLocaleRender();
  const { participants, hands, title } = call;
  // The watched share takes the stage, everyone in a strip under it (android GROUP_CALL_TILES.md); the other shares wait
  // in the tray beside the call's pills (StreamTray). Your own share isn't shown back to you (it would show itself), only listed.
  const watched = call.shares.find((s) => s.key === call.watching && !s.isLocal);
  // A phone shared upright is tall: the people go beside it on a wide window, not under it, so it gets the height.
  const [shape, setShape] = useState<"portrait" | "landscape" | null>(null);
  if (watched)
    return (
      <div className={`call-screen-layout${shape === "portrait" ? " side" : ""}`}>
        <ScreenView key={watched.key} share={watched} stats={call.watchStats} onShape={setShape} />
        <div className="call-strip" aria-label={uiText("calls.interface.people_in_the_call_699d53f")}>
          {participants.map((p) => (
            <Tile key={p.identity} p={p} hand={hands.includes(p.userId)} compact />
          ))}
        </div>
      </div>
    );
  if (participants.length === 0)
    return (
      <div className="call-tiles">
        <div className="call-tile">
          <CallTargetAvatar call={call} />
          {!ended && <span className="who">{title}</span>}
        </div>
      </div>
    );
  return (
    <div className="call-tiles" aria-label={uiText("calls.interface.people_in_the_call_699d53f")}>
      {participants.map((p) => (
        <Tile key={p.identity} p={p} hand={hands.includes(p.userId)} />
      ))}
    </div>
  );
}
function Tile({ p, hand, compact = false }: { p: CallParticipantView; hand: boolean; compact?: boolean }) {
  useLocaleRender();
  const isBot = useOrbit((state) => state.users[p.userId]?.bot ?? false);
  const engine = useEngine();
  const video = useRef<HTMLVideoElement>(null);
  const epoch = useOrbit((s) => s.call.mediaEpoch);
  // Attached again whenever the camera turns on or the media connection is replaced (a rejoin).
  useEffect(() => {
    const el = video.current;
    if (!p.cameraOn || !el) return;
    return engine.calls.attachVideo(p.identity, el);
  }, [engine, p.identity, p.cameraOn, epoch]);
  const name = p.isLocal ? uiText("workspace.nav_you") : p.name;
  const label = `${name}${hand ? uiText("calls.interface.hand_raised_1228044") : ""}${p.micOn ? "" : uiText("calls.interface.muted_13121e1")}${p.e2eeProblem ? uiText("calls.interface.encryption_problem_4b2d5f7") : ""}${p.connectionWeak ? uiText("calls.interface.weak_connection_47c6930") : ""}`;
  return (
    <figure className={`call-tile${p.isLocal ? " local" : ""}${p.speaking ? " speaking" : ""}`} aria-label={label} style={{ margin: 0 }}>
      {p.cameraOn ? (
        <video ref={video} className={p.mirrored ? "mirrored" : undefined} autoPlay playsInline muted aria-hidden="true" />
      ) : (
        <CallAvatar userId={p.userId} name={p.name} size={compact ? 40 : 88} />
      )}
      <figcaption className={`who${p.e2eeProblem ? " problem" : ""}`}>
        {hand && <Hand size={13} aria-hidden="true" className="hand" />}
        {!p.micOn && <MicOff size={13} aria-hidden="true" />}
        {p.e2eeProblem && <ShieldAlert size={13} aria-hidden="true" />}
        {p.connectionWeak && <WifiOff size={13} aria-hidden="true" />}
        <span className="ellipsis">{name}</span>
        {isBot && <BotTag />}
      </figcaption>
    </figure>
  );
}
function Controls({
  call,
  people,
}: {
  call: CallUiState;
  people: {
    open: boolean;
    toggle: () => void;
  } | null;
}) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const live = call.phase !== "ended";
  const media = live && call.phase !== "incoming" && call.verification !== null;
  const [sharing, setSharing] = useState(false);
  return (
    <div className="call-controls-wrap">
      {/* The pills and the screens being shared share one row (wrapping on narrow windows), so a share costs the stage no height. */}
      {(media || (live && call.shares.length > 0)) && (
        <div className="call-pills">
          {media && (
            <>
              {/* Batch B10 (android CallOverlay's Deafen pill). */}
              <button className={`call-pill${call.deafened ? " on" : ""}`} aria-pressed={call.deafened} onClick={() => void engine.calls.toggleDeafen()}>
                {call.deafened ? <HeadphoneOff size={15} /> : <Headphones size={15} />} {call.deafened ? uiText("calls.interface.deafened_38f36f4") : uiText("calls.interface.deafen_97081eb")}
              </button>
              {call.listenOnly && (
                <span className="call-pill quiet">
                  <Localized k="calls.interface.listen_only_444f6dd" />
                </span>
              )}
              <SharePill call={call} />
            </>
          )}
          {live && <StreamTray call={call} />}
        </div>
      )}
      <div className="call-controls">
        <button
          className={`call-btn${call.devices.microphone ? " warn" : ""}`}
          onClick={() => void engine.calls.toggleMicrophone()}
          aria-pressed={call.micOn}
          aria-label={call.listenOnly ? uiText("calls.interface.you_can_only_listen_in_this_voice_channel_a869bc5") : l10n(call.micOn ? "calls.ariaMute" : "calls.ariaUnmute")}
          disabled={!media || call.listenOnly}
        >
          {call.micOn ? <Mic size={22} /> : <MicOff size={22} />}
        </button>
        <button
          className={`call-btn${call.devices.camera ? " warn" : ""}`}
          onClick={() => void engine.calls.toggleCamera()}
          aria-pressed={call.cameraOn}
          aria-label={l10n(call.cameraOn ? "calls.cameraOff" : "calls.cameraOn")}
          disabled={!media}
        >
          {call.cameraOn ? <Video size={22} /> : <VideoOff size={22} />}
        </button>
        <button
          className={`call-btn${call.screenSharing ? " on" : ""}`}
          onClick={() => (call.screenSharing ? void engine.calls.toggleScreenShare() : setSharing(true))}
          aria-pressed={call.screenSharing}
          aria-label={l10n(call.screenSharing ? "calls.ariaStopSharing" : "calls.ariaShare")}
          title={call.screenSharing ? l10n("calls.stopSharing") : screenShareSupport().ok ? l10n("calls.ariaShare") : uiText("calls.interface.screen_sharing_availability_750e755")}
          disabled={!media}
        >
          {call.screenSharing ? <MonitorOff size={22} /> : <MonitorUp size={22} />}
        </button>
        {call.voiceRoom && <HandButton call={call} />}
        {people && <PeopleButton open={people.open} onToggle={people.toggle} count={roomRows(call).length} />}
        <DeviceMenu disabled={!media} />
        <button className="call-btn end" onClick={() => engine.calls.hangup()} aria-label={l10n("calls.hangUp")} disabled={!live}>
          <PhoneOff size={22} />
        </button>
      </div>
      {sharing && <ShareDialog onClose={() => setSharing(false)} />}
    </div>
  );
}
const KINDS: {
  kind: DeviceKind;
  heading: string;
}[] = [
  {
    kind: "audioinput",
    get heading() {
      return uiText("calls.microphone");
    },
  },
  {
    kind: "videoinput",
    get heading() {
      return uiText("calls.camera");
    },
  },
  {
    kind: "audiooutput",
    get heading() {
      return uiText("calls.interface.speaker_a9e0c70");
    },
  },
];
/** Microphone, camera and speaker choice during the call (speakers where the browser can switch them). */
function DeviceMenu({ disabled }: { disabled: boolean }) {
  useLocaleRender();
  const engine = useEngine();
  const menu = useMenu();
  const [lists, setLists] = useState<Record<DeviceKind, MediaDeviceChoice[]> | null>(null);
  const open = async (el: HTMLElement) => {
    const entries = await Promise.all(KINDS.map(async (k) => [k.kind, await engine.calls.listDevices(k.kind)] as const));
    setLists(Object.fromEntries(entries) as Record<DeviceKind, MediaDeviceChoice[]>);
    menu.open(el);
  };
  return (
    <>
      <button
        className="call-btn"
        onClick={(e) => void open(e.currentTarget)}
        aria-label={uiText("calls.interface.choose_microphone_camera_or_speaker_57df961")}
        aria-haspopup="menu"
        disabled={disabled}
      >
        <Settings2 size={22} />
      </button>
      {menu.anchor && lists && (
        <Menu
          anchor={menu.anchor}
          label={uiText("calls.interface.call_devices_d0a7cc1")}
          onClose={menu.close}
          entries={KINDS.flatMap((k) =>
            lists[k.kind].length ? [{ heading: k.heading }, ...lists[k.kind].map((d) => ({ label: d.label, onSelect: () => void engine.calls.useDevice(k.kind, d.deviceId) }))] : [],
          )}
        />
      )}
    </>
  );
}
