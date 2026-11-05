import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { Clock, Coffee, Flag, Lightbulb, type LucideIcon, PawPrint, PersonStanding, Plane, Shapes, Smile, Trophy, UsersRound } from "lucide-react";
import type { Expression, ExpressionList } from "../../sync/expressions";
import { CustomEmojiImage } from "../community/CustomEmoji";
import { useEffect, useMemo, useRef, useState } from "react";
import { type EmojiGroup, type EmojiItem, emojiPrefsScope, emojiUsed, inTone, loadCatalog, searchEmoji, setEmojiTone, useEmojiPrefs } from "../../emoji/catalog";
import { useEngine } from "../../application/orbit";
const RECENT = "recent";
const COMMUNITY = "community";
const TABS: {
  id: string;
  label: string;
  icon: LucideIcon;
}[] = [
  {
    id: COMMUNITY,
    get label() {
      return uiText("organization.community");
    },
    icon: UsersRound,
  },
  {
    id: RECENT,
    get label() {
      return uiText("messaging.interface.recently_used_1e7cf8d");
    },
    icon: Clock,
  },
  {
    id: "smileys",
    get label() {
      return uiText("messaging.interface.smileys_emotion_402f09d");
    },
    icon: Smile,
  },
  {
    id: "people",
    get label() {
      return uiText("messaging.interface.people_body_95e1f30");
    },
    icon: PersonStanding,
  },
  {
    id: "nature",
    get label() {
      return uiText("messaging.interface.animals_nature_6110637");
    },
    icon: PawPrint,
  },
  {
    id: "food",
    get label() {
      return uiText("messaging.interface.food_drink_48f1e8b");
    },
    icon: Coffee,
  },
  {
    id: "travel",
    get label() {
      return uiText("messaging.interface.travel_places_21ac848");
    },
    icon: Plane,
  },
  {
    id: "activities",
    get label() {
      return uiText("messaging.interface.activities_4d0076e");
    },
    icon: Trophy,
  },
  {
    id: "objects",
    get label() {
      return uiText("messaging.interface.objects_de5236e");
    },
    icon: Lightbulb,
  },
  {
    id: "symbols",
    get label() {
      return uiText("messaging.interface.symbols_9491fc4");
    },
    icon: Shapes,
  },
  {
    id: "flags",
    get label() {
      return uiText("messaging.interface.flags_f38d995");
    },
    icon: Flag,
  },
];
const toneLabels = () => [
  uiText("messaging.interface.default_skin_tone_fc85430"),
  uiText("messaging.interface.light_skin_tone_e0d1de0"),
  uiText("messaging.interface.medium_light_skin_tone_8100ff2"),
  uiText("messaging.interface.medium_skin_tone_34c30bf"),
  uiText("messaging.interface.medium_dark_skin_tone_b80ed1b"),
  uiText("messaging.interface.dark_skin_tone_5568ec1"),
];
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
export function EmojiPicker({ onPick, community, query: sharedQuery, embedded = false }: { onPick: (emoji: string) => void; community?: CommunityPick; query?: string; embedded?: boolean }) {
  const l10n = useLocalization();
  const engine = useEngine();
  const prefsScope = emojiPrefsScope(engine.store.name, engine.device.userId);

  const [groups, setGroups] = useState<EmojiGroup[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [localQuery, setQuery] = useState("");
  const query = sharedQuery ?? localQuery;
  const [choosingTone, setChoosingTone] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const { recent, tone } = useEmojiPrefs(prefsScope);
  const search = useRef<HTMLInputElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let live = true;
    loadCatalog().then(
      (g) => live && setGroups(g),
      () => live && setFailed(true),
    );
    // The menu focuses its first item after mounting; the search box should have the focus instead.
    const t = window.setTimeout(() => {
      if (!embedded && window.matchMedia("(hover: hover) and (pointer: fine)").matches) search.current?.focus({ preventScroll: true });
    }, 0);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [embedded]);
  const results = useMemo(() => (groups && query.trim() ? searchEmoji(groups, query) : []), [groups, query]);
  const pick = (emoji: string) => {
    emojiUsed(prefsScope, emoji);
    onPick(emoji);
  };
  const jump = (id: string) => {
    const box = scroller.current;
    const section = box?.querySelector<HTMLElement>(`[data-section="${id}"]`);
    // .emoji-scroll is positioned, so a section's offsetTop is measured from the top of its content.
    if (embedded) {
      section?.scrollIntoView({ block: "nearest" });
      setCurrent(id);
    } else if (box && section) box.scrollTop = section.offsetTop;
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
  const customMatches = customEmoji.filter((e) =>
    query
      .toLowerCase()
      .replace(/[:_]/g, " ")
      .trim()
      .split(/\s+/)
      .every((part) => e.name.replace(/_/g, " ").includes(part)),
  );
  const available = new Set([...(customEmoji.length || customStickers.length ? [COMMUNITY] : []), ...(recent.length ? [RECENT] : []), ...(groups ?? []).map((g) => g.id)]);
  return (
    <div className={`emoji-picker${embedded ? " embedded" : ""}`}>
      <div className="emoji-picker-top">
        {embedded ? (
          <h3 className="xp-group-heading">
            <Localized k="messaging.interface.default_emoji_b9e9daa" />
          </h3>
        ) : (
          <input
            ref={search}
            className="input"
            type="search"
            placeholder={uiText("messaging.interface.search_emoji_87fafa7")}
            aria-label={uiText("messaging.interface.search_emoji_87fafa7")}
            value={query}
            onChange={(e) => setQuery(e.target.value.slice(0, MAX_QUERY))}
          />
        )}
        <button type="button" className="emoji-cell" aria-label={uiText("messaging.interface.skin_tone_8817dfe")} aria-expanded={choosingTone} onClick={() => setChoosingTone((v) => !v)}>
          {inTone(TONE_SAMPLE, tone)}
        </button>
      </div>
      {choosingTone && (
        <div className="emoji-tones" role="radiogroup" aria-label={uiText("messaging.interface.skin_tone_8817dfe")}>
          {toneLabels().map((label, t) => (
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
        <div className="emoji-tabs" role="tablist" aria-label={uiText("messaging.interface.emoji_categories_fed48f9")}>
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" role="tab" aria-selected={current === id} aria-label={label} title={label} disabled={!available.has(id)} onClick={() => jump(id)}>
              <Icon size={16} />
            </button>
          ))}
        </div>
      )}
      <div className="emoji-scroll" ref={scroller} onScroll={onScroll}>
        {!groups && !failed && (
          <p className="muted emoji-note">
            <Localized k="messaging.interface.loading_emoji_f35e910" />
          </p>
        )}
        {failed && (
          <p className="muted emoji-note">
            <Localized k="messaging.interface.emoji_couldn_t_be_loaded_recent_emoji_still_work_c967580" />
          </p>
        )}
        {query.trim() ? (
          <>
            {customMatches.length > 0 && (
              <section aria-label={uiText("messaging.interface.community_emoji_search_results_928ee72")}>
                <h4 className="emoji-heading">{l10n("organization.community")}</h4>
                <div className="emoji-grid">
                  {customMatches.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      role="menuitem"
                      aria-label={uiText("messaging.interface.value0_744855e", { value0: e.name })}
                      title={uiText("messaging.interface.value0_744855e", { value0: e.name })}
                      onClick={() => (community?.reactions ? onPick(`:${e.name}:`) : community?.onEmoji?.(e))}
                    >
                      <CustomEmojiImage id={e.id} name={e.name} sha256={e.sha256} size={24} />
                    </button>
                  ))}
                </div>
              </section>
            )}
            {groups && results.length === 0 && customMatches.length === 0 ? (
              <p className="muted emoji-note">
                <Localized
                  k="messaging.interface.no_match_00b39f5"
                  slots={[embedded ? uiText("messaging.interface.default_emoji_68f315b") : uiText("messaging.interface.emoji_4030f0c"), query.trim()]}
                />
              </p>
            ) : (
              <Grid items={results.map((it) => [inTone(it, tone), it.name])} onPick={pick} />
            )}
          </>
        ) : (
          <>
            {(customEmoji.length > 0 || customStickers.length > 0) && (
              <section data-section={COMMUNITY} aria-label={l10n("organization.community")}>
                <h4 className="emoji-heading">{l10n("organization.community")}</h4>
                <div className="emoji-grid">
                  {customEmoji.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      role="menuitem"
                      aria-label={uiText("messaging.interface.value0_744855e", { value0: e.name })}
                      title={uiText("messaging.interface.value0_744855e", { value0: e.name })}
                      onClick={() => (community?.reactions ? onPick(`:${e.name}:`) : community?.onEmoji?.(e))}
                    >
                      <CustomEmojiImage id={e.id} name={e.name} sha256={e.sha256} size={24} />
                    </button>
                  ))}
                </div>
                {customStickers.length > 0 && (
                  <>
                    <h4 className="emoji-heading">
                      <Localized k="messaging.interface.stickers_dbf9cbb" />
                    </h4>
                    <div className="sticker-grid">
                      {customStickers.map((e) => (
                        <button
                          key={e.id}
                          type="button"
                          role="menuitem"
                          aria-label={uiText("messaging.interface.send_sticker_value0_87ab651", { value0: e.name })}
                          title={uiText("messaging.interface.value0_744855e", { value0: e.name })}
                          onClick={() => community?.onSticker?.(e)}
                        >
                          <CustomEmojiImage id={e.id} name={e.name} sha256={e.sha256} size={64} />
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </section>
            )}
            {recent.length > 0 && <Section id={RECENT} title={uiText("messaging.interface.recently_used_1e7cf8d")} items={recent.map((e) => [e, e])} onPick={pick} />}
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
  useLocaleRender();
  return (
    <section data-section={id} aria-label={title}>
      <h4 className="emoji-heading">{title}</h4>
      <Grid items={items} onPick={onPick} />
    </section>
  );
}
function Grid({ items, onPick }: { items: [string, string][]; onPick: (e: string) => void }) {
  useLocaleRender();
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
