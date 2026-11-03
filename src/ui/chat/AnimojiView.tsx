import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { usePrefs } from "../../application/prefs";
import { motionOf } from "../../sync/animoji";
/**
 * An animated emoji message (android AnimojiView): still when the person turned animations off (Appearance › Animated
 * emoji) or the system asks for reduced motion (the stylesheet stops every animation then).
 */
export function AnimojiView({ emoji, size = 96 }: { emoji: string; size?: number }) {
  useLocaleRender();
  const { animatedEmoji } = usePrefs();
  const motion = motionOf(emoji);
  return (
    <span
      className={`animoji${motion && animatedEmoji ? ` motion-${motion}` : ""}`}
      role="img"
      aria-label={uiText("messaging.interface.animated_emoji_value0_bfd0a64", { value0: emoji })}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.62) }}
    >
      <span aria-hidden="true">{emoji}</span>
    </span>
  );
}
