import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
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
  useLocaleRender();
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
            <Localized
              k="workspace.interface.top_of_the_page_74a1203"
              slots={[
                <small className="muted">
                  <Localized k="workspace.interface.always_first_3a11e51" />
                </small>,
              ]}
            />
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
                {state !== "ok" && <span className="lobby-chip">{state === "empty" ? uiText("workspace.interface.empty_c6c094b") : uiText("workspace.interface.nothing_yet_5beceeb")}</span>}
              </button>
              {classic && (
                <button
                  className="chip lobby-column-chip"
                  data-no-drag
                  onClick={() => editor.change((d) => setSection(d, s.key, { column: s.column === "main" ? "side" : "main" }))}
                  aria-label={uiText("workspace.interface.value0_in_the_value1_column_move_to_the_value2_column_965e300", {
                    value0: label,
                    value1: s.column === "main" ? uiText("workspace.interface.main_b28b7af") : uiText("workspace.interface.side_160cefc"),
                    value2: s.column === "main" ? uiText("workspace.interface.side_160cefc") : uiText("workspace.interface.main_b28b7af"),
                  })}
                >
                  {s.column === "main" ? uiText("workspace.interface.main_eb814be") : uiText("workspace.interface.side_630ef00")}
                </button>
              )}
              <span data-no-drag>
                <Toggle checked={s.shown} onChange={(shown) => editor.change((d) => setSection(d, s.key, { shown }))} label={uiText("organization.interface.show_value0_bf682fa", { value0: label })} />
              </span>
            </div>
          );
        })}
      </div>
      {!classic && (
        <p className="muted lobby-editor-note">
          <Localized k="workspace.interface.main_and_side_apply_to_the_classic_layout_the_others_stack_every_b731de6" />
        </p>
      )}
      <FeedUrl editor={editor} />
    </div>
  );
}
