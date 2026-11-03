import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { MotionImage } from "../components/MotionImage";
import { useEffect, useState } from "react";
import { useEngine } from "../../application/orbit";
import type { GifRef } from "../../protocol/payload";
import { gifObjectUrl } from "../../sync/gifs";
/**
 * A GIF in a message (API 0.45.0): loaded through the server (sync/gifs.ts), at its own proportions within a bounded
 * box. While it loads, a placeholder of the same shape; if the server can't fetch it, the link instead.
 */
export function GifView({ gif }: { gif: GifRef }) {
  useLocaleRender();
  const engine = useEngine();
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    void gifObjectUrl(engine, gif.url).then((u) => {
      if (!live) return;
      if (u) setUrl(u);
      else setFailed(true);
    });
    return () => {
      live = false;
    };
  }, [engine, gif.url]);
  const w = Math.min(320, gif.width);
  const h = Math.round((w / gif.width) * gif.height);
  if (failed)
    return (
      <a className="gif-fallback" href={gif.url} target="_blank" rel="noopener noreferrer">
        {gif.title || uiText("messaging.interface.gif_76c664e")}
      </a>
    );
  return (
    <span className="gif-view" style={{ width: w, aspectRatio: `${gif.width} / ${gif.height}`, maxHeight: Math.max(h, 1) }}>
      {url ? <MotionImage src={url} alt={gif.title || uiText("messaging.interface.gif_76c664e")} /> : <span className="skeleton" aria-busy="true" />}
      <span className="gif-badge" aria-hidden="true">
        <Localized k="messaging.interface.gif_76c664e" />
      </span>
    </span>
  );
}
