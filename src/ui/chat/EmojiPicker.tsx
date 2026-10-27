import { Clock, Coffee, Flag, Lightbulb, type LucideIcon, PawPrint, PersonStanding, Plane, Shapes, Smile, Trophy, UsersRound } from "lucide-react";
import type { Expression, ExpressionList } from "../../sync/expressions";
import { CustomEmojiImage } from "../community/CustomEmoji";
import { useEffect, useMemo, useRef, useState } from "react";
import { type EmojiGroup, type EmojiItem, emojiUsed, inTone, loadCatalog, searchEmoji, setEmojiTone, useEmojiPrefs } from "../../emoji/catalog";

const RECENT = "recent";
const COMMUNITY = "community";
const TABS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: COMMUNITY, label: "Community", icon: UsersRound },
  { id: RECENT, label: "Recently used", icon: Clock },
  { id: "smileys", label: "Smileys & emotion", icon: Smile },
  { id: "people", label: "People & body", icon: PersonStanding },
  { id: "nature", label: "Animals & nature", icon: PawPrint },
  { id: "food", label: "Food & drink", icon: Coffee },
  { id: "travel", label: "Travel & places", icon: Plane },
  { id: "activities", label: "Activities", icon: Trophy },
  { id: "objects", label: "Objects", icon: Lightbulb },
  { id: "symbols", label: "Symbols", icon: Shapes },
  { id: "flags", label: "Flags", icon: Flag },
];
const TONE_LABELS = ["Default skin tone", "Light skin tone", "Medium-light skin tone", "Medium skin tone", "Medium-dark skin tone", "Dark skin tone"];
const TONE_SAMPLE: EmojiItem = { emoji: "✋", name: "raised hand", keywords: "", version: "0.6", tones: ["✋🏻", "✋🏼", "✋🏽", "✋🏾", "✋🏿"] };
/** Longer than any emoji name; a paste can't make the search slow. */
const MAX_QUERY = 60;

/**
 * The full emoji picker (meldiq docs/EMOJI.md, same as Android's EmojiPanel): search by name or keyword, category tabs
 * that jump to their section, recent emoji first, and one skin tone for every emoji that has them. [onPick] gets the
 * emoji in the chosen tone; it's then remembered as recent. Lives inside a Menu: the emoji are its menu items.
 */
/**
 * Batch B9: a community's own emoji (and, outside reactions, its stickers) in a Community section. In a reaction
 * picker an emoji picks its `:name:` (B12); in the composer [onEmoji] and [onSticker] take them.
 */
export interface CommunityPick {
  list: ExpressionList;
  reactions?: boolean;
  onEmoji?: (e: Expression) => void;
  onSticker?: (e: Expression) => void;
}

