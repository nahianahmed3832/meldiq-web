/**
 * Animated emoji (android RichViews Animoji): the emoji itself, drawn by the app with a short motion: no downloaded or
 * executable content. The same set and motions as the phone; any other emoji sent this way is shown large and still.
 */
export type Motion = "beat" | "bounce" | "wave" | "spin" | "wobble";

export const ANIMOJI: readonly (readonly [string, Motion])[] = [
  ["❤️", "beat"],
  ["😂", "wobble"],
  ["👍", "bounce"],
  ["🎉", "wobble"],
  ["🔥", "beat"],
  ["👋", "wave"],
  ["😮", "bounce"],
  ["😢", "wobble"],
  ["🙏", "beat"],
  ["🥳", "bounce"],
  ["😍", "beat"],
  ["🤣", "wobble"],
  ["👏", "wave"],
  ["🚀", "bounce"],
  ["⭐", "spin"],
  ["🌸", "spin"],
  ["☕", "wobble"],
  ["🎂", "bounce"],
  ["💯", "beat"],
  ["😎", "bounce"],
];

export function motionOf(emoji: string): Motion | null {
  return ANIMOJI.find(([e]) => e === emoji)?.[1] ?? null;
}
