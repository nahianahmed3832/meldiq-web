import { Download, FileText, Mic, TriangleAlert, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useEngine } from "../../app/orbit";
import type { AttachmentRef } from "../../protocol/payload";
import { isInlineImage, openAttachment } from "../../sync/attachments";
import { bytes } from "../format";

/** Decrypts on demand; images show inline, everything else is a file card that downloads the decrypted file. */
export function Attachments({ refs }: { refs: AttachmentRef[] }) {
  if (!refs.length) return null;
  return <div className="attachments">{refs.map((r) => (isInlineImage(r) ? <ImageAttachment key={r.id} r={r} /> : <FileAttachment key={r.id} r={r} />))}</div>;
}

function useBlobUrl(r: AttachmentRef, enabled: boolean): { url: string | null; error: string | null; loading: boolean } {
  const engine = useEngine();
  const [state, setState] = useState<{ url: string | null; error: string | null; loading: boolean }>({ url: null, error: null, loading: enabled });
  useEffect(() => {
    if (!enabled) return;
    let url: string | null = null;
    let alive = true;
    setState({ url: null, error: null, loading: true });
    openAttachment(engine, r)
      .then((blob) => {
        if (!alive) return;
        url = URL.createObjectURL(blob);
        setState({ url, error: null, loading: false });
      })
      .catch((e: unknown) => alive && setState({ url: null, error: e instanceof Error ? e.message : "Couldn't open this file.", loading: false }));
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [engine, r, enabled]);
  return state;
}

function ImageAttachment({ r }: { r: AttachmentRef }) {
  const { url, error, loading } = useBlobUrl(r, true);
  const [open, setOpen] = useState(false);
  if (error) return <FileAttachment r={r} error={error} />;
  if (loading || !url) return <div className="att-image att-pending skeleton" aria-label={`Loading ${r.name}`} />;
  return (
    <>
      <button className="att-image" onClick={() => setOpen(true)} aria-label={`Open image ${r.name}`}>
        <img src={url} alt={r.name} loading="lazy" />
      </button>
      {open && <Lightbox url={url} name={r.name} onClose={() => setOpen(false)} />}
    </>
  );
}

function Lightbox({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [onClose]);
  return createPortal(
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={name} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bar">
        <a className="icon-btn" href={url} download={name} aria-label="Download">
          <Download size={18} />
        </a>
        <button className="icon-btn" onClick={onClose} aria-label="Close" autoFocus>
          <X size={18} />
        </button>
      </div>
      <img src={url} alt={name} />
    </div>,
    document.body,
  );
}

function FileAttachment({ r, error: initialError }: { r: AttachmentRef; error?: string }) {
  const engine = useEngine();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      const blob = await openAttachment(engine, r);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = r.name;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't download this file.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <button className="att-file" onClick={() => void download()} disabled={busy} aria-label={`Download ${r.name}, ${bytes(r.size)}`}>
      <span className="file-icon">{error ? <TriangleAlert size={18} /> : r.voice ? <Mic size={18} /> : <FileText size={18} />}</span>
      <span className="grow" style={{ minWidth: 0 }}>
        <span className="ellipsis" style={{ display: "block", fontWeight: 600 }}>
          {r.voice ? "Voice message" : r.name}
        </span>
        <small className={error ? "" : undefined} style={error ? { color: "var(--danger)" } : undefined}>
          {error ?? (busy ? "Decrypting…" : `${bytes(r.size)} · end-to-end encrypted`)}
        </small>
      </span>
      {!error && <Download size={16} className="faint" />}
    </button>
  );
}
