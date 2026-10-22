import { Fragment, type ReactNode } from "react";
import { SafeLink } from "./SafeLink";
import type { CustomEmojiRef } from "../../protocol/payload";
import { emojiTokens } from "../../sync/expressions";
import { InlineEmoji } from "../community/CustomEmoji";

/**
 * Message text as plain React text (never HTML): links become anchors only for http(s) URLs (misleading ones ask first), and @mentions are highlighted
 * only when they name someone the message actually mentions (ids resolved by the sender, android docs/MENTIONS.md).
 */
const TOKEN = /(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]])|((?<![\p{L}\p{N}_.@])@[A-Za-z0-9._]{1,24}(?::[A-Za-z0-9.-]{1,253})?)/gu;

export function RichText({ text, mentionNames, myUsername, customEmoji }: { text: string; mentionNames: Set<string>; myUsername: string; customEmoji?: CustomEmojiRef[] }) {
  // Batch B9: a community's emoji named in the message are drawn inline; the rest of the text as before.
  const tokens = customEmoji?.length ? emojiTokens(text, customEmoji) : [];
  if (tokens.length) {
    const parts: ReactNode[] = [];
    let at = 0;
    for (const t of tokens) {
      if (t.start > at) parts.push(<RichText key={`t${at}`} text={text.slice(at, t.start)} mentionNames={mentionNames} myUsername={myUsername} />);
      parts.push(<InlineEmoji key={`e${t.start}`} r={t.ref} size={isEmojiOnly(text.replace(/:[a-z0-9_]{2,32}:/g, "😀")) ? 40 : 22} />);
      at = t.end;
    }
    if (at < text.length) parts.push(<RichText key={`t${at}`} text={text.slice(at)} mentionNames={mentionNames} myUsername={myUsername} />);
    return <>{parts}</>;
  }
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    if (m[1]) {
      out.push(
        <SafeLink key={at} href={m[1]}>
          {m[1]}
        </SafeLink>,
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
