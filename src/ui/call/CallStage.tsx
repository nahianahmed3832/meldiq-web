import { AlertTriangle, Hand, Info, Lock, Mic, MicOff, Minimize2, MonitorOff, MonitorUp, PhoneOff, Settings2, ShieldAlert, ShieldQuestion, Video, VideoOff, Volume2, WifiOff, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useEngine, useOrbit } from "../../app/orbit";
import { CallFailure } from "../../call/rules";
import type { CallParticipantView, CallUiState, DeviceKind, MediaDeviceChoice } from "../../call/types";
import { Avatar } from "../components/Avatar";
import { Menu, useFocusTrap, useMenu } from "../components/Overlay";
import { useNow } from "./useNow";
import { callStatus, SECURITY_LABEL } from "./callText";
import { HandButton, PeopleButton, RoomPeople, roomRows } from "./RoomControls";

/** The full call screen: who's in it, where it stands, what's proven about its encryption, and the controls. */
export function CallStage() {
  const engine = useEngine();
  const call = useOrbit((s) => s.call);
  const now = useNow(call.phase === "connected");
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const ended = call.phase === "ended";
  const ref = useRef<HTMLElement>(null);
  useFocusTrap(ref, true);

  return (
    <section ref={ref} className="call-stage" role="dialog" aria-modal="true" aria-label={`Call with ${call.title}`}>
      <header className="call-head">
        <button className="icon-btn" onClick={() => engine.calls.setMinimized(true)} aria-label="Minimise the call" disabled={ended}>
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
      <Tiles participants={call.participants} hands={call.hands} ended={ended} title={call.title} colorIndex={call.colorIndex} />
      <Controls call={call} people={call.voiceRoom ? { open: peopleOpen, toggle: () => setPeopleOpen((o) => !o) } : null} />
    </section>
  );
}

function SecurityBadge({ call, open, onToggle }: { call: CallUiState; open: boolean; onToggle: () => void }) {
  const icon = call.security === "encrypted" ? <Lock size={14} /> : call.security === "problem" ? <ShieldAlert size={14} /> : <ShieldQuestion size={14} />;
  return (
    <button className={`e2ee-badge ${call.security}`} onClick={onToggle} aria-expanded={open} aria-label={`${SECURITY_LABEL[call.security]}. Show the call's verification code`}>
      {icon}
      {SECURITY_LABEL[call.security]}
    </button>
  );
}

/** The call's verification code (android CallVerification): the same on every device holding the same key. */
function Verification({ call }: { call: CallUiState }) {
  const code = call.verification!;
  return (
    <section className="call-verify" aria-label="Verification code">
      <div className="code">
        <span className="emoji" aria-label={`Emoji ${code.emoji.join(" ")}`}>
          {code.emoji.join("")}
        </span>
        <span className="digits">{code.digits}</span>
      </div>
      <p>
        Everyone in this call should see the same emoji and digits. They come from the call's encryption key, which the caller's device made and sent inside your end-to-end encrypted messages; the key
        itself never leaves the devices. Matching codes show everyone's media uses that key; safety numbers show who the people are.
      </p>
      {call.security !== "encrypted" && (
        <p>
          {call.security === "problem"
            ? "Media from someone in this call can't be decrypted with this key, or would arrive unencrypted. It isn't played."
            : "Meldiq shows “End-to-end encrypted” only after it has encrypted and decrypted media with this key in both directions."}
        </p>
      )}
    </section>
  );
}

