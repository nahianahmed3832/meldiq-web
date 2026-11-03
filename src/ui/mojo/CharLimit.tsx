import { useLocaleRender } from "../../i18n/Localized";
import { Localized } from "../../i18n/Localized";
import { interfaceLocale } from "../../i18n/format";
import { navigate } from "../../application/router";
import { countChars } from "./mojoFormat";
/** Shown from 90% of the limit: counts up, and past the limit says why the message can't go and what raises it. */
const SHOW_FROM = 0.9;
/** Whether [text] is longer than [limit] characters as people count them (null: no limit enforced here). */
export function overCharLimit(text: string, limit: number | null): boolean {
  return limit !== null && text.length > limit && countChars(text) > limit;
}
/**
 * The message length note under the composer and the edit box (server docs/MOJO.md): plans allow 2,000, 4,000 or 8,000
 * characters, counted as grapheme clusters (an emoji with its skin tone is one), the same way for new messages and edits.
 */
export function CharLimitNote({ text, limit }: { text: string; limit: number | null }) {
  useLocaleRender();
  if (limit === null || text.length < limit * SHOW_FROM) return null;
  const n = countChars(text);
  if (n < limit * SHOW_FROM) return null;
  const over = n > limit;
  return (
    <div className={`char-limit${over ? " over" : ""}`} role={over ? "alert" : "status"} aria-live="polite">
      <span>
        {n.toLocaleString(interfaceLocale())} / {limit.toLocaleString(interfaceLocale())}
      </span>
      {over && (
        <span>
          <Localized k="billing.interface.that_s_over_your_plan_s_limit_2f1e438" slots={[(n - limit).toLocaleString(interfaceLocale())]} />
          <button className="char-limit-link" onClick={() => navigate({ section: "settings", settingsPage: "mojo" })}>
            <Localized k="billing.interface.meldiq_plus_gives_more_room_0ce892c" />
          </button>
        </span>
      )}
    </div>
  );
}
