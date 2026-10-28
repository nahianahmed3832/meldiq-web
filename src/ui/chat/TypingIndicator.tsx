import { Fragment } from "react";
import { type Translate, useT } from "../../i18n";

/**
 * Who's typing in the open conversation (2026-10-28, after the owner's reference): three bouncing dots, then the
 * people by name, "**Kofushi** and **Rea** are meldling" (Meldiq's word for typing). One entry per person; it goes
 * when their typing signal lapses. Screen readers hear the plain sentence ("… is typing").
 */
export function TypingIndicator({ names }: { names: readonly string[] }) {
  const t = useT();
  return (
    <div className="typing" aria-live="polite">
      {names.length > 0 && (
        <span className="typing-meldling" title={typingNames(t, names)}>
          <span className="typing-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span aria-hidden="true">{meldlingLine(t, names)}</span>
          <span className="sr-only">{typingNames(t, names)}</span>
        </span>
      )}
    </div>
  );
}

/** The visible line: names in bold, "is meldling" / "are meldling". */
function meldlingLine(t: Translate, names: readonly string[]) {
  const b = (n: string) => <strong>{n}</strong>;
  const parts =
    names.length === 1
      ? [b(names[0]), ` ${t("meldling_one")}`]
      : names.length === 2
        ? [b(names[0]), ` ${t("meldling_and")} `, b(names[1]), ` ${t("meldling_many")}`]
        : [b(names[0]), ", ", b(names[1]), ` ${t("meldling_others", { n: names.length - 2 })} ${t("meldling_many")}`];
  return parts.map((p, i) => <Fragment key={i}>{p}</Fragment>);
}

/** "Ana is typing", "Ana and Bo are typing", "Ana, Bo and 3 others are typing"; empty for nobody. */
export function typingNames(t: Translate, names: readonly string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return t("typing_one", { a: names[0] });
  if (names.length === 2) return t("typing_two", { a: names[0], b: names[1] });
  return t("typing_many", { a: names[0], b: names[1], n: names.length - 2 });
}