function CallNotes({ call }: { call: CallUiState }) {
  const engine = useEngine();
  const notes = [];
  if (call.peerReconnecting) notes.push({ key: "peer", icon: <WifiOff size={16} />, text: `${call.title}'s connection dropped. Waiting for them to reconnect…` });
  for (const device of ["microphone", "camera"] as const) {
    const issue = call.devices[device];
    if (issue && call.phase !== "ended") notes.push({ key: device, icon: <AlertTriangle size={16} />, text: CallFailure.device(device, issue), retry: device });
  }
  if (call.path && call.path.startsWith("tcp")) notes.push({ key: "tcp", icon: <WifiOff size={16} />, text: "Connected over TCP: this network may block UDP, so the call can lag." });
  return (
    <>
      {call.notice && call.phase !== "ended" && (
        <div className="banner info" role="status">
          <Info size={16} />
          <span className="grow">{call.notice}</span>
          <button className="icon-btn" onClick={() => engine.calls.dismissNotice()} aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>
      )}
      {call.audioBlocked && call.phase !== "ended" && (
        <div className="banner" role="alert">
          <Volume2 size={16} />
          <span className="grow">Your browser paused the call's sound.</span>
          <button className="btn btn-secondary btn-sm" onClick={() => void engine.calls.startAudio()}>
            Turn on sound
          </button>
        </div>
      )}
      {notes.map((n) => (
        <div key={n.key} className={`banner${n.retry ? " danger" : ""}`} role={n.retry ? "alert" : "note"}>
          {n.icon}
          <span className="grow">{n.text}</span>
          {n.retry && (
            <button className="btn btn-secondary btn-sm" onClick={() => void (n.retry === "microphone" ? engine.calls.toggleMicrophone() : engine.calls.toggleCamera())}>
              Try again
            </button>
          )}
        </div>
      ))}
    </>
  );
}

function Tiles({ participants, hands, ended, title, colorIndex }: { participants: CallParticipantView[]; hands: string[]; ended: boolean; title: string; colorIndex: number }) {
  // A shared screen takes the stage, everyone in a strip under it (android GROUP_CALL_TILES.md); your own share isn't
  // shown back to you (it would show itself), only noted.
  const sharer = participants.find((p) => p.screenOn && !p.isLocal);
  if (sharer)
    return (
      <div className="call-screen-layout">
        <ScreenView p={sharer} />
        <div className="call-strip" aria-label="People in the call">
          {participants.map((p) => (
            <Tile key={p.identity} p={p} hand={hands.includes(p.userId)} />
          ))}
        </div>
      </div>
    );
  if (participants.length === 0)
    return (
      <div className="call-tiles">
        <div className="call-tile">
          <Avatar name={title} colorIndex={colorIndex} size={96} decorative />
          {!ended && <span className="who">{title}</span>}
        </div>
      </div>
    );
  return (
    <div className="call-tiles" aria-label="People in the call">
      {participants.map((p) => (
        <Tile key={p.identity} p={p} hand={hands.includes(p.userId)} />
      ))}
    </div>
  );
}

function Tile({ p, hand }: { p: CallParticipantView; hand: boolean }) {
  const engine = useEngine();
  const video = useRef<HTMLVideoElement>(null);
  const epoch = useOrbit((s) => s.call.mediaEpoch);
  const color = useOrbit((s) => s.users[p.userId]?.avatarColor ?? 0);
  // Attached again whenever the camera turns on or the media connection is replaced (a rejoin).
  useEffect(() => {
    const el = video.current;
    if (!p.cameraOn || !el) return;
    return engine.calls.attachVideo(p.identity, el);
  }, [engine, p.identity, p.cameraOn, epoch]);
  const name = p.isLocal ? "You" : p.name;
  const label = `${name}${hand ? ", hand raised" : ""}${p.micOn ? "" : ", muted"}${p.e2eeProblem ? ", encryption problem" : ""}${p.connectionWeak ? ", weak connection" : ""}`;
  return (
    <figure className={`call-tile${p.isLocal ? " local" : ""}${p.speaking ? " speaking" : ""}`} aria-label={label} style={{ margin: 0 }}>
      {p.cameraOn ? <video ref={video} autoPlay playsInline muted aria-hidden="true" /> : <Avatar name={p.name} colorIndex={color} size={88} decorative />}
      <figcaption className={`who${p.e2eeProblem ? " problem" : ""}`}>
        {hand && <Hand size={13} aria-hidden="true" className="hand" />}
        {!p.micOn && <MicOff size={13} aria-hidden="true" />}
        {p.e2eeProblem && <ShieldAlert size={13} aria-hidden="true" />}
        {p.connectionWeak && <WifiOff size={13} aria-hidden="true" />}
        <span className="ellipsis">{name}</span>
      </figcaption>
    </figure>
  );
}

