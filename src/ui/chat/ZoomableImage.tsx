import { formatUiNumber } from "../../i18n/format";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { Maximize2, ScanLine, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
/** A bounded scrolling canvas: tall originals keep their entire image and can be read at full width. */
export function ZoomableImage({ url, name, retry }: { url: string; name: string; retry: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const viewport = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 1, height: 1 });
  const [natural, setNatural] = useState({ width: 0, height: 0 });
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<{
    mode: "fit" | "width" | "custom";
    scale: number;
  }>({ mode: "fit", scale: 1 });
  const drag = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);
  const anchor = useRef<{
    x: number;
    y: number;
  } | null>(null);
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
        <p>
          <Localized k="messaging.interface.this_image_couldn_t_be_displayed_8152e16" />
        </p>
        <button className="btn btn-secondary" onClick={retry}>
          {l10n("common.actions.retry")}
        </button>
        <p>
          <Localized k="messaging.interface.you_can_also_download_the_original_from_the_toolbar_45bdaf6" />
        </p>
      </div>
    );
  return (
    <div className="viewer-image-area">
      <div
        ref={viewport}
        className={`viewer-image-viewport${panning ? " panning" : ""}`}
        tabIndex={0}
        aria-label={uiText("messaging.interface.image_canvas_value0_3aca137", { value0: name })}
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
      {!natural.width && <span className="viewer-image-loading spinner" aria-label={uiText("messaging.interface.decoding_image_5b54bc9")} />}
      <div className="viewer-zoom" role="toolbar" aria-label={uiText("messaging.interface.image_zoom_a04420f")}>
        <button
          className="icon-btn"
          disabled={!natural.width || scale <= Math.min(fit, 0.05)}
          onClick={() => zoom(scale / 1.5)}
          aria-label={uiText("messaging.interface.zoom_out_bc7b631")}
          title={uiText("messaging.interface.zoom_out_0b9aa91")}
        >
          <ZoomOut size={17} />
        </button>
        <output aria-live="polite" aria-label={uiText("messaging.interface.zoom_level_3926ced")}>
          {formatUiNumber(Math.max(1, Math.round(scale * 100)))}%
        </output>
        <button
          className="icon-btn"
          disabled={!natural.width || scale >= 4}
          onClick={() => zoom(scale * 1.5)}
          aria-label={uiText("messaging.interface.zoom_in_0e47f09")}
          title={uiText("messaging.interface.zoom_in_4949ad2")}
        >
          <ZoomIn size={17} />
        </button>
        <span className="viewer-zoom-divider" />
        <button
          className="icon-btn"
          onClick={() => setView({ mode: "fit", scale: 1 })}
          aria-label={uiText("messaging.interface.fit_image_2947361")}
          title={uiText("messaging.interface.fit_image_0_2ac6147")}
        >
          <Maximize2 size={16} />
        </button>
        <button
          className="icon-btn"
          onClick={() => setView({ mode: "width", scale: 1 })}
          aria-label={uiText("messaging.interface.fit_image_width_03861c3")}
          title={uiText("messaging.interface.fit_width_scroll_to_read_long_images_1b07d5d")}
        >
          <ScanLine size={17} />
        </button>
        <button className="viewer-actual" onClick={() => zoom(1)} aria-label={uiText("messaging.interface.actual_image_size_9924003")} title={uiText("messaging.interface.actual_size_1_3a1a39a")}>
          1:1
        </button>
      </div>
    </div>
  );
}
