import { usePrefs } from "../../application/prefs";
import { motionOf } from "../../sync/animoji";

/**
 * An animated emoji message (android AnimojiView): still when the person turned animations off (Appearance › Animated
 * emoji) or the system asks for reduced motion (the stylesheet stops every animation then).
 */
export function AnimojiView({ emoji, size = 96 }: { emoji: string; size?: number }) {
  const { animatedEmoji } = usePrefs();
  const motion = motionOf(emoji);
  return (
    <span
      className={`animoji${motion && animatedEmoji ? ` motion-${motion}` : ""}`}
      role="img"
      aria-label={`Animated emoji ${emoji}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.62) }}
    >
      <span aria-hidden="true">{emoji}</span>
    </span>
  );
}
