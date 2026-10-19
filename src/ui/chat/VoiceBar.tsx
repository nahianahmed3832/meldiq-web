import { Mic, Pause, Play, SendHorizontal, Square, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { clock, type Recording, RecordingError, VOICE_MAX_MS, VoiceRecorder } from "../../sync/voice";

type Phase = { k: "starting" } | { k: "recording" } | { k: "ready"; rec: Recording; url: string } | { k: "error"; message: string };

/**
 * Records a voice message in place of the composer (android VoiceViews): recording with a timer, then a preview to play
 * back, delete or send. Nothing is sent until Send. Under a second is discarded; ten minutes stops by itself.
 */
export function VoiceBar({ onSend, onClose }: { onSend: (rec: Recording) => Promise<void>; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>({ k: "starting" });
  const [elapsed, setElapsed] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [sending, setSending] = useState(false);
  const recorder = useRef<VoiceRecorder | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  const stop = async () => {
    const r = recorder.current;
    if (!r) return;
    const rec = await r.stop();
    if (!rec) {
      setNote("Too short to send. Hold on a little longer.");
      setPhase({ k: "error", message: "Too short to send." });
      return;
    }
    setPhase({ k: "ready", rec, url: URL.createObjectURL(rec.blob) });
  };

  useEffect(() => {
    const r = new VoiceRecorder(() => void stop());
    recorder.current = r;
    r.start()
      .then(() => setPhase({ k: "recording" }))
      .catch((e: unknown) => setPhase({ k: "error", message: e instanceof RecordingError ? e.message : "Recording couldn't start." }));
    // Leaving the page or hiding the tab stops recording; what was captured stays for review (as on the phone).
    const hidden = () => document.visibilityState === "hidden" && void stop();
    document.addEventListener("visibilitychange", hidden);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      r.cancel();
    };
  }, []);

  useEffect(() => {
    if (phase.k !== "recording") return;
    const t = setInterval(() => setElapsed(recorder.current?.elapsedMs ?? 0), 250);
    return () => clearInterval(t);
  }, [phase.k]);

  useEffect(() => () => void (phase.k === "ready" && URL.revokeObjectURL(phase.url)), [phase]);

  if (phase.k === "error") {
    return (
      <div className="voice-bar" role="group" aria-label="Voice message">
        <span className="grow" role="alert">
          {note ?? phase.message}
        </span>
        <button className="btn btn-secondary btn-sm" onClick={onClose}>
          Close
        </button>
      </div>
    );
  }
  if (phase.k === "ready") {
    return (
      <div className="voice-bar" role="group" aria-label="Voice message ready to send">
        <button className="icon-btn" onClick={onClose} aria-label="Delete voice message" disabled={sending}>
          <Trash2 size={18} />
        </button>
        <audio ref={audio} src={phase.url} onEnded={() => setPlaying(false)} onPause={() => setPlaying(false)} onPlay={() => setPlaying(true)} preload="metadata" />
        <button
          className="icon-btn"
          aria-label={playing ? "Pause" : `Play voice message, ${Math.round(phase.rec.durationMs / 1000)} seconds`}
          onClick={() => (playing ? audio.current?.pause() : void audio.current?.play())}
        >
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <span className="grow voice-len">{clock(phase.rec.durationMs)}</span>
        <button
          className="send-btn"
          aria-label="Send voice message"
          disabled={sending}
          onClick={() => {
            setSending(true);
            void onSend(phase.rec).finally(() => setSending(false));
          }}
        >
          <SendHorizontal size={17} />
        </button>
      </div>
    );
  }
  return (
    <div className="voice-bar" role="group" aria-label="Recording a voice message">
      <button className="icon-btn" onClick={onClose} aria-label="Cancel recording">
        <Trash2 size={18} />
      </button>
      <span className="rec-dot" aria-hidden="true" />
      <span className="grow voice-len" aria-live="off">
        {phase.k === "starting" ? (
          <>
            <Mic size={14} /> Starting…
          </>
        ) : (
          `${clock(elapsed)} / ${clock(VOICE_MAX_MS)}`
        )}
      </span>
      <button className="btn btn-danger btn-sm" onClick={() => void stop()} disabled={phase.k !== "recording"} aria-label="Stop recording">
        <Square size={14} /> Stop
      </button>
    </div>
  );
}
