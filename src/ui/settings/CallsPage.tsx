import { Camera, Mic } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { setPrefs, usePrefs } from "../../application/prefs";
import { audioProcessing, micLevel, SHARE_MODES } from "../../call/rules";
import { Toggle } from "../components/Toggle";

/**
 * Settings › Calls (batches B10, B11; android Settings › Calls): noise reduction for the next call, how a screen is shared
 * by default, and a check of the microphone and camera. The check records and sends nothing, and releases the devices
 * when it stops or the page closes.
 */
export function CallsPage() {
  const prefs = usePrefs();
  return (
    <>
      <h1>Calls</h1>
      <div className="card" style={{ padding: "4px 20px" }}>
        <div className="setting">
          <span className="lines">
            <strong>Noise reduction</strong>
            <small>Background noise reduction and automatic level on your microphone. Applies from the next call.</small>
          </span>
          <Toggle checked={prefs.noiseReduction} onChange={(noiseReduction) => setPrefs({ noiseReduction })} label="Noise reduction" />
        </div>
        <div className="setting">
          <span className="lines">
            <strong>Screen sharing</strong>
            <small>
              {SHARE_MODES[prefs.shareMode].label}
              {prefs.shareAudio ? ", with sound" : ""}. You choose each time you share; this is the last choice.
            </small>
          </span>
        </div>
      </div>
      <PreCallCheck noiseReduction={prefs.noiseReduction} />
    </>
  );
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
