import { useEffect, useId, useMemo, useState, type KeyboardEvent } from "react";
import { type EmojiGroup, loadCatalog, searchEmoji, inTone, useEmojiPrefs, emojiUsed, emojiPrefsScope } from "../../emoji/catalog";
import { useEngine } from "../../application/orbit";
import { activeEmojiQuery } from "../../sync/emojiCompletion";
import type { Expression, ExpressionList } from "../../sync/expressions";
import { text as t } from "../../i18n";
import { CustomEmojiImage } from "../community/CustomEmoji";
type Range = NonNullable<ReturnType<typeof activeEmojiQuery>>;
type Choice = { key: string; name: string; text: string; expression?: Expression };
export function useEmojiCompletion({ scope, list, onPick }: { scope: string; list: ExpressionList | null; onPick: (choice: Choice, range: Range) => void }) {
  const engine = useEngine();
  const prefsScope = emojiPrefsScope(engine.store.name, engine.device.userId);
  const id = useId(),
    [query, setQuery] = useState<(Range & { scope: string }) | null>(null),
    [groups, setGroups] = useState<EmojiGroup[] | null>(null),
    [failure, setFailure] = useState(false),
    [index, setIndex] = useState(0),
    [retry, setRetry] = useState(0);
  const { tone } = useEmojiPrefs(prefsScope);
  const current = query?.scope === scope ? query : null;
  useEffect(() => {
    if (!current) return;
    let alive = true;
    setFailure(false);
    void loadCatalog()
      .then((g) => {
        if (alive) setGroups(g);
      })
      .catch(() => {
        if (alive) setFailure(true);
      });
    return () => {
      alive = false;
    };
  }, [current, scope, retry]);
  const choices = useMemo<Choice[]>(() => {
    if (!current) return [];
    const own = (list?.expressions ?? [])
      .filter((e) => e.kind === "emoji" && !e.locked && e.name.replaceAll("_", " ").includes(current.query))
      .slice(0, 4)
      .map((e) => ({ key: e.id, name: `:${e.name}:`, text: `:${e.name}:`, expression: e }));
    const standard = groups
      ? (current.query ? searchEmoji(groups, current.query, 8) : groups.flatMap((g) => g.items).slice(0, 8)).map((e) => ({ key: e.emoji, name: e.name, text: inTone(e, tone) }))
      : [];
    return [...own, ...standard].slice(0, 8);
  }, [current, list, groups, tone]);
  const clear = () => setQuery(null);
  const pick = (choice: Choice) => {
    if (current) {
      if (!choice.expression) emojiUsed(prefsScope, choice.text);
      onPick(choice, current);
      clear();
    }
  };
  const update = (text: string, caret: number) => {
    const q = activeEmojiQuery(text, caret);
    setQuery(q ? { ...q, scope } : null);
    setIndex(0);
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!current || e.nativeEvent.isComposing) return false;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      clear();
      return true;
    }
    if (!choices.length) {
      if (!groups && !failure && (e.key === "Enter" || e.key === "Tab")) {
        e.preventDefault();
        return true;
      }
      return false;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => (i + (e.key === "ArrowDown" ? 1 : -1) + choices.length) % choices.length);
      return true;
    }
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      pick(choices[index] ?? choices[0]);
      return true;
    }
    return false;
  };
  return {
    update,
    onKey,
    clear,
    id,
    open: !!current,
    activeId: current && choices[index] ? `${id}-${index}` : undefined,
    view: current ? (
      <div className="suggest card" id={id} role="listbox" aria-label={t("messaging.interface.emoji_4030f0c")}>
        {!groups && !failure && <span role="status">{t("common.status.loading")}</span>}
        {failure && (
          <span role="alert">
            {t("messaging.interface.emoji_couldn_t_be_loaded_recent_emoji_still_work_c967580")}
            <button type="button" onClick={() => setRetry((n) => n + 1)}>
              {t("common.actions.retry")}
            </button>
          </span>
        )}
        {choices.map((choice, i) => (
          <button type="button" id={`${id}-${i}`} key={choice.key} role="option" aria-selected={i === index} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(choice)}>
            {choice.expression ? (
              <CustomEmojiImage id={choice.expression.id} name={choice.expression.name} sha256={choice.expression.sha256} size={24} />
            ) : (
              <span aria-hidden="true">{choice.text}</span>
            )}
            <span>{choice.name}</span>
          </button>
        ))}
      </div>
    ) : null,
  };
}
