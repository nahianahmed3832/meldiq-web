import { MESSAGE_LAYOUT_EVENT } from "./useReadingPosition";
import { useId, useState, useRef, useLayoutEffect } from "react";
import type { CustomEmojiRef } from "../../protocol/payload";
import { text as t } from "../../i18n";
import { Markdown } from "./Markdown";
/** A bounded initial rendering; copying and stored history always use the complete original text. */
export function MessageBody({ text, mentionNames, myUsername, customEmoji }: { text: string; mentionNames: Set<string>; myUsername: string; customEmoji?: CustomEmojiRef[] }) {
  const id = useId(),
    [expanded, setExpanded] = useState(false);
  const content = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    content.current?.dispatchEvent(new CustomEvent(MESSAGE_LAYOUT_EVENT, { bubbles: true, detail: { phase: "after" } }));
  }, [expanded]);
  const points = Array.from(text),
    lines = text.split("\n");
  const long = points.length > 2400 || lines.length > 16;
  const preview = Array.from(lines.slice(0, 16).join("\n")).slice(0, 2400).join("");
  return (
    <>
      <div id={id} ref={content}>
        <Markdown text={long && !expanded ? preview + "…" : text} mentionNames={mentionNames} myUsername={myUsername} customEmoji={customEmoji} />
      </div>
      {long && (
        <button
          className="btn btn-ghost btn-sm"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={(e) => {
            e.currentTarget.dispatchEvent(new CustomEvent(MESSAGE_LAYOUT_EVENT, { bubbles: true, detail: { phase: "before" } }));
            setExpanded((v) => !v);
          }}
        >
          {t(expanded ? "messaging.interface.show_less_94ea9b1" : "workspace.discover_more")}
        </button>
      )}
    </>
  );
}
