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
      {editing && <p className="lobby-hint">Drag the cards to move them. Click one to edit it.</p>}
      {bare && view.canEdit && (!editor || editing) && <BareCard onPick={(card) => (editor ? editor.select(card) : onCustomize?.(card))} />}
      {bare && !view.canEdit && shown.every((s) => cardState(s.key, view) !== "ok") && <p className="lobby-hint">This community hasn't set up its lobby yet. Its channels are on the left.</p>}
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
  return (
    <section className="lobby-card lobby-bare" aria-label="Set up the lobby">
      <Sparkles size={22} aria-hidden="true" className="lobby-bare-icon" />
      <h2>Nothing here yet</h2>
      <p className="muted">This is the first thing new members see. Give them a reason to stay.</p>
      <div className="lobby-buttons">
        <button className="btn btn-primary btn-sm lobby-primary" onClick={() => onPick("about")}>
          <FileText size={15} aria-hidden="true" /> Write an intro
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => onPick("main_channels")}>
          <Hash size={15} aria-hidden="true" /> Pick main channels
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => onPick("faq")}>
          <HelpCircle size={15} aria-hidden="true" /> Add a FAQ
        </button>
      </div>
    </section>
  );
}
