import { Maximize2, ScanLine, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/** A bounded scrolling canvas: tall originals keep their entire image and can be read at full width. */
export function ZoomableImage({ url, name, retry }: { url: string; name: string; retry: () => void }) {
  const viewport = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 1, height: 1 });
  const [natural, setNatural] = useState({ width: 0, height: 0 });
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<{ mode: "fit" | "width" | "custom"; scale: number }>({ mode: "fit", scale: 1 });
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const anchor = useRef<{ x: number; y: number } | null>(null);
  const [panning, setPanning] = useState(false);
  const fit = natural.width && natural.height ? Math.min(1, box.width / natural.width, box.height / natural.height) : 1;
  const scale = view.mode === "fit" ? fit : view.mode === "width" ? Math.min(1, box.width / Math.max(1, natural.width)) : view.scale;
  const zoom = useCallback(
    (next: number) => {
      const el = viewport.current;
      if (!el || !natural.width) return;
      const left = Math.max(0, (box.width - natural.width * scale) / 2);
      const top = Math.max(0, (box.height - natural.height * scale) / 2);
      anchor.current = { x: (el.scrollLeft + box.width / 2 - left) / scale, y: (el.scrollTop + box.height / 2 - top) / scale };
      setView({ mode: "custom", scale: Math.max(Math.min(fit, 0.05), Math.min(4, next)) });
    },
    [box, fit, natural, scale],
  );
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const measure = () => setBox({ width: Math.max(1, el.clientWidth), height: Math.max(1, el.clientHeight) });
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    measure();
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    const el = viewport.current;
    if (!el) return;
    if (view.mode !== "custom") {
      el.scrollTo(0, 0);
      return;
    }
    const at = anchor.current;
    if (at) {
      el.scrollLeft = at.x * scale + Math.max(0, (box.width - natural.width * scale) / 2) - box.width / 2;
      el.scrollTop = at.y * scale + Math.max(0, (box.height - natural.height * scale) / 2) - box.height / 2;
      anchor.current = null;
    }
  }, [scale, view.mode, box, natural]);
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        zoom(scale * (e.deltaY < 0 ? 1.2 : 1 / 1.2));
      }
    };
    el.addEventListener("wheel", wheel, { passive: false });
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input,textarea,select,[role=menu]")) return;
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        zoom(scale * 1.5);
      }
      if (e.key === "-") {
        e.preventDefault();
        zoom(scale / 1.5);
      }
      if (e.key === "0") {
        e.preventDefault();
        setView({ mode: "fit", scale: 1 });
      }
      if (e.key === "1") {
        e.preventDefault();
        zoom(1);
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      el.removeEventListener("wheel", wheel);
      document.removeEventListener("keydown", key);
    };
  }, [scale, zoom]);
  if (failed)
    return (
      <div className="viewer-error" role="alert">
        <p>This image couldn't be displayed.</p>
        <button className="btn btn-secondary" onClick={retry}>
          Try again
        </button>
        <p>You can also download the original from the toolbar.</p>
      </div>
    );
  return (
    <div className="viewer-image-area">
      <div
        ref={viewport}
        className={`viewer-image-viewport${panning ? " panning" : ""}`}
        tabIndex={0}
        aria-label={`Image canvas: ${name}`}
        onPointerDown={(e) => {
          if (e.pointerType === "touch" || e.button !== 0) return;
          e.preventDefault();
          const el = e.currentTarget;
          drag.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop };
          el.setPointerCapture(e.pointerId);
          setPanning(true);
        }}
        onPointerMove={(e) => {
          if (drag.current) {
            e.currentTarget.scrollLeft = drag.current.left - e.clientX + drag.current.x;
            e.currentTarget.scrollTop = drag.current.top - e.clientY + drag.current.y;
          }
        }}
        onPointerUp={() => {
          drag.current = null;
          setPanning(false);
        }}
        onPointerCancel={() => {
          drag.current = null;
          setPanning(false);
        }}
        onDoubleClick={() => (view.mode === "fit" ? zoom(1) : setView({ mode: "fit", scale: 1 }))}
      >
        <div className="viewer-image-content" style={{ width: Math.max(box.width, natural.width * scale), height: Math.max(box.height, natural.height * scale) }}>
          <img
            className="viewer-original"
            src={url}
            alt={name}
            draggable={false}
            onLoad={(e) => setNatural({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })}
            onError={() => setFailed(true)}
            style={natural.width ? { width: natural.width * scale, height: natural.height * scale } : { visibility: "hidden", position: "absolute" }}
          />
        </div>
      </div>
      {!natural.width && <span className="viewer-image-loading spinner" aria-label="Decoding image" />}
      <div className="viewer-zoom" role="toolbar" aria-label="Image zoom">
        <button className="icon-btn" disabled={!natural.width || scale <= Math.min(fit, 0.05)} onClick={() => zoom(scale / 1.5)} aria-label="Zoom out" title="Zoom out (−)">
          <ZoomOut size={17} />
        </button>
        <output aria-live="polite" aria-label="Zoom level">
          {Math.max(1, Math.round(scale * 100))}%
        </output>
        <button className="icon-btn" disabled={!natural.width || scale >= 4} onClick={() => zoom(scale * 1.5)} aria-label="Zoom in" title="Zoom in (+)">
          <ZoomIn size={17} />
        </button>
        <span className="viewer-zoom-divider" />
        <button className="icon-btn" onClick={() => setView({ mode: "fit", scale: 1 })} aria-label="Fit image" title="Fit image (0)">
          <Maximize2 size={16} />
        </button>
        <button className="icon-btn" onClick={() => setView({ mode: "width", scale: 1 })} aria-label="Fit image width" title="Fit width · scroll to read long images">
          <ScanLine size={17} />
        </button>
        <button className="viewer-actual" onClick={() => zoom(1)} aria-label="Actual image size" title="Actual size (1)">
          1:1
        </button>
      </div>
    </div>
  );
}
