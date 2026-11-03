import { MARKDOWN_SYNTAX } from "../../i18n/syntax";
import { formatUiNumber } from "../../i18n/format";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { LOBBY_BOARDS, LOBBY_LIMITS, type LobbySectionKey } from "../../api/lobbySchemas";
import { navigate } from "../../application/router";
import { setSection, toggleBoard } from "../../sync/lobbyDraft";
import { Toggle } from "../components/Toggle";
import { ButtonsEditor, ChannelPicker, FaqEditor } from "./fieldEditors";
import { FeedUrl } from "./FeedUrl";
import { BOARD_LABELS, SECTION_INFO } from "./lobbyInfo";
import { useLobby } from "./lobbyContext";
import type { LobbyEditor } from "./useLobbyEditor";
/** A clicked card's editor: its Show switch and column, and what it holds, each change drawn on the page at once. */
export function CardEditor({ editor }: { editor: LobbyEditor }) {
  useLocaleRender();
  const key = editor.selected;
  if (!key) return null;
  const label = key === "top" ? uiText("organization.interface.top_of_the_page_8287ff5") : SECTION_INFO[key].label;
  const section = key === "top" ? null : editor.draft.sections.find((s) => s.key === key);
  return (
    <div className="lobby-editor-stack">
      <div className="row" style={{ gap: 6 }}>
        <button className="icon-btn" onClick={() => editor.select(null)} aria-label={uiText("workspace.interface.back_to_all_sections_c634339")}>
          <ArrowLeft size={18} />
        </button>
        <h3 className="grow lobby-card-editor-title">{label}</h3>
      </div>
      {section && (
        <div className="lobby-card-editor-controls">
          <label className="row" style={{ gap: 8 }}>
            <span className="grow">
              <Localized k="workspace.interface.show_this_card_221b6ca" />
            </span>
            <Toggle
              checked={section.shown}
              onChange={(shown) => editor.change((d) => setSection(d, section.key, { shown }))}
              label={uiText("organization.interface.show_value0_bf682fa", { value0: label })}
            />
          </label>
          {editor.draft.look.layout === "classic" && (
            <div className="segmented lobby-seg" role="group" aria-label={uiText("workspace.interface.column_3fdc9a5")}>
              {(["main", "side"] as const).map((c) => (
                <button key={c} aria-pressed={section.column === c} onClick={() => editor.change((d) => setSection(d, section.key, { column: c }))}>
                  {c === "main" ? uiText("workspace.interface.main_column_c33e7f2") : uiText("workspace.interface.side_column_4af85e0")}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {key === "top" ? <TopFields editor={editor} /> : <SectionFields editor={editor} sectionKey={key} />}
    </div>
  );
}
function TopFields({ editor }: { editor: LobbyEditor }) {
  useLocaleRender();
  const { channels } = useLobby();
  const tagline = editor.draft.tagline ?? "";
  return (
    <>
      <div className="field">
        <label htmlFor="lobby-tagline">
          <Localized k="workspace.interface.tagline_fdab2c2" />
        </label>
        <input
          id="lobby-tagline"
          className="input"
          maxLength={LOBBY_LIMITS.tagline}
          placeholder={uiText("workspace.interface.where_night_owls_build_games_together_8d19e17")}
          value={tagline}
          onChange={(e) => editor.change((d) => ({ ...d, tagline: e.target.value }))}
        />
        <small className="muted">
          {formatUiNumber(tagline.length)}/{formatUiNumber(LOBBY_LIMITS.tagline)}
        </small>
      </div>
      <h4 className="ws-subhead">
        <Localized k="workspace.interface.buttons_d452583" />
      </h4>
      <p className="muted lobby-editor-note">
        <Localized k="workspace.interface.the_first_one_stands_out_5a02977" />
      </p>
      <ButtonsEditor value={editor.draft.buttons} onChange={(buttons) => editor.change((d) => ({ ...d, buttons }))} channels={channels} />
    </>
  );
}
function SectionFields({ editor, sectionKey }: { editor: LobbyEditor; sectionKey: LobbySectionKey }) {
  useLocaleRender();
  const l10n = useLocalization();
  const { channels } = useLobby();
  const info = SECTION_INFO[sectionKey];
  switch (sectionKey) {
    case "about":
      return (
        <div className="field">
          <label htmlFor="lobby-about">{l10n("settings.settings_about")}</label>
          <textarea
            id="lobby-about"
            className="textarea"
            rows={9}
            maxLength={LOBBY_LIMITS.about}
            placeholder={`${uiText("workspace.interface.what_s_this_place_about_who_s_it_for_bold_italic_lists_with_and_l_d6bec8e")}\n\n${MARKDOWN_SYNTAX}`}
            value={editor.draft.about ?? ""}
            onChange={(e) => editor.change((d) => ({ ...d, about: e.target.value }))}
          />
          <small className="muted">
            <Localized k="workspace.interface.markdown_bold_italic_headings_lists_links_https_7d60377" slots={[(editor.draft.about ?? "").length, LOBBY_LIMITS.about]} />
          </small>
        </div>
      );
    case "main_channels":
      return <ChannelPicker value={editor.draft.mainChannelIds} onChange={(mainChannelIds) => editor.change((d) => ({ ...d, mainChannelIds }))} channels={channels.filter((c) => !c.voice)} />;
    case "faq":
      return <FaqEditor value={editor.draft.faq} onChange={(faq) => editor.change((d) => ({ ...d, faq }))} />;
    case "leaderboard":
      return (
        <fieldset className="lobby-field">
          <legend>
            <Localized k="workspace.interface.boards_several_show_as_tabs_a7a57b4" />
          </legend>
          {LOBBY_BOARDS.map((b) => (
            <label key={b} className="row" style={{ gap: 8 }}>
              <input type="checkbox" checked={editor.draft.leaderboards.includes(b)} onChange={() => editor.change((d) => ({ ...d, leaderboards: toggleBoard(d.leaderboards, b) }))} />
              <span className="grow">{BOARD_LABELS[b]}</span>
            </label>
          ))}
          <small className="muted">
            <Localized k="workspace.interface.levels_fill_in_once_a_levels_bot_is_running_40a5610" />
          </small>
        </fieldset>
      );
    case "feed":
      return <FeedUrl editor={editor} />;
    case "who_runs_it":
      return (
        <p className="muted">
          <Localized k="workspace.interface.the_owner_admins_and_people_whose_roles_let_them_edit_the_communi_836aee3" />
        </p>
      );
    default:
      return (
        <>
          <p className="muted">{info.empty}</p>
          {info.action?.kind === "page" && info.cta && (
            <button
              className="btn btn-secondary btn-sm"
              style={{ justifySelf: "start" }}
              onClick={() => info.action?.kind === "page" && navigate({ section: "workspace", workspacePage: info.action.page })}
            >
              <ExternalLink size={14} aria-hidden="true" /> {info.cta}
            </button>
          )}
        </>
      );
  }
}
