import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { Mic, Pause, Play, SendHorizontal, Square, Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useVoicePlayback, voicePlayback } from "../../application/voicePlayback";
import { clock, type Recording, RecordingError, VOICE_MAX_MS, VoiceRecorder } from "../../sync/voice";
type Phase =
  | {
      k: "starting";
    }
  | {
      k: "recording";
    }
  | {
      k: "ready";
      rec: Recording;
      url: string;
    }
  | {
      k: "error";
      message: string;
    };
/**
 * Records a voice message in place of the composer (android VoiceViews): recording with a timer, then a preview to play
 * back, delete or send. Nothing is sent until Send. Under a second is discarded; ten minutes stops by itself.
 */
export function VoiceBar({ onSend, onClose }: { onSend: (rec: Recording) => Promise<void>; onClose: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const [phase, setPhase] = useState<Phase>({ k: "starting" });
  const [elapsed, setElapsed] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const recorder = useRef<VoiceRecorder | null>(null);
  // The preview plays through the page's one voice player too: it pauses any message playing, and they pause it.
  const key = `draft${useId()}`;
  const playback = useVoicePlayback();
  const playing = playback.key === key && playback.status === "playing";
  useEffect(() => () => voicePlayback.release(key), [key]);
  const stop = async () => {
    const r = recorder.current;
    if (!r) return;
    const rec = await r.stop();
    if (!rec) {
      setNote(uiText("calls.interface.too_short_to_send_hold_on_a_little_longer_6fe7bcc"));
      setPhase({
        k: "error",
        get message() {
          return uiText("calls.interface.too_short_to_send_96959b8");
        },
      });
      return;
    }
    setPhase({ k: "ready", rec, url: URL.createObjectURL(rec.blob) });
  };
  useEffect(() => {
    const r = new VoiceRecorder(() => void stop());
    recorder.current = r;
    r.start()
      .then(() => setPhase({ k: "recording" }))
      .catch((e: unknown) => setPhase({ k: "error", message: e instanceof RecordingError ? e.message : uiText("calls.interface.recording_couldn_t_start_dcb1aae") }));
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
      <div className="voice-bar" role="group" aria-label={uiText("messaging.interface.voice_message_f6933da")}>
        <span className="grow" role="alert">
          {note ?? phase.message}
        </span>
        <button className="btn btn-secondary btn-sm" onClick={onClose}>
          {l10n("common.actions.close")}
        </button>
      </div>
    );
  }
  if (phase.k === "ready") {
    return (
      <div className="voice-bar" role="group" aria-label={uiText("calls.interface.voice_message_ready_to_send_cc0a6e7")}>
        <button className="icon-btn" onClick={onClose} aria-label={uiText("calls.interface.delete_voice_message_87e4fbf")} disabled={sending}>
          <Trash2 size={18} />
        </button>
        <button
          className="icon-btn"
          aria-label={
            playing ? uiText("messaging.interface.pause_858e4ba") : uiText("messaging.interface.play_voice_message_value0_seconds_d8be711", { value0: Math.round(phase.rec.durationMs / 1000) })
          }
          onClick={() => voicePlayback.toggle(key, phase.url)}
        >
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <span className="grow voice-len">{clock(phase.rec.durationMs)}</span>
        <button
          className="send-btn"
          aria-label={uiText("calls.interface.send_voice_message_76038b1")}
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
    <div className="voice-bar" role="group" aria-label={uiText("calls.interface.recording_a_voice_message_4586b9f")}>
      <button className="icon-btn" onClick={onClose} aria-label={uiText("calls.interface.cancel_recording_158aa43")}>
        <Trash2 size={18} />
      </button>
      <span className="rec-dot" aria-hidden="true" />
      <span className="grow voice-len" aria-live="off">
        {phase.k === "starting" ? (
          <>
            <Localized k="calls.interface.starting_ac797bf" slots={[<Mic size={14} />]} />
          </>
        ) : (
          uiText("messaging.interface.value0_value1_2a194ab", { value0: clock(elapsed), value1: clock(VOICE_MAX_MS) })
        )}
      </span>
      <button className="btn btn-danger btn-sm" onClick={() => void stop()} disabled={phase.k !== "recording"} aria-label={uiText("calls.interface.stop_recording_3d591e8")}>
        <Localized k="messaging.interface.stop_bf10943" slots={[<Square size={14} />]} />
      </button>
    </div>
  );
}
