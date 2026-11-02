import { ChevronRight, GripVertical, Lock } from "lucide-react";
import { useRef } from "react";
import type { LobbySectionKey } from "../../api/lobbySchemas";
import { cardState, moveSection, setSection } from "../../sync/lobbyDraft";
import { useDragSort } from "../components/dragSort";
import { Toggle } from "../components/Toggle";
import { FeedUrl } from "./FeedUrl";
import { SECTION_INFO } from "./lobbyInfo";
import { useLobby } from "./lobbyContext";
import type { LobbyEditor } from "./useLobbyEditor";

/**
 * Sections: the cards in page order. Drag a row (or a card on the page) to move it; each has its Show switch and, for
 * the Classic layout, Main or Side. The top of the page always comes first. The feed URL is managed at the bottom.
 */
export function EditorSections({ editor }: { editor: LobbyEditor }) {
  const { view } = useLobby();
  const list = useRef<HTMLDivElement>(null);
  useDragSort(list, (drag, target, at) =>
    editor.change((d) => ({ ...d, sections: moveSection(d.sections, drag.id as LobbySectionKey, target.id as LobbySectionKey, at === "after" ? "after" : "before") })),
  );
  const classic = editor.draft.look.layout === "classic";
  return (
    <div className="lobby-editor-stack">
      <div className="lobby-sections" ref={list}>
        <div className="lobby-section-row fixed">
          <Lock size={14} className="faint" aria-hidden="true" />
          <button className="grow lobby-section-name" onClick={() => editor.select("top")}>
            Top of the page <small className="muted">always first</small>
          </button>
          <ChevronRight size={15} className="faint" aria-hidden="true" />
        </div>
        {editor.draft.sections.map((s) => {
          const state = cardState(s.key, view);
          const label = SECTION_INFO[s.key].label;
          return (
            <div key={s.key} className={`lobby-section-row${s.shown ? "" : " off"}`} data-drag={s.key} data-drag-kind="lobby-section" data-drag-group={s.column}>
              <GripVertical size={15} className="lobby-grip" aria-hidden="true" />
              <button className="grow lobby-section-name" onClick={() => editor.select(s.key)}>
                <span className="ellipsis">{label}</span>
                {state !== "ok" && <span className="lobby-chip">{state === "empty" ? "Empty" : "Nothing yet"}</span>}
              </button>
              {classic && (
                <button
                  className="chip lobby-column-chip"
                  data-no-drag
                  onClick={() => editor.change((d) => setSection(d, s.key, { column: s.column === "main" ? "side" : "main" }))}
                  aria-label={`${label}: in the ${s.column} column. Move to the ${s.column === "main" ? "side" : "main"} column`}
                >
                  {s.column === "main" ? "Main" : "Side"}
                </button>
              )}
              <span data-no-drag>
                <Toggle checked={s.shown} onChange={(shown) => editor.change((d) => setSection(d, s.key, { shown }))} label={`Show ${label}`} />
              </span>
            </div>
          );
        })}
      </div>
      {!classic && <p className="muted lobby-editor-note">Main and Side apply to the Classic layout; the others stack every card in one column.</p>}
      <FeedUrl editor={editor} />
    </div>
  );
}
