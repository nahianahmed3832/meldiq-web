import { type Translate, useT } from "../../i18n";

/**
 * Who's typing in the open conversation, Meldiq's way: Meldling and "Meldling…" with an animated ellipsis, once however
 * many people type (the store already keeps one entry per person and drops it when their typing signal lapses). The
 * label is only a brand flourish, not a message or a sender: screen readers and the tooltip get the real names.
 */
export function TypingIndicator({ names }: { names: readonly string[] }) {
  const t = useT();
  const who = typingNames(t, names);
  return (
    <div className="typing" aria-live="polite">
      {names.length > 0 && (
        <span className="typing-meldling" title={who}>
          <img src="/meldling-96.webp" width={18} height={18} alt="" draggable={false} />
          <span aria-hidden="true">
            {t("typing_meldling")}
            <span className="typing-ellipsis">
              <i>.</i>
              <i>.</i>
              <i>.</i>
            </span>
          </span>
          <span className="sr-only">{who}</span>
        </span>
      )}
    </div>
  );
}

/** "Ana is typing", "Ana and Bo are typing", "Ana, Bo and 3 others are typing"; empty for nobody. */
export function typingNames(t: Translate, names: readonly string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return t("typing_one", { a: names[0] });
  if (names.length === 2) return t("typing_two", { a: names[0], b: names[1] });
  return t("typing_many", { a: names[0], b: names[1], n: names.length - 2 });
}