export function EmojiPicker({ onPick, community }: { onPick: (emoji: string) => void; community?: CommunityPick }) {
  const [groups, setGroups] = useState<EmojiGroup[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [choosingTone, setChoosingTone] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const { recent, tone } = useEmojiPrefs();
  const search = useRef<HTMLInputElement>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    loadCatalog().then(
      (g) => live && setGroups(g),
      () => live && setFailed(true),
    );
    // The menu focuses its first item after mounting; the search box should have the focus instead.
    const t = window.setTimeout(() => search.current?.focus(), 0);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, []);

  const results = useMemo(() => (groups && query.trim() ? searchEmoji(groups, query) : []), [groups, query]);
  const pick = (emoji: string) => {
    emojiUsed(emoji);
    onPick(emoji);
  };
  const jump = (id: string) => {
    const box = scroller.current;
    const section = box?.querySelector<HTMLElement>(`[data-section="${id}"]`);
    // .emoji-scroll is positioned, so a section's offsetTop is measured from the top of its content.
    if (box && section) box.scrollTop = section.offsetTop;
  };
  const onScroll = () => {
    const box = scroller.current;
    if (!box) return;
    const sections = [...box.querySelectorAll<HTMLElement>("[data-section]")];
    const top = box.scrollTop + 4;
    setCurrent(sections.filter((s) => s.offsetTop <= top).pop()?.dataset.section ?? null);
  };
  const customEmoji = community?.list.expressions.filter((e) => e.kind === "emoji") ?? [];
  const customStickers = community && !community.reactions && community.onSticker ? community.list.expressions.filter((e) => e.kind === "sticker") : [];
  const available = new Set([...(customEmoji.length || customStickers.length ? [COMMUNITY] : []), ...(recent.length ? [RECENT] : []), ...(groups ?? []).map((g) => g.id)]);

  return (
    <div className="emoji-picker">
      <div className="emoji-picker-top">
        <input ref={search} className="input" type="search" placeholder="Search emoji" aria-label="Search emoji" value={query} onChange={(e) => setQuery(e.target.value.slice(0, MAX_QUERY))} />
        <button type="button" className="emoji-cell" aria-label="Skin tone" aria-expanded={choosingTone} onClick={() => setChoosingTone((v) => !v)}>
          {inTone(TONE_SAMPLE, tone)}
        </button>
      </div>
      {choosingTone && (
        <div className="emoji-tones" role="radiogroup" aria-label="Skin tone">
          {TONE_LABELS.map((label, t) => (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={t === tone}
              aria-label={label}
              className="emoji-cell"
              onClick={() => {
                setEmojiTone(t);
                setChoosingTone(false);
              }}
            >
              {inTone(TONE_SAMPLE, t)}
            </button>
          ))}
        </div>
      )}
      {!query.trim() && (
        <div className="emoji-tabs" role="tablist" aria-label="Emoji categories">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" role="tab" aria-selected={current === id} aria-label={label} title={label} disabled={!available.has(id)} onClick={() => jump(id)}>
              <Icon size={16} />
            </button>
          ))}
        </div>
      )}
      <div className="emoji-scroll" ref={scroller} onScroll={onScroll}>
        {!groups && !failed && <p className="muted emoji-note">Loading emoji…</p>}
        {failed && <p className="muted emoji-note">Emoji couldn't be loaded. Recent emoji still work.</p>}
        {query.trim() ? (
          groups && results.length === 0 ? (
            <p className="muted emoji-note">No emoji match “{query.trim()}”</p>
          ) : (
            <Grid items={results.map((it) => [inTone(it, tone), it.name])} onPick={pick} />
          )
        ) : (
          <>
            {(customEmoji.length > 0 || customStickers.length > 0) && (
              <section data-section={COMMUNITY} aria-label="Community">
                <h4 className="emoji-heading">Community</h4>
                <div className="emoji-grid">
                  {customEmoji.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      role="menuitem"
                      aria-label={`:${e.name}:`}
                      title={`:${e.name}:`}
                      onClick={() => (community?.reactions ? onPick(`:${e.name}:`) : community?.onEmoji?.(e))}
                    >
                      <CustomEmojiImage id={e.id} name={e.name} sha256={e.sha256} size={24} />
                    </button>
                  ))}
                </div>
                {customStickers.length > 0 && (
                  <>
                    <h4 className="emoji-heading">Stickers</h4>
                    <div className="sticker-grid">
                      {customStickers.map((e) => (
                        <button key={e.id} type="button" role="menuitem" aria-label={`Send sticker :${e.name}:`} title={`:${e.name}:`} onClick={() => community?.onSticker?.(e)}>
                          <CustomEmojiImage id={e.id} name={e.name} sha256={e.sha256} size={64} />
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </section>
            )}
            {recent.length > 0 && <Section id={RECENT} title="Recently used" items={recent.map((e) => [e, e])} onPick={pick} />}
            {groups?.map((g) => (
              <Section key={g.id} id={g.id} title={TABS.find((t) => t.id === g.id)?.label ?? g.name} items={g.items.map((it) => [inTone(it, tone), it.name])} onPick={pick} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function Section({ id, title, items, onPick }: { id: string; title: string; items: [string, string][]; onPick: (e: string) => void }) {
  return (
    <section data-section={id} aria-label={title}>
      <h4 className="emoji-heading">{title}</h4>
      <Grid items={items} onPick={onPick} />
    </section>
  );
}

function Grid({ items, onPick }: { items: [string, string][]; onPick: (e: string) => void }) {
  return (
    <div className="emoji-grid">
      {items.map(([emoji, name]) => (
        <button key={emoji} type="button" role="menuitem" aria-label={name} title={name} onClick={() => onPick(emoji)}>
          {emoji}
        </button>
      ))}
    </div>
  );
}
