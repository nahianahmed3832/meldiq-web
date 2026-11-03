import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { FileText, Hash, HelpCircle, Sparkles } from "lucide-react";
import { type CSSProperties, useRef } from "react";
import type { LobbySectionKey } from "../../api/lobbySchemas";
import { cardState, lobbyIsBare, moveSection, pageColumns } from "../../sync/lobbyDraft";
import { ACCENT_CLASS, accentStyle, isAccent } from "../community/accent";
import { GuideCard } from "../community/GuideOnboarding";
import { useDragSort } from "../components/dragSort";
import { usePhoto } from "../components/photos";
import { TopCard } from "./cardsChannels";
import { LobbyCard } from "./LobbyCard";
import { LobbyHeader } from "./LobbyHeader";
import { useLobby } from "./lobbyContext";
interface LobbySurfaceProps {
  /** Customize: opens the editor, optionally on one card. Null for people who can't edit. */
  onCustomize: ((card?: LobbySectionKey) => void) | null;
  opening: boolean;
}
/**
 * The lobby as a page: its look (layout, accent, background, cards, font, banner, title) as classes and variables on one
 * element, so the live editor's draft restyles it in place. Narrow widths (a phone, or the editor's phone preview) fold
 * every layout into one column through a container query.
 */
export function LobbySurface({ onCustomize, opening }: LobbySurfaceProps) {
  useLocaleRender();
  const { view, editor, editing, orgId } = useLobby();
  const look = view.settings.look;
  const accent = look.accent === "auto" ? view.community.accent : look.accent;
  const bannerUrl = usePhoto("banner", view.community.id, view.community.bannerRev);
  const body = useRef<HTMLDivElement>(null);
  useDragSort(
    body,
    (drag, target, at) => editor?.change((d) => ({ ...d, sections: moveSection(d.sections, drag.id as LobbySectionKey, target.id as LobbySectionKey, at === "after" ? "after" : "before") })),
    editing,
  );
  const shown = view.settings.sections.filter((s) => s.shown);
  const { main, side } = pageColumns(shown, look.layout);
  const bare = lobbyIsBare(view);
  const vars = {
    ...accentStyle(accent),
    "--lobby-banner": bannerUrl ? `url(${bannerUrl})` : undefined,
  } as CSSProperties;
  const classes = [
    "lobby",
    `layout-${look.layout}`,
    `bg-${look.background}`,
    `cards-${look.cards}`,
    `font-${look.font}`,
    `banner-${look.bannerHeight}`,
    `title-${look.title}`,
    isAccent(accent) ? ACCENT_CLASS : "",
    editing ? "editing" : "",
  ].filter(Boolean);
  return (
    <div className={classes.join(" ")} style={vars}>
      <div className="lobby-backdrop" aria-hidden="true" />
      <LobbyHeader bannerUrl={bannerUrl} onCustomize={view.canEdit && !editor ? () => onCustomize?.() : null} opening={opening} />
      {editing && (
        <p className="lobby-hint">
          <Localized k="workspace.interface.drag_the_cards_to_move_them_click_one_to_edit_it_2b4508a" />
        </p>
      )}
      {bare && view.canEdit && (!editor || editing) && <BareCard onPick={(card) => (editor ? editor.select(card) : onCustomize?.(card))} />}
      {bare && !view.canEdit && shown.every((s) => cardState(s.key, view) !== "ok") && (
        <p className="lobby-hint">
          <Localized k="workspace.interface.this_community_hasn_t_set_up_its_lobby_yet_its_channels_are_on_th_1d47402" />
        </p>
      )}
      <div className="lobby-body" ref={body}>
        <div className="lobby-col lobby-col-main">
          <TopCard />
          {!editing && <GuideCard orgId={orgId} />}
          {main.map((s) => (
            <LobbyCard key={s.key} sectionKey={s.key} />
          ))}
        </div>
        {side.length > 0 && (
          <div className="lobby-col lobby-col-side">
            {side.map((s) => (
              <LobbyCard key={s.key} sectionKey={s.key} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
/** "Nothing here yet": where an editor starts, three ways in. */
function BareCard({ onPick }: { onPick: (card: LobbySectionKey) => void }) {
  useLocaleRender();
  return (
    <section className="lobby-card lobby-bare" aria-label={uiText("workspace.interface.set_up_the_lobby_8587a91")}>
      <Sparkles size={22} aria-hidden="true" className="lobby-bare-icon" />
      <h2>
        <Localized k="workspace.interface.nothing_here_yet_49abaf8" />
      </h2>
      <p className="muted">
        <Localized k="workspace.interface.this_is_the_first_thing_new_members_see_give_them_a_reason_to_sta_75a1438" />
      </p>
      <div className="lobby-buttons">
        <button className="btn btn-primary btn-sm lobby-primary" onClick={() => onPick("about")}>
          <Localized k="workspace.interface.write_an_intro_0bd6c5a" slots={[<FileText size={15} aria-hidden="true" />]} />
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => onPick("main_channels")}>
          <Localized k="workspace.interface.pick_main_channels_037dbd3" slots={[<Hash size={15} aria-hidden="true" />]} />
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => onPick("faq")}>
          <Localized k="workspace.interface.add_a_faq_657eef1" slots={[<HelpCircle size={15} aria-hidden="true" />]} />
        </button>
      </div>
    </section>
  );
}
