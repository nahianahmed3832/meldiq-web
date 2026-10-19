import { useState } from "react";
import { usePrefs } from "../../app/prefs";
import type { StickerRef } from "../../protocol/payload";
import { findSticker, type StickerSpec } from "../../sync/stickers";

/**
 * A Meldiq sticker drawn from its spec (docs/STICKERS.md; android Stickers.kt StickerView): the emoji in this device's
 * own font over a soft shape in its tone, the caption on a tilted label, and its motion played when it appears or is
 * clicked (never looping). Still with animations off (Appearance › Animated emoji, or the system's reduced motion). An
 * unknown sticker (a newer catalogue) shows the message's fallback text.
 */
export function StickerView({ sticker, fallback, size = 132, still = false }: { sticker: StickerRef; fallback: string; size?: number; still?: boolean }) {
  const spec = findSticker(sticker);
  if (!spec) return <div className="msg-text">{fallback}</div>;
  return <StickerArt spec={spec} size={size} still={still} />;
}

export function StickerArt({ spec, size = 132, still = false }: { spec: StickerSpec; size?: number; still?: boolean }) {
  const { animatedEmoji } = usePrefs();
  const [plays, setPlays] = useState(0);
  const playing = animatedEmoji && !still;
  return (
    <span
      key={plays}
      className={`sticker tone-${spec.tone}${playing ? ` motion-${spec.motion}` : ""}${size < 110 ? " compact" : ""}`}
      style={{ width: size, height: size, fontSize: size }}
      role="img"
      aria-label={`Sticker: ${spec.caption}`}
      onClick={playing ? () => setPlays((n) => n + 1) : undefined}
    >
      <span className="sticker-shape" aria-hidden="true" />
      {playing && (spec.motion === "confetti" || spec.motion === "burst") && <span className={`sticker-${spec.motion}`} aria-hidden="true" />}
      <span className="sticker-emoji" aria-hidden="true">
        {spec.emoji}
      </span>
      <span className="sticker-caption" aria-hidden="true">
        {spec.caption}
      </span>
    </span>
  );
}
