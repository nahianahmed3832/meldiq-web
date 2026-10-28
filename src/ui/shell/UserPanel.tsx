import { ChevronDown, Headphones, HeadphoneOff, Mic, MicOff, RotateCw, Settings } from "lucide-react";
import { useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { setPrefs, usePrefs } from "../../application/prefs";
import { navigate } from "../../application/router";
import type { MediaDeviceChoice } from "../../call/types";
import { statusLine } from "../../sync/status";
import { currentPresence, PRESENCE_LABEL } from "../../sync/social";
import { usePhoto } from "../components/photos";
import { contextMenuProps, Menu, type MenuEntry, useMenu } from "../components/Overlay";
import { LookAvatar, StyledName, useUserLook } from "../people/NameStyle";
import { useProfileMenu } from "./ProfileMenu";
import { CONN_LABEL } from "./ConnectionBanner";

/** The browser's microphones or speakers, with their names once the person has allowed the microphone once. */
async function devices(kind: "audioinput" | "audiooutput"): Promise<MediaDeviceChoice[]> {
  const all = await navigator.mediaDevices?.enumerateDevices().catch(() => [] as MediaDeviceInfo[]);
  return (all ?? [])
    .filter((d) => d.kind === kind && d.deviceId && d.deviceId !== "default" && d.deviceId !== "communications")
    .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `${kind === "audioinput" ? "Microphone" : "Speaker"} ${i + 1}` }));
}

/**
 * The bottom of the sidebar (the reference's user panel, 2026-10-28): you on your profile banner, with your presence or
 * the connection's state; then your microphone and headphones, each with a menu of devices, and Settings. In a call
 * they mute and deafen it; outside one they say how the next call starts. Your name opens the profile menu (status,
 * Activity, Saved, theme, sign out); a right-click on the panel opens it too. Desktop only: phones keep the top bar.
 */
