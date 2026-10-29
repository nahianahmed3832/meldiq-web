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
  const key = editor.selected;
  if (!key) return null;
  const label = key === "top" ? "Top of the page" : SECTION_INFO[key].label;
  const section = key === "top" ? null : editor.draft.sections.find((s) => s.key === key);
  return (
    <div className="lobby-editor-stack">
      <div className="row" style={{ gap: 6 }}>
        <button className="icon-btn" onClick={() => editor.select(null)} aria-label="Back to all sections">
          <ArrowLeft size={18} />
        </button>
        <h3 className="grow lobby-card-editor-title">{label}</h3>
      </div>
      {section && (
        <div className="lobby-card-editor-controls">
          <label className="row" style={{ gap: 8 }}>
            <span className="grow">Show this card</span>
            <Toggle checked={section.shown} onChange={(shown) => editor.change((d) => setSection(d, section.key, { shown }))} label={`Show ${label}`} />
          </label>
          {editor.draft.look.layout === "classic" && (
            <div className="segmented lobby-seg" role="group" aria-label="Column">
              {(["main", "side"] as const).map((c) => (
                <button key={c} aria-pressed={section.column === c} onClick={() => editor.change((d) => setSection(d, section.key, { column: c }))}>
                  {c === "main" ? "Main column" : "Side column"}
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
  const { channels } = useLobby();
  const tagline = editor.draft.tagline ?? "";
  return (
    <>
      <div className="field">
        <label htmlFor="lobby-tagline">Tagline</label>
        <input
          id="lobby-tagline"
          className="input"
          maxLength={LOBBY_LIMITS.tagline}
          placeholder="Where night owls build games together"
          value={tagline}
          onChange={(e) => editor.change((d) => ({ ...d, tagline: e.target.value }))}
        />
        <small className="muted">
          {tagline.length}/{LOBBY_LIMITS.tagline}
        </small>
      </div>
      <h4 className="ws-subhead">Buttons</h4>
      <p className="muted lobby-editor-note">The first one stands out.</p>
      <ButtonsEditor value={editor.draft.buttons} onChange={(buttons) => editor.change((d) => ({ ...d, buttons }))} channels={channels} />
    </>
  );
}

function SectionFields({ editor, sectionKey }: { editor: LobbyEditor; sectionKey: LobbySectionKey }) {
  const { channels } = useLobby();
  const info = SECTION_INFO[sectionKey];
  switch (sectionKey) {
    case "about":
      return (
        <div className="field">
          <label htmlFor="lobby-about">About</label>
          <textarea
            id="lobby-about"
            className="textarea"
            rows={9}
            maxLength={LOBBY_LIMITS.about}
            placeholder={"What's this place about? Who's it for?\n\n**Bold**, *italic*, lists with - and [links](https://…) work."}
            value={editor.draft.about ?? ""}
            onChange={(e) => editor.change((d) => ({ ...d, about: e.target.value }))}
          />
          <small className="muted">
            {(editor.draft.about ?? "").length}/{LOBBY_LIMITS.about} · Markdown: **bold**, *italic*, # headings, - lists, [links](https://…)
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
          <legend>Boards (several show as tabs)</legend>
          {LOBBY_BOARDS.map((b) => (
            <label key={b} className="row" style={{ gap: 8 }}>
              <input type="checkbox" checked={editor.draft.leaderboards.includes(b)} onChange={() => editor.change((d) => ({ ...d, leaderboards: toggleBoard(d.leaderboards, b) }))} />
              <span className="grow">{BOARD_LABELS[b]}</span>
            </label>
          ))}
          <small className="muted">Levels fill in once a levels bot is running.</small>
        </fieldset>
      );
    case "feed":
      return <FeedUrl editor={editor} />;
    case "who_runs_it":
      return <p className="muted">The owner, admins, and people whose roles let them edit the community or moderate it.</p>;
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