function ScreenView({ p }: { p: CallParticipantView }) {
  const engine = useEngine();
  const video = useRef<HTMLVideoElement>(null);
  const epoch = useOrbit((s) => s.call.mediaEpoch);
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    return engine.calls.attachScreen(p.identity, el);
  }, [engine, p.identity, epoch]);
  return (
    <figure className="call-screen" aria-label={`${p.name}'s screen`} style={{ margin: 0 }}>
      <video ref={video} autoPlay playsInline muted aria-hidden="true" />
      <figcaption className="who">
        <MonitorUp size={13} aria-hidden="true" /> {p.name} is sharing their screen
      </figcaption>
    </figure>
  );
}

/** Screen sharing needs getDisplayMedia, which phones' browsers don't offer. */
const canShareScreen = (): boolean => typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getDisplayMedia === "function" && !/Android|iPhone|iPad/.test(navigator.userAgent);

function Controls({ call, people }: { call: CallUiState; people: { open: boolean; toggle: () => void } | null }) {
  const engine = useEngine();
  const live = call.phase !== "ended";
  const media = live && call.phase !== "incoming" && call.verification !== null;
  return (
    <div className="call-controls">
      <button
        className={`call-btn${call.devices.microphone ? " warn" : ""}`}
        onClick={() => void engine.calls.toggleMicrophone()}
        aria-pressed={call.micOn}
        aria-label={call.micOn ? "Mute" : "Unmute"}
        disabled={!media}
      >
        {call.micOn ? <Mic size={22} /> : <MicOff size={22} />}
      </button>
      <button
        className={`call-btn${call.devices.camera ? " warn" : ""}`}
        onClick={() => void engine.calls.toggleCamera()}
        aria-pressed={call.cameraOn}
        aria-label={call.cameraOn ? "Turn camera off" : "Turn camera on"}
        disabled={!media}
      >
        {call.cameraOn ? <Video size={22} /> : <VideoOff size={22} />}
      </button>
      {canShareScreen() && (
        <button
          className={`call-btn${call.screenSharing ? " on" : ""}`}
          onClick={() => void engine.calls.toggleScreenShare()}
          aria-pressed={call.screenSharing}
          aria-label={call.screenSharing ? "Stop sharing your screen" : "Share your screen"}
          title={call.screenSharing ? "Stop sharing" : "Share your screen"}
          disabled={!media}
        >
          {call.screenSharing ? <MonitorOff size={22} /> : <MonitorUp size={22} />}
        </button>
      )}
      {call.voiceRoom && <HandButton call={call} />}
      {people && <PeopleButton open={people.open} onToggle={people.toggle} count={roomRows(call).length} />}
      <DeviceMenu disabled={!media} />
      <button className="call-btn end" onClick={() => engine.calls.hangup()} aria-label="Hang up" disabled={!live}>
        <PhoneOff size={22} />
      </button>
    </div>
  );
}

const KINDS: { kind: DeviceKind; heading: string }[] = [
  { kind: "audioinput", heading: "Microphone" },
  { kind: "videoinput", heading: "Camera" },
  { kind: "audiooutput", heading: "Speaker" },
];

/** Microphone, camera and speaker choice during the call (speakers where the browser can switch them). */
function DeviceMenu({ disabled }: { disabled: boolean }) {
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
      <button className="call-btn" onClick={(e) => void open(e.currentTarget)} aria-label="Choose microphone, camera or speaker" aria-haspopup="menu" disabled={disabled}>
        <Settings2 size={22} />
      </button>
      {menu.anchor && lists && (
        <Menu
          anchor={menu.anchor}
          label="Call devices"
          onClose={menu.close}
          entries={KINDS.flatMap((k) =>
            lists[k.kind].length ? [{ heading: k.heading }, ...lists[k.kind].map((d) => ({ label: d.label, onSelect: () => void engine.calls.useDevice(k.kind, d.deviceId) }))] : [],
          )}
        />
      )}
    </>
  );
}
