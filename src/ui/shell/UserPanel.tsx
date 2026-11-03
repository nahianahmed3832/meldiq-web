import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { Avatar } from "../components/Avatar";
import { useAccountActions, useAccountSwitcher } from "./AccountActions";
import { ArrowRightLeft, Plus, ChevronDown, Headphones, HeadphoneOff, Mic, MicOff, LogOut, RotateCw, Settings } from "lucide-react";
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
    .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `${kind === "audioinput" ? uiText("calls.microphone") : uiText("calls.interface.speaker_a9e0c70")} ${i + 1}` }));
}
/**
 * The bottom of the sidebar (the reference's user panel, 2026-10-28): you on your profile banner, with your presence or
 * the connection's state; then your microphone and headphones, each with a menu of devices, and Settings. In a call
 * they mute and deafen it; outside one they say how the next call starts. Your name opens the profile menu (status,
 * Activity, Saved, theme, sign out); a right-click on the panel opens it too. Desktop only: phones keep the top bar.
 */
export function UserPanel() {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const me = useOrbit((s) => s.me);
  const myPhoto = useOrbit((s) => (s.me ? s.users[s.me.userId]?.photoRev : null));
  const connection = useOrbit((s) => s.connection);
  const call = useOrbit((s) => s.call);
  const prefs = usePrefs();
  const look = useUserLook(me?.userId ?? "");
  const profile = useProfileMenu();
  const deviceMenu = useMenu();
  const accounts = useMenu();
  const accountAction = useAccountActions();
  const switcher = useAccountSwitcher();
  const [which, setWhich] = useState<{
    kind: "audioinput" | "audiooutput";
    list: MediaDeviceChoice[];
  } | null>(null);
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
  // API 0.65.0: the profile theme first, then the name's colours (older servers: the accent).
  const colors = look.profileStyle?.themeColors ?? look.profileStyle?.nameColors ?? (look.profileStyle?.accent ? [look.profileStyle.accent] : null);
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
      if (inCall && id) void engine.calls.useDevice("audioinput", id).catch(() => engine.notice("error", uiText("workspace.interface.couldn_t_switch_to_that_microphone_c8ef80e")));
    } else {
      setPrefs({ speakerId: id });
      engine.calls.applyOutput();
    }
  };
  const deviceEntries: MenuEntry[] = which
    ? [
        { heading: which.kind === "audioinput" ? uiText("workspace.interface.input_device_42b6a9e") : uiText("workspace.interface.output_device_b2fad20") },
        {
          get label() {
            return uiText("workspace.interface.system_default_b045921");
          },
          checked: chosen === null,
          onSelect: () => pick(null),
        },
        ...which.list.map((d) => ({ label: d.label, checked: chosen === d.deviceId, onSelect: () => pick(d.deviceId) })),
        ...(which.list.length === 0
          ? [
              {
                custom: (
                  <div className="side-quiet">
                    <Localized k="workspace.interface.allow_the_microphone_once_voice_audio_mic_test_to_see_device_name_ce04bfa" />
                  </div>
                ),
              },
            ]
          : []),
        "separator" as const,
        {
          get label() {
            return uiText("workspace.interface.voice_audio_settings_7a79b6b");
          },
          icon: <Settings size={16} />,
          onSelect: () => navigate({ section: "settings", settingsPage: "calls" }),
        },
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
        aria-label={uiText("workspace.interface.value0_value1_your_profile_and_settings_2beb222", { value0: me.displayName, value1: line })}
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
          aria-label={uiText("workspace.interface.reconnect_now_f786f0e")}
          title={uiText("workspace.interface.not_connected_messages_you_send_wait_and_go_out_when_the_connecti_0b88160")}
        >
          <RotateCw size={17} />
        </button>
      )}
      <div className={`user-panel-pair${micOff ? " off" : ""}`}>
        <button
          className="icon-btn user-panel-btn"
          onClick={toggleMic}
          aria-pressed={micOff}
          aria-label={micOff ? l10n("notifications.bell_unmute") : l10n("notifications.bell_mute")}
          title={
            inCall
              ? micOff
                ? l10n("notifications.bell_unmute")
                : l10n("notifications.bell_mute")
              : micOff
                ? uiText("workspace.interface.you_ll_join_calls_muted_click_to_join_unmuted_6d9382b")
                : uiText("workspace.interface.join_calls_muted_100d935")
          }
        >
          {micOff ? <MicOff size={19} /> : <Mic size={19} />}
        </button>
        <button className="icon-btn user-panel-caret" onClick={(e) => openDevices("audioinput", e.currentTarget)} aria-haspopup="menu" aria-label={uiText("workspace.interface.input_device_42b6a9e")}>
          <ChevronDown size={14} />
        </button>
      </div>
      <div className={`user-panel-pair${deafened ? " off" : ""}`}>
        <button
          className="icon-btn user-panel-btn"
          onClick={toggleDeafen}
          aria-pressed={deafened}
          aria-label={deafened ? uiText("workspace.interface.undeafen_1e4529c") : uiText("calls.interface.deafen_97081eb")}
          title={
            inCall
              ? deafened
                ? uiText("workspace.interface.undeafen_1e4529c")
                : uiText("calls.interface.deafen_97081eb")
              : deafened
                ? uiText("workspace.interface.you_ll_join_calls_deafened_click_to_hear_again_ec6c84e")
                : uiText("workspace.interface.join_calls_deafened_acbdfd8")
          }
        >
          {deafened ? <HeadphoneOff size={19} /> : <Headphones size={19} />}
        </button>
        <button
          className="icon-btn user-panel-caret"
          onClick={(e) => openDevices("audiooutput", e.currentTarget)}
          aria-haspopup="menu"
          aria-label={uiText("workspace.interface.output_device_b2fad20")}
        >
          <ChevronDown size={14} />
        </button>
      </div>
      <button className="icon-btn user-panel-btn" onClick={() => navigate({ section: "settings", settingsPage: "account" })} aria-label={l10n("settings.title")} title={l10n("settings.title")}>
        <Settings size={19} />
      </button>
      <button
        className="icon-btn user-panel-btn user-panel-account"
        aria-label={uiText("workspace.interface.account_options_fb15613")}
        title={uiText("workspace.interface.switch_account_or_log_out_7558dd8")}
        aria-haspopup="menu"
        aria-expanded={!!accounts.anchor}
        onClick={(e) => accounts.open(e.currentTarget)}
      >
        <ChevronDown size={17} />
      </button>
      {accounts.anchor && (
        <Menu
          anchor={accounts.anchor}
          align="end"
          label={uiText("workspace.interface.account_options_fb15613")}
          onClose={accounts.close}
          entries={[
            {
              get heading() {
                return uiText("workspace.interface.your_accounts_fdd5abe");
              },
            },
            ...switcher.accounts.map((a) => ({
              label: a.displayName,
              hint: `@${a.username}`,
              icon: <Avatar name={a.displayName} colorIndex={a.avatarColor} size={24} decorative />,
              checked: a.database === switcher.current,
              disabled: switcher.busy,
              onSelect: () => switcher.switchTo(a.database),
            })),
            "separator",
            {
              get label() {
                return uiText("workspace.interface.add_account_ee7ee58");
              },
              icon: <Plus size={16} />,
              disabled: switcher.busy,
              onSelect: switcher.add,
            },
            {
              get label() {
                return uiText("settings.interface.switch_account_fedce01");
              },
              icon: <ArrowRightLeft size={16} />,
              onSelect: () => accountAction("switch"),
            },
            "separator",
            {
              get label() {
                return uiText("settings.interface.log_out_4961614");
              },
              icon: <LogOut size={16} />,
              danger: true,
              onSelect: () => accountAction("logout"),
            },
          ]}
        />
      )}
      {deviceMenu.anchor && which && (
        <Menu
          anchor={deviceMenu.anchor}
          align="end"
          label={which.kind === "audioinput" ? uiText("workspace.interface.input_device_42b6a9e") : uiText("workspace.interface.output_device_b2fad20")}
          onClose={deviceMenu.close}
          entries={deviceEntries}
        />
      )}
      {profile.ui}
    </div>
  );
}
