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
  const speakerChoice = typeof (HTMLMediaElement.prototype as { setSinkId?: unknown }).setSinkId === "function";
  return (
    <>
      <h1>Voice & Audio</h1>
      <div className="card setting-card">
        <div className="voice-devices">
          <label className="field">
            <span>Microphone</span>
            <select className="input" value={prefs.microphoneId ?? ""} onChange={(e) => setPrefs({ microphoneId: e.target.value || null })}>
              <option value="">Default</option>
              {mics.map((d, i) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {label(d, i, "Microphone")}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Speakers</span>
            <select
              className="input"
              value={prefs.speakerId ?? ""}
              disabled={!speakerChoice}
              onChange={(e) => {
                setPrefs({ speakerId: e.target.value || null });
                engine.calls.applyOutput();
              }}
            >
              <option value="">Default</option>
              {speakers.map((d, i) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {label(d, i, "Speaker")}
                </option>
              ))}
            </select>
          </label>
        </div>
        {!speakerChoice && <small className="faint">This browser always plays calls on the system's default speaker.</small>}
        {mics.length > 0 && !mics[0].label && <small className="faint">Device names show once you've allowed the microphone (try the mic test below).</small>}
        <label className="range-row">
          <span>Output volume</span>
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
          <strong style={{ width: 44, textAlign: "end" }}>{prefs.outputVolume}%</strong>
        </label>
      </div>

      <PreCallCheck noiseReduction={prefs.noiseReduction} />

      <h2 className="settings-group">Input mode</h2>
      <div className="input-modes" role="radiogroup" aria-label="Input mode">
        <button type="button" role="radio" aria-checked={!prefs.pushToTalk} className="kind-option" onClick={() => setPrefs({ pushToTalk: false })}>
          <strong>Voice activity</strong>
          <small>Your mic is on while you're not muted.</small>
        </button>
        <button type="button" role="radio" aria-checked={prefs.pushToTalk} className="kind-option" onClick={() => (prefs.pttKey ? setPrefs({ pushToTalk: true }) : setRecording(true))}>
          <strong>Push to talk</strong>
          <small>Hold a key to talk.</small>
        </button>
      </div>
      {(prefs.pushToTalk || recording) && (
        <div className="card setting-card">
          <div className="setting-card-head">
            <span className="lines grow">
              <strong>Push to talk key</strong>
              <small>{recording ? "Press the key you want (Escape cancels)." : prefs.pttKey ? `Hold ${keyName(prefs.pttKey)} to talk in calls.` : "No key yet."}</small>
            </span>
            <button className="btn btn-secondary btn-sm" onClick={() => setRecording(true)} aria-pressed={recording}>
              {recording ? "Listening…" : prefs.pttKey ? "Change key" : "Choose key"}
            </button>
          </div>
        </div>
      )}

      <h2 className="settings-group">Voice processing</h2>
      <div className="card" style={{ padding: "4px 20px" }}>
        <div className="setting">
          <span className="lines">
            <strong>Noise suppression</strong>
            <small>Cuts fans, keyboards and background noise.</small>
          </span>
          <Toggle checked={prefs.noiseReduction} onChange={(noiseReduction) => setPrefs({ noiseReduction })} label="Noise suppression" />
        </div>
        <div className="setting">
          <span className="lines">
            <strong>Echo cancellation</strong>
            <small>Stops others hearing themselves through your speakers.</small>
          </span>
          <Toggle checked={prefs.echoCancellation} onChange={(echoCancellation) => setPrefs({ echoCancellation })} label="Echo cancellation" />
        </div>
        <div className="setting">
          <span className="lines">
            <strong>Automatic gain</strong>
            <small>Keeps your volume even. Turn off for music or a good mic.</small>
          </span>
          <Toggle checked={prefs.autoGain} onChange={(autoGain) => setPrefs({ autoGain })} label="Automatic gain" />
        </div>
        <small className="faint" style={{ display: "block", padding: "8px 0 12px" }}>
          These apply from the next call.
        </small>
      </div>

      <h2 className="settings-group">Joining calls</h2>
      <div className="card" style={{ padding: "4px 20px" }}>
        <div className="setting">
          <span className="lines">
            <strong>Join muted</strong>
            <small>Your microphone starts off; unmute when you're ready. Also on the microphone button under your name.</small>
          </span>
          <Toggle checked={prefs.joinMuted} onChange={(joinMuted) => setPrefs({ joinMuted })} label="Join muted" />
        </div>
        <div className="setting">
          <span className="lines">
            <strong>Screen sharing</strong>
            <small>
              {SHARE_QUALITIES[prefs.shareQuality].label} ({SHARE_QUALITIES[prefs.shareQuality].width}×{SHARE_QUALITIES[prefs.shareQuality].height} at {SHARE_QUALITIES[prefs.shareQuality].frameRate}{" "}
              fps)
              {prefs.shareAudio ? ", with sound" : ""}. You choose each time you share; this is the last choice.
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
    CapsLock: "Caps Lock",
    ControlLeft: "Left Ctrl",
    ControlRight: "Right Ctrl",
    AltLeft: "Left Alt",
    AltRight: "Right Alt",
    ShiftLeft: "Left Shift",
    ShiftRight: "Right Shift",
    MetaLeft: "Left ⌘",
    MetaRight: "Right ⌘",
  };
  return named[code] ?? code;
}

/** No camera, or it's busy or gone: the microphone can still be checked on its own. */
const CAMERA_MISSING = ["NotFoundError", "NotReadableError", "OverconstrainedError"];

/** The microphone and camera for the check; without a usable camera, the microphone alone (cameraMissing). */
async function openForCheck(audio: MediaTrackConstraints, cam: string): Promise<{ stream: MediaStream; cameraMissing: boolean }> {
  try {
    return { stream: await navigator.mediaDevices.getUserMedia({ audio, video: cam ? { deviceId: { exact: cam } } : true }), cameraMissing: false };
  } catch (e) {
    if (!(e instanceof DOMException && CAMERA_MISSING.includes(e.name))) throw e;
    return { stream: await navigator.mediaDevices.getUserMedia({ audio, video: false }), cameraMissing: true };
  }
}

/** Check microphone and camera (android PreCallCheckSheet): a level bar that moves when you speak, and your picture. */
function PreCallCheck({ noiseReduction }: { noiseReduction: boolean }) {
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
            ? "This browser isn't allowed to use your microphone or camera. Allow them in the address bar, then try again."
            : "Your microphone or camera couldn't be started.",
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
      <h3 style={{ margin: 0 }}>Check microphone and camera</h3>
      <p className="muted" style={{ margin: 0 }}>
        Nothing is recorded or sent. The devices are released when you stop.
      </p>
      {error && (
        <div className="banner danger" role="alert">
          {error}
        </div>
      )}
      {on && cameraMissing && (
        <div className="banner info" role="status">
          No camera could be started, so only your microphone is being checked.
        </div>
      )}
      {on && (
        <>
          <div className="precall">
            <video ref={video} className="precall-video" autoPlay playsInline muted />
            <div className="precall-side">
              <label className="field">
                <span>
                  <Mic size={14} aria-hidden /> Microphone
                </span>
                <select className="input" value={mic} onChange={(e) => setMic(e.target.value)}>
                  <option value="">Default</option>
                  {mics.map((d, i) => (
                    <option key={d.deviceId || i} value={d.deviceId}>
                      {d.label || `Microphone ${i + 1}`}
                    </option>
                  ))}
                </select>
              </label>
              <div className="meter" role="meter" aria-label="Microphone level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)}>
                <span style={{ width: `${Math.round(level * 100)}%` }} />
              </div>
              <label className="field">
                <span>
                  <Camera size={14} aria-hidden /> Camera
                </span>
                <select className="input" value={cam} onChange={(e) => setCam(e.target.value)}>
                  <option value="">Default</option>
                  {cams.map((d, i) => (
                    <option key={d.deviceId || i} value={d.deviceId}>
                      {d.label || `Camera ${i + 1}`}
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
          {on ? "Stop" : "Start the check"}
        </button>
      </div>
    </div>
  );
}
