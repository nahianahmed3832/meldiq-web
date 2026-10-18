import { Fragment, type ReactNode } from "react";

/**
 * Message text as plain React text (never HTML): links become anchors only for http(s) URLs, and @mentions are highlighted
 * only when they name someone the message actually mentions (ids resolved by the sender, android docs/MENTIONS.md).
 */
const TOKEN = /(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]])|((?<![\p{L}\p{N}_.@])@[A-Za-z0-9._]{1,24}(?::[A-Za-z0-9.-]{1,253})?)/gu;

export function RichText({ text, mentionNames, myUsername }: { text: string; mentionNames: Set<string>; myUsername: string }) {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    if (m[1]) {
      out.push(
        <a key={at} href={m[1]} target="_blank" rel="noopener noreferrer nofollow">
          {m[1]}
        </a>,
      );
    } else {
      const name = m[2].slice(1).toLowerCase();
      const isMention = name === "everyone" || mentionNames.has(name);
      out.push(
        isMention ? (
          <span key={at} className={`mention${name === myUsername.toLowerCase() ? " me" : ""}`}>
            {m[2]}
          </span>
        ) : (
          <Fragment key={at}>{m[2]}</Fragment>
        ),
      );
    }
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}

/** A message that is only one to three emoji is shown large. */
export function isEmojiOnly(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 24) return false;
  return /^(?:\p{Extended_Pictographic}(?:\u200d\p{Extended_Pictographic}|\ufe0f|\p{Emoji_Modifier})*\s*){1,3}$/u.test(t);
}
