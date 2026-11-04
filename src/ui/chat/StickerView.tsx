import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { useState } from "react";
import { usePrefs } from "../../application/prefs";
import type { StickerRef } from "../../protocol/payload";
import { findSticker, type StickerSpec } from "../../sync/stickers";
import { MeldlingExpression } from "../components/MeldlingExpression";
/**
 * A Meldiq sticker uses the canonical Meldling with a symbol, a caption on a tilted label, and its catalogue motion
 * (docs/STICKERS.md; Android keeps the same sticker reference/fallback). Motion plays when it appears or is
 * clicked (never looping). Still with animations off (Appearance › Animated emoji, or the system's reduced motion). An
 * unknown sticker (a newer catalogue) shows the message's fallback text.
 */
export function StickerView({ sticker, fallback, size = 132, still = false }: { sticker: StickerRef; fallback: string; size?: number; still?: boolean }) {
  useLocaleRender();
  const spec = findSticker(sticker);
  if (!spec) return <div className="msg-text">{fallback}</div>;
  return <StickerArt spec={spec} size={size} still={still} />;
}
export function StickerArt({ spec, size = 132, still = false }: { spec: StickerSpec; size?: number; still?: boolean }) {
  useLocaleRender();
  const { animatedEmoji } = usePrefs();
  const [plays, setPlays] = useState(0);
  const playing = animatedEmoji && !still;
  return (
    <span
      key={plays}
      className={`sticker tone-${spec.tone}${playing ? ` motion-${spec.motion}` : ""}${size < 110 ? " compact" : ""}`}
      style={{ width: size, height: size, fontSize: size }}
      role="img"
      aria-label={uiText("messaging.interface.sticker_value0_5410255", { value0: spec.caption })}
      onClick={playing ? () => setPlays((n) => n + 1) : undefined}
    >
      <span className="sticker-shape" aria-hidden="true" />
      {playing && (spec.motion === "confetti" || spec.motion === "burst") && <span className={`sticker-${spec.motion}`} aria-hidden="true" />}
      <span className="sticker-emoji" aria-hidden="true">
        <MeldlingExpression symbol={spec.emoji} />
      </span>
      <span className="sticker-caption" aria-hidden="true">
        {spec.caption}
      </span>
    </span>
  );
}
