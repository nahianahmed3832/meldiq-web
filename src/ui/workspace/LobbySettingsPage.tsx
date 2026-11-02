import { BookOpen, Paintbrush } from "lucide-react";
import { useEffect, useState } from "react";
import { LOBBY_LIMITS, type LobbySettings, type LobbySettingsView } from "../../api/lobbySchemas";
import type { OrgAdminDetail } from "../../api/workspaceSchemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { navigate } from "../../application/router";
import { LobbyStale, lobbySettings, saveLobby } from "../../sync/lobby";
import { changeCount, draftProblem, settingsBody, setWhoRunsIt } from "../../sync/lobbyDraft";
import { workspaceChannels } from "../../sync/workspaces";
import { Toggle } from "../components/Toggle";
import { requestLobbyEditor } from "../lobby/editorRequest";
import { ChannelPicker, FaqEditor } from "../lobby/fieldEditors";
import { toLobbyChannel } from "../lobby/lobbyContext";
import { useAction, useLoad } from "./useLoad";
import { Card, ErrorLine } from "./WorkspaceView";

/**
 * Community settings › Lobby (community parity B): whether members see the lobby, its About text, main channels, FAQ
 * and "who runs it". Everything else (look, templates, card order, buttons, the feed) is in the live editor on the
 * lobby itself. The community guide keeps its own page.
 */
export function LobbySettingsPage({ detail }: { detail: OrgAdminDetail }) {
  const engine = useEngine();
  const orgId = detail.org.id;
  const hasGuide = useOrbit((s) => s.server?.features.includes("community-guide") ?? false);
  const loaded = useLoad(() => lobbySettings(engine, orgId), [engine, orgId]);
  const channels = useLoad(() => workspaceChannels(engine, orgId, false), [engine, orgId]);
  const [saved, setSaved] = useState<LobbySettingsView | null>(null);
  const [draft, setDraft] = useState<LobbySettings | null>(null);
  const save = useAction();
  useEffect(() => {
    if (!loaded.data) return;
    setSaved(loaded.data);
    setDraft(loaded.data.settings);
  }, [loaded.data]);

  if (!saved || !draft) return loaded.error ? <ErrorLine text={loaded.error} /> : <div aria-busy="true" className="skeleton" style={{ height: 160, borderRadius: 16 }} />;
  const change = (patch: Partial<LobbySettings>) => setDraft({ ...draft, ...patch });
  const count = changeCount(saved.settings, draft);
  const problem = draftProblem(draft);
  const textChannels = (channels.data ?? []).filter((c) => !c.voice).map(toLobbyChannel);
  const openEditor = () => {
    requestLobbyEditor(orgId);
    navigate({ section: "lobby" });
  };
  const submit = () =>
    void save.act(async () => {
      try {
        const next = await saveLobby(engine, orgId, settingsBody(saved.settings, draft, saved.rev));
        setSaved(next);
        setDraft(next.settings);
        engine.notice("info", "Lobby saved.");
      } catch (e) {
        if (e instanceof LobbyStale) loaded.reload();
        throw e;
      }
    });

  return (
    <div className="ws-page">
      <button className="lobby-open-editor" onClick={openEditor}>
        <Paintbrush size={18} aria-hidden="true" />
        <span className="grow">
          <strong>Open the live editor</strong>
          <small>Layouts, colours, fonts, backgrounds, buttons, templates and the order of the cards, right on the lobby.</small>
        </span>
      </button>
      <Card title="Lobby" sub="The community's front page: new members land here the first time they open the community.">
        <ErrorLine text={channels.error ?? save.error} />
        <label className="setting">
          <span className="lines">
            <span>Show the lobby to members</span>
            <small>Off: only people who can edit the community see it.</small>
          </span>
          <Toggle checked={draft.enabled} onChange={(enabled) => change({ enabled })} label="Show the lobby to members" />
        </label>
        <div className="field">
          <label htmlFor="lobby-settings-about">About</label>
          <textarea
            id="lobby-settings-about"
            className="textarea"
            rows={6}
            maxLength={LOBBY_LIMITS.about}
            placeholder="What's this place about? Markdown works: **bold**, *italic*, - lists, [links](https://…)"
            value={draft.about ?? ""}
            onChange={(e) => change({ about: e.target.value })}
          />
          <small className="muted">
            {(draft.about ?? "").length}/{LOBBY_LIMITS.about}
          </small>
        </div>
        <h3 className="ws-subhead">Main channels</h3>
        <p className="muted" style={{ margin: 0 }}>
          Up to {LOBBY_LIMITS.mainChannels}, in the order people should open them. People only see the ones they can open.
        </p>
        <ChannelPicker value={draft.mainChannelIds} onChange={(mainChannelIds) => change({ mainChannelIds })} channels={textChannels} />
        <h3 className="ws-subhead">FAQ</h3>
        <FaqEditor value={draft.faq} onChange={(faq) => change({ faq })} />
        <label className="setting">
          <span className="lines">
            <span>Show who runs it</span>
            <small>The owner, and people whose roles let them edit or moderate the community.</small>
          </span>
          <Toggle checked={draft.showWhoRunsIt} onChange={(shown) => setDraft(setWhoRunsIt(draft, shown))} label="Show who runs it" />
        </label>
        {count > 0 && problem && <p className="muted">{problem}</p>}
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-primary btn-sm" disabled={save.busy || count === 0 || !!problem} onClick={submit}>
            Save
          </button>
          {count > 0 && (
            <button className="btn btn-ghost btn-sm" disabled={save.busy} onClick={() => setDraft(saved.settings)}>
              Cancel
            </button>
          )}
        </div>
      </Card>
      {hasGuide && (
        <button className="lobby-open-editor" onClick={() => navigate({ section: "workspace", workspacePage: "guide" })}>
          <BookOpen size={18} aria-hidden="true" />
          <span className="grow">
            <strong>Community guide</strong>
            <small>A welcome, first tasks and resources; shown in the lobby as its own card.</small>
          </span>
        </button>
      )}
    </div>
  );
}
