import { formatUiNumber } from "../../i18n/format";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { Camera, Mic } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { setPrefs, usePrefs } from "../../application/prefs";
import { useEngine } from "../../application/orbit";
import { audioProcessing, micLevel } from "../../call/rules";
import { SHARE_QUALITIES } from "../../call/shareQuality";
import { Toggle } from "../components/Toggle";
/**
 * Settings › Calls (batches B10, B11; android Settings › Calls): noise reduction for the next call, how a screen is shared
 * by default, and a check of the microphone and camera. The check records and sends nothing, and releases the devices
 * when it stops or the page closes.
 */
export function CallsPage() {
  useLocaleRender();
  const l10n = useLocalization();
  const prefs = usePrefs();
  const engine = useEngine();
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [speakers, setSpeakers] = useState<MediaDeviceInfo[]>([]);
  const [recording, setRecording] = useState(false);
  const loadDevices = () =>
    void navigator.mediaDevices
      ?.enumerateDevices()
      .then((all) => {
        const real = all.filter((d) => d.deviceId && d.deviceId !== "default" && d.deviceId !== "communications");
        setMics(real.filter((d) => d.kind === "audioinput"));
        setSpeakers(real.filter((d) => d.kind === "audiooutput"));
      })
      .catch(() => undefined);
  useEffect(() => {
    loadDevices();
    navigator.mediaDevices?.addEventListener?.("devicechange", loadDevices);
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", loadDevices);
  }, []);
  // Push to talk: the next key pressed (Escape cancels) becomes the key.
  useEffect(() => {
    if (!recording) return;
    const pick = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setRecording(false);
      if (e.key !== "Escape") setPrefs({ pttKey: e.code, pushToTalk: true });
    };
    window.addEventListener("keydown", pick, true);
    return () => window.removeEventListener("keydown", pick, true);
  }, [recording]);
  const label = (d: MediaDeviceInfo, i: number, kind: string) => d.label || `${kind} ${i + 1}`;
  const speakerChoice =
    typeof (
      HTMLMediaElement.prototype as {
        setSinkId?: unknown;
      }
    ).setSinkId === "function";
  return (
    <>
      <h1>{l10n("settings.settings_calls")}</h1>
      <div className="card setting-card">
        <div className="voice-devices">
          <label className="field">
            <span>
              <Localized k="calls.microphone" />
            </span>
            <select className="input" value={prefs.microphoneId ?? ""} onChange={(e) => setPrefs({ microphoneId: e.target.value || null })}>
              <option value="">{l10n("settings.ap_default")}</option>
              {mics.map((d, i) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {label(d, i, uiText("calls.microphone"))}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>
              <Localized k="calls.interface.speakers_c92a723" />
            </span>
            <select
              className="input"
              value={prefs.speakerId ?? ""}
              disabled={!speakerChoice}
              onChange={(e) => {
                setPrefs({ speakerId: e.target.value || null });
                engine.calls.applyOutput();
              }}
            >
              <option value="">{l10n("settings.ap_default")}</option>
              {speakers.map((d, i) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {label(d, i, uiText("calls.interface.speaker_a9e0c70"))}
                </option>
              ))}
            </select>
          </label>
        </div>
        {!speakerChoice && (
          <small className="faint">
            <Localized k="calls.interface.this_browser_always_plays_calls_on_the_system_s_default_speaker_75584b1" />
          </small>
        )}
        {mics.length > 0 && !mics[0].label && (
          <small className="faint">
            <Localized k="calls.interface.device_names_show_once_you_ve_allowed_the_microphone_try_the_mic_7dced95" />
          </small>
        )}
        <label className="range-row">
          <span>
            <Localized k="calls.interface.output_volume_735bacc" />
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={prefs.outputVolume}
            onChange={(e) => {
              setPrefs({ outputVolume: Number(e.target.value) });
              engine.calls.applyOutput();
            }}
          />
          <strong style={{ width: 44, textAlign: "end" }}>{formatUiNumber(prefs.outputVolume)}%</strong>
        </label>
      </div>

      <PreCallCheck noiseReduction={prefs.noiseReduction} />

      <h2 className="settings-group">
        <Localized k="calls.interface.input_mode_3fa818f" />
      </h2>
      <div className="input-modes" role="radiogroup" aria-label={uiText("calls.interface.input_mode_3fa818f")}>
        <button type="button" role="radio" aria-checked={!prefs.pushToTalk} className="kind-option" onClick={() => setPrefs({ pushToTalk: false })}>
          <strong>
            <Localized k="calls.interface.voice_activity_5a16bda" />
          </strong>
          <small>
            <Localized k="calls.interface.your_mic_is_on_while_you_re_not_muted_e007a21" />
          </small>
        </button>
        <button type="button" role="radio" aria-checked={prefs.pushToTalk} className="kind-option" onClick={() => (prefs.pttKey ? setPrefs({ pushToTalk: true }) : setRecording(true))}>
          <strong>
            <Localized k="calls.interface.push_to_talk_03fc694" />
          </strong>
          <small>
            <Localized k="calls.interface.hold_a_key_to_talk_90d0042" />
          </small>
        </button>
      </div>
      {(prefs.pushToTalk || recording) && (
        <div className="card setting-card">
          <div className="setting-card-head">
            <span className="lines grow">
              <strong>
                <Localized k="calls.interface.push_to_talk_key_5c54f6d" />
              </strong>
              <small>
                {recording
                  ? uiText("calls.interface.press_the_key_you_want_escape_cancels_a17e82e")
                  : prefs.pttKey
                    ? uiText("calls.interface.hold_value0_to_talk_in_calls_f7ee8fb", { value0: keyName(prefs.pttKey) })
                    : uiText("calls.interface.no_key_yet_9fb323b")}
              </small>
            </span>
            <button className="btn btn-secondary btn-sm" onClick={() => setRecording(true)} aria-pressed={recording}>
              {recording ? uiText("calls.interface.listening_bbb4106") : prefs.pttKey ? uiText("calls.interface.change_key_1bc0f4d") : uiText("calls.interface.choose_key_a2bc5ee")}
            </button>
          </div>
        </div>
      )}

      <h2 className="settings-group">
        <Localized k="calls.interface.voice_processing_cb63f47" />
      </h2>
      <div className="card" style={{ padding: "4px 20px" }}>
        <div className="setting">
          <span className="lines">
            <strong>
              <Localized k="calls.interface.noise_suppression_a5c124c" />
            </strong>
            <small>
              <Localized k="calls.interface.cuts_fans_keyboards_and_background_noise_63fa7f0" />
            </small>
          </span>
          <Toggle checked={prefs.noiseReduction} onChange={(noiseReduction) => setPrefs({ noiseReduction })} label={uiText("calls.interface.noise_suppression_a5c124c")} />
        </div>
        <div className="setting">
          <span className="lines">
            <strong>
              <Localized k="calls.interface.echo_cancellation_311baa5" />
            </strong>
            <small>
              <Localized k="calls.interface.stops_others_hearing_themselves_through_your_speakers_69d88af" />
            </small>
          </span>
          <Toggle checked={prefs.echoCancellation} onChange={(echoCancellation) => setPrefs({ echoCancellation })} label={uiText("calls.interface.echo_cancellation_311baa5")} />
        </div>
        <div className="setting">
          <span className="lines">
            <strong>
              <Localized k="calls.interface.automatic_gain_e076a1d" />
            </strong>
            <small>
              <Localized k="calls.interface.keeps_your_volume_even_turn_off_for_music_or_a_good_mic_52a18ad" />
            </small>
          </span>
          <Toggle checked={prefs.autoGain} onChange={(autoGain) => setPrefs({ autoGain })} label={uiText("calls.interface.automatic_gain_e076a1d")} />
        </div>
        <small className="faint" style={{ display: "block", padding: "8px 0 12px" }}>
          <Localized k="calls.interface.these_apply_from_the_next_call_49431f3" />
        </small>
      </div>

      <h2 className="settings-group">
        <Localized k="calls.interface.joining_calls_49363c0" />
      </h2>
      <div className="card" style={{ padding: "4px 20px" }}>
        <div className="setting">
          <span className="lines">
            <strong>
              <Localized k="calls.interface.join_muted_10b220f" />
            </strong>
            <small>
              <Localized k="calls.interface.your_microphone_starts_off_unmute_when_you_re_ready_also_on_the_m_8e5780e" />
            </small>
          </span>
          <Toggle checked={prefs.joinMuted} onChange={(joinMuted) => setPrefs({ joinMuted })} label={uiText("calls.interface.join_muted_10b220f")} />
        </div>
        <div className="setting">
          <span className="lines">
            <strong>
              <Localized k="billing.interface.screen_sharing_74dc20e" />
            </strong>
            <small>
              <Localized
                k="calls.interface.at_fps_you_choose_each_time_you_share_this_is_the_last_choice_2cbdeef"
                slots={[
                  SHARE_QUALITIES[prefs.shareQuality].label,
                  SHARE_QUALITIES[prefs.shareQuality].width,
                  SHARE_QUALITIES[prefs.shareQuality].height,
                  SHARE_QUALITIES[prefs.shareQuality].frameRate,
                  prefs.shareAudio ? uiText("calls.interface.with_sound_df75f29") : "",
                ]}
              />
            </small>
          </span>
        </div>
      </div>
    </>
  );
}
/** "Backquote" → "`", "KeyV" → "V", "F13" stays: how a KeyboardEvent.code reads to people. */
export function keyName(code: string): string {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  const named: Record<string, string> = {
    Backquote: "`",
    Space: "Space",
    CapsLock: uiText("calls.interface.caps_lock_71c8e9d"),
    ControlLeft: uiText("calls.interface.left_ctrl_5395988"),
    ControlRight: uiText("calls.interface.right_ctrl_cca1910"),
    AltLeft: uiText("calls.interface.left_alt_c975c1d"),
    AltRight: uiText("calls.interface.right_alt_473cbe0"),
    ShiftLeft: uiText("calls.interface.left_shift_f75aa1d"),
    ShiftRight: uiText("calls.interface.right_shift_b0ea7ae"),
    MetaLeft: uiText("calls.interface.left_00055c5"),
    MetaRight: uiText("calls.interface.right_415296c"),
  };
  return named[code] ?? code;
}
/** No camera, or it's busy or gone: the microphone can still be checked on its own. */
const CAMERA_MISSING = ["NotFoundError", "NotReadableError", "OverconstrainedError"];
/** The microphone and camera for the check; without a usable camera, the microphone alone (cameraMissing). */
async function openForCheck(
  audio: MediaTrackConstraints,
  cam: string,
): Promise<{
  stream: MediaStream;
  cameraMissing: boolean;
}> {
  try {
    return { stream: await navigator.mediaDevices.getUserMedia({ audio, video: cam ? { deviceId: { exact: cam } } : true }), cameraMissing: false };
  } catch (e) {
    if (!(e instanceof DOMException && CAMERA_MISSING.includes(e.name))) throw e;
    return { stream: await navigator.mediaDevices.getUserMedia({ audio, video: false }), cameraMissing: true };
  }
}
/** Check microphone and camera (android PreCallCheckSheet): a level bar that moves when you speak, and your picture. */
function PreCallCheck({ noiseReduction }: { noiseReduction: boolean }) {
  useLocaleRender();
  const l10n = useLocalization();
  const [on, setOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [mic, setMic] = useState("");
  const [cam, setCam] = useState("");
  const [cameraMissing, setCameraMissing] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!on) return;
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    let frame = 0;
    let alive = true;
    const el = video.current;
    (async () => {
      try {
        const opened = await openForCheck({ ...audioProcessing(noiseReduction), ...(mic ? { deviceId: { exact: mic } } : {}) }, cam);
        stream = opened.stream;
        if (!alive) return stream.getTracks().forEach((t) => t.stop());
        const list = await navigator.mediaDevices.enumerateDevices();
        // Stopped (or a device changed) while the list loaded: the cleanup already released the stream.
        if (!alive) return;
        setDevices(list);
        setCameraMissing(opened.cameraMissing);
        if (el) el.srcObject = stream;
        ctx = new AudioContext();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const buf = new Float32Array(analyser.fftSize);
        const tick = () => {
          analyser.getFloatTimeDomainData(buf);
          // Whole percents only: the card re-renders when the bar visibly moves, not on every frame.
          setLevel(Math.round(micLevel(buf) * 100) / 100);
          frame = requestAnimationFrame(tick);
        };
        tick();
        setError(null);
      } catch (e) {
        if (!alive) return;
        setError(
          e instanceof DOMException && e.name === "NotAllowedError"
            ? uiText("calls.interface.this_browser_isn_t_allowed_to_use_your_microphone_or_camera_allow_00525df")
            : uiText("calls.interface.your_microphone_or_camera_couldn_t_be_started_e2b68f8"),
        );
        setOn(false);
      }
    })();
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      void ctx?.close();
      stream?.getTracks().forEach((t) => t.stop());
      if (el) el.srcObject = null;
      setLevel(0);
    };
  }, [on, mic, cam, noiseReduction]);
  const mics = devices.filter((d) => d.kind === "audioinput");
  const cams = devices.filter((d) => d.kind === "videoinput");
  return (
    <div className="card" style={{ padding: 20, display: "grid", gap: 12 }}>
      <h3 style={{ margin: 0 }}>
        <Localized k="calls.interface.check_microphone_and_camera_5d722e0" />
      </h3>
      <p className="muted" style={{ margin: 0 }}>
        <Localized k="calls.interface.nothing_is_recorded_or_sent_the_devices_are_released_when_you_sto_9b63a3a" />
      </p>
      {error && (
        <div className="banner danger" role="alert">
          {error}
        </div>
      )}
      {on && cameraMissing && (
        <div className="banner info" role="status">
          <Localized k="calls.interface.no_camera_could_be_started_so_only_your_microphone_is_being_check_4f2ad87" />
        </div>
      )}
      {on && (
        <>
          <div className="precall">
            <video ref={video} className="precall-video" autoPlay playsInline muted />
            <div className="precall-side">
              <label className="field">
                <span>
                  <Localized k="calls.interface.microphone_0113b92" slots={[<Mic size={14} aria-hidden />]} />
                </span>
                <select className="input" value={mic} onChange={(e) => setMic(e.target.value)}>
                  <option value="">{l10n("settings.ap_default")}</option>
                  {mics.map((d, i) => (
                    <option key={d.deviceId || i} value={d.deviceId}>
                      {d.label || uiText("calls.interface.microphone_value0_f994910", { value0: i + 1 })}
                    </option>
                  ))}
                </select>
              </label>
              <div className="meter" role="meter" aria-label={uiText("calls.interface.microphone_level_351d1a3")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)}>
                <span style={{ width: `${Math.round(level * 100)}%` }} />
              </div>
              <label className="field">
                <span>
                  <Localized k="calls.interface.camera_1130c74" slots={[<Camera size={14} aria-hidden />]} />
                </span>
                <select className="input" value={cam} onChange={(e) => setCam(e.target.value)}>
                  <option value="">{l10n("settings.ap_default")}</option>
                  {cams.map((d, i) => (
                    <option key={d.deviceId || i} value={d.deviceId}>
                      {d.label || uiText("calls.interface.camera_value0_9eb5f9a", { value0: i + 1 })}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </>
      )}
      <div>
        <button className={`btn ${on ? "btn-secondary" : "btn-primary"}`} onClick={() => setOn(!on)}>
          {on ? uiText("calls.interface.stop_cae7d57") : uiText("calls.interface.start_the_check_232c55a")}
        </button>
      </div>
    </div>
  );
}