export function UserPanel() {
  const engine = useEngine();
  const me = useOrbit((s) => s.me);
  const myPhoto = useOrbit((s) => (s.me ? s.users[s.me.userId]?.photoRev : null));
  const connection = useOrbit((s) => s.connection);
  const call = useOrbit((s) => s.call);
  const prefs = usePrefs();
  const look = useUserLook(me?.userId ?? "");
  const profile = useProfileMenu();
  const deviceMenu = useMenu();
  const [which, setWhich] = useState<{ kind: "audioinput" | "audiooutput"; list: MediaDeviceChoice[] } | null>(null);
  const banner = me?.profileBanner ?? null;
  const bannerUrl = usePhoto("profileBanner", me?.userId ?? "", banner?.rev ?? null, banner?.kind === "gif" ? "image/gif" : banner?.kind === "webp" ? "image/webp" : "image/jpeg");
  if (!me) return null;
  const now = Date.now();
  const online = connection === "online";
  const presence = PRESENCE_LABEL[currentPresence(me.presenceMode, me.presenceUntil, now)].label;
  const line = online ? (statusLine(me, now) ?? presence) : CONN_LABEL[connection];
  const inCall = call.phase !== "idle" && !call.listenOnly;
  const micOff = inCall ? !call.micOn : prefs.joinMuted || prefs.joinDeafened;
  const deafened = inCall ? call.deafened : prefs.joinDeafened;
  const colors = look.profileStyle?.nameColors ?? (look.profileStyle?.accent ? [look.profileStyle.accent] : null);
  const backdrop = bannerUrl ? { backgroundImage: `url(${bannerUrl})` } : colors ? { background: colors.length > 1 ? `linear-gradient(120deg, ${colors.join(", ")})` : colors[0] } : undefined;

  const toggleMic = () => {
    if (inCall) return void engine.calls.toggleMicrophone();
    // Unmuting while deafened brings the sound back too, as in a call.
    if (prefs.joinDeafened) setPrefs({ joinDeafened: false, joinMuted: false });
    else setPrefs({ joinMuted: !prefs.joinMuted });
  };
  const toggleDeafen = () => {
    if (inCall) return void engine.calls.toggleDeafen();
    setPrefs({ joinDeafened: !prefs.joinDeafened });
  };
  const openDevices = (kind: "audioinput" | "audiooutput", el: HTMLElement) =>
    void devices(kind).then((list) => {
      setWhich({ kind, list });
      deviceMenu.open(el);
    });
  const chosen = which?.kind === "audioinput" ? prefs.microphoneId : prefs.speakerId;
  const pick = (id: string | null) => {
    if (which?.kind === "audioinput") {
      setPrefs({ microphoneId: id });
      if (inCall && id) void engine.calls.useDevice("audioinput", id).catch(() => engine.notice("error", "Couldn't switch to that microphone."));
    } else {
      setPrefs({ speakerId: id });
      engine.calls.applyOutput();
    }
  };
  const deviceEntries: MenuEntry[] = which
    ? [
        { heading: which.kind === "audioinput" ? "Input device" : "Output device" },
        { label: "System default", checked: chosen === null, onSelect: () => pick(null) },
        ...which.list.map((d) => ({ label: d.label, checked: chosen === d.deviceId, onSelect: () => pick(d.deviceId) })),
        ...(which.list.length === 0 ? [{ custom: <div className="side-quiet">Allow the microphone once (Voice & Audio › Mic test) to see device names.</div> }] : []),
        "separator" as const,
        { label: "Voice & Audio settings", icon: <Settings size={16} />, onSelect: () => navigate({ section: "settings", settingsPage: "calls" }) },
      ]
    : [];

  return (
    <div className={`user-panel${backdrop ? " has-banner" : ""}`} data-connection={connection} {...contextMenuProps((el) => profile.open(el))}>
      {backdrop && <div className="user-panel-banner" style={backdrop} aria-hidden="true" />}
      <button
        className="user-panel-me"
        onClick={(e) => profile.open(e.currentTarget)}
        aria-haspopup="menu"
        aria-expanded={profile.expanded}
        aria-label={`${me.displayName}: ${line}. Your profile and settings`}
      >
        <LookAvatar userId={me.userId} name={me.displayName} colorIndex={me.avatarColor} photoRev={myPhoto} size={36} online={online} />
        <span className="lines">
          <strong className="user-panel-name">
            <StyledName name={me.displayName} style={look.profileStyle} className="ellipsis" />
          </strong>
          <small className={`ellipsis${online ? "" : " conn-warn"}`}>{line}</small>
        </span>
      </button>
      {!online && (
        <button
          className="icon-btn user-panel-btn"
          onClick={() => engine.reconnect()}
          aria-label="Reconnect now"
          title="Not connected. Messages you send wait and go out when the connection is back. Click to reconnect now."
        >
          <RotateCw size={17} />
        </button>
      )}
      <div className={`user-panel-pair${micOff ? " off" : ""}`}>
        <button
          className="icon-btn user-panel-btn"
          onClick={toggleMic}
          aria-pressed={micOff}
          aria-label={micOff ? "Unmute" : "Mute"}
          title={inCall ? (micOff ? "Unmute" : "Mute") : micOff ? "You'll join calls muted. Click to join unmuted" : "Join calls muted"}
        >
          {micOff ? <MicOff size={19} /> : <Mic size={19} />}
        </button>
        <button className="icon-btn user-panel-caret" onClick={(e) => openDevices("audioinput", e.currentTarget)} aria-haspopup="menu" aria-label="Input device">
          <ChevronDown size={14} />
        </button>
      </div>
      <div className={`user-panel-pair${deafened ? " off" : ""}`}>
        <button
          className="icon-btn user-panel-btn"
          onClick={toggleDeafen}
          aria-pressed={deafened}
          aria-label={deafened ? "Undeafen" : "Deafen"}
          title={inCall ? (deafened ? "Undeafen" : "Deafen") : deafened ? "You'll join calls deafened. Click to hear again" : "Join calls deafened"}
        >
          {deafened ? <HeadphoneOff size={19} /> : <Headphones size={19} />}
        </button>
        <button className="icon-btn user-panel-caret" onClick={(e) => openDevices("audiooutput", e.currentTarget)} aria-haspopup="menu" aria-label="Output device">
          <ChevronDown size={14} />
        </button>
      </div>
      <button className="icon-btn user-panel-btn" onClick={() => navigate({ section: "settings", settingsPage: "account" })} aria-label="Settings" title="Settings">
        <Settings size={19} />
      </button>
      {deviceMenu.anchor && which && (
        <Menu anchor={deviceMenu.anchor} align="end" label={which.kind === "audioinput" ? "Input device" : "Output device"} onClose={deviceMenu.close} entries={deviceEntries} />
      )}
      {profile.ui}
    </div>
  );
}
