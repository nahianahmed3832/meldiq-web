import { Scissors } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { ClipBuffer, clipSourceKey } from "../../call/clipBuffer";
import type { CallUiState } from "../../call/types";
import { useT } from "../../i18n";
import { sendFiles } from "../../sync/attachments";
import { Dialog } from "../components/Overlay";
import { Toggle } from "../components/Toggle";

export function VoiceClipButton({ call }: { call: CallUiState }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const allowed = useOrbit((state) => {
    const orgId = call.conversationId ? state.conversations[call.conversationId]?.orgId : null;
    return !!orgId && !!state.server?.features.includes("community-voice-clips") && state.orgs.some((org) => org.id === orgId && org.voiceClips);
  });
  useEffect(() => {
    if (!allowed || call.phase !== "connected") setOpen(false);
  }, [allowed, call.phase]);
  if (!allowed || !call.voiceRoom || call.phase !== "connected" || !call.conversationId || typeof MediaRecorder === "undefined") return null;
  return (
    <>
      <button className="call-btn" aria-label={t("workspace.reference.clips")} title={t("workspace.reference.clips")} onClick={() => setOpen(true)}>
        <Scissors size={22} aria-hidden />
      </button>
      {open && <VoiceClipDialog key={call.mediaEpoch} conversationId={call.conversationId} close={() => setOpen(false)} />}
    </>
  );
}

function VoiceClipDialog({ conversationId, close }: { conversationId: string; close: () => void }) {
  const t = useT();
  const engine = useEngine();
  const [consent, setConsent] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [hasSources, setHasSources] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clip, setClip] = useState<{ blob: Blob; key: string; url: string } | null>(null);
  const active = useRef<{ buffer: ClipBuffer; key: string } | null>(null);
  const sending = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      active.current?.buffer.stop();
      sending.current?.abort();
      void engine.calls.setClipConsent(false).catch(() => undefined);
    },
    [engine],
  );
  useEffect(
    () => () => {
      if (clip) URL.revokeObjectURL(clip.url);
    },
    [clip],
  );

  useEffect(() => {
    if (!buffering && !clip) return;
    const update = () => {
      const sources = engine.calls.clipSources();
      const key = clipSourceKey(sources);
      setHasSources(sources.tracks.length > 0);
      if (clip && clip.key !== key) {
        sending.current?.abort();
        setClip(null);
      }
      if (active.current?.key === key && buffering) return;
      active.current?.buffer.stop();
      active.current = null;
      if (!buffering || !sources.tracks.length) return;
      try {
        const buffer = new ClipBuffer(sources.tracks);
        active.current = { buffer, key };
        buffer.start();
      } catch {
        active.current?.buffer.stop();
        active.current = null;
        setError(t("workspace.reference.clipCaptureFailed"));
        setBuffering(false);
      }
    };
    update();
    const timer = setInterval(update, 250);
    return () => clearInterval(timer);
  }, [buffering, clip, engine, t]);

  const switchConsent = async (allowed: boolean) => {
    setWorking(true);
    setError(null);
    try {
      await engine.calls.setClipConsent(allowed);
      setConsent(allowed);
    } catch {
      setConsent(false);
      setError(t("workspace.reference.clipConsentFailed"));
    } finally {
      setWorking(false);
    }
  };
  const capture = async () => {
    const current = active.current;
    if (!current) return;
    setWorking(true);
    setError(null);
    try {
      const blob = await current.buffer.capture();
      if (!blob || current.key !== clipSourceKey(engine.calls.clipSources())) {
        setError(t("workspace.reference.clipCaptureFailed"));
        return;
      }
      setClip({ blob, url: URL.createObjectURL(blob), key: current.key });
    } catch {
      setError(t("workspace.reference.clipCaptureFailed"));
    } finally {
      setWorking(false);
    }
  };
  const post = async () => {
    if (!clip || clip.key !== clipSourceKey(engine.calls.clipSources()) || sending.current) return;
    const signal = new AbortController();
    sending.current = signal;
    setWorking(true);
    setError(null);
    try {
      const type = clip.blob.type.split(";")[0] || "application/octet-stream";
      const ext = type.endsWith("mp4") ? "mp4" : type.endsWith("ogg") ? "ogg" : "webm";
      await sendFiles(
        engine,
        conversationId,
        [
          {
            name: `meldiq-clip.${ext}`,
            type,
            size: clip.blob.size,
            source: clip.blob,
            bytes: async () => new Uint8Array(await clip.blob.arrayBuffer()),
          },
        ],
        "",
        {},
        undefined,
        { signal: signal.signal },
      );
      close();
    } catch {
      if (!signal.signal.aborted) setError(t("workspace.reference.clipPostFailed"));
    } finally {
      sending.current = null;
      setWorking(false);
    }
  };
  return (
    <Dialog title={t("workspace.reference.clips")} onClose={close}>
      <div className="dialog-body voice-clip-body">
        <p className="muted">{t("workspace.reference.clipPrivacy")}</p>
        <div className="row voice-clip-consent">
          <span className="grow">{t("workspace.reference.clipConsent")}</span>
          <Toggle label={t("workspace.reference.clipConsent")} checked={consent} disabled={working} onChange={(value) => void switchConsent(value)} />
        </div>
        <div className="row voice-clip-buttons">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={working}
            onClick={() => {
              setError(null);
              if (buffering) {
                active.current?.buffer.stop();
                active.current = null;
              }
              setBuffering(!buffering);
            }}
          >
            {t(buffering ? "workspace.reference.clipStop" : "workspace.reference.clipStart")}
          </button>
          {buffering && (
            <button type="button" className="btn btn-primary" disabled={working || !hasSources} onClick={() => void capture()}>
              {t("workspace.reference.clipCapture")}
            </button>
          )}
        </div>
        {buffering && (
          <p role="status" className="muted">
            {t(hasSources ? "workspace.reference.clipBuffering" : "workspace.reference.clipWaiting")}
          </p>
        )}
        {clip && (
          <div className="voice-clip-preview">
            {clip.blob.type.startsWith("video/") ? (
              <video controls src={clip.url} aria-label={t("workspace.reference.clipPreview")} />
            ) : (
              <audio controls src={clip.url} aria-label={t("workspace.reference.clipPreview")} />
            )}
            <button type="button" className="btn btn-primary" disabled={working} onClick={() => void post()}>
              {t("workspace.reference.clipPost")}
            </button>
          </div>
        )}
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
      </div>
    </Dialog>
  );
}
