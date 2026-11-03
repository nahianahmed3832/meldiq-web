import { MARKDOWN_SYNTAX } from "../../i18n/syntax";
import { formatUiNumber } from "../../i18n/format";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
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
  useLocaleRender();
  const l10n = useLocalization();
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
        engine.notice("info", uiText("workspace.interface.lobby_saved_6ece394"));
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
          <strong>
            <Localized k="workspace.interface.open_the_live_editor_e8ac0e8" />
          </strong>
          <small>
            <Localized k="workspace.interface.layouts_colours_fonts_backgrounds_buttons_templates_and_the_order_692af80" />
          </small>
        </span>
      </button>
      <Card title={uiText("workspace.interface.lobby_4c97a9e")} sub={uiText("workspace.interface.the_community_s_front_page_new_members_land_here_the_first_time_t_263cf8d")}>
        <ErrorLine text={channels.error ?? save.error} />
        <label className="setting">
          <span className="lines">
            <span>
              <Localized k="workspace.interface.show_the_lobby_to_members_a8e706a" />
            </span>
            <small>
              <Localized k="workspace.interface.off_only_people_who_can_edit_the_community_see_it_160ab56" />
            </small>
          </span>
          <Toggle checked={draft.enabled} onChange={(enabled) => change({ enabled })} label={uiText("workspace.interface.show_the_lobby_to_members_a8e706a")} />
        </label>
        <div className="field">
          <label htmlFor="lobby-settings-about">{l10n("settings.settings_about")}</label>
          <textarea
            id="lobby-settings-about"
            className="textarea"
            rows={6}
            maxLength={LOBBY_LIMITS.about}
            placeholder={`${uiText("workspace.interface.what_s_this_place_about_who_s_it_for_bold_italic_lists_with_and_l_d6bec8e")}\n\n${MARKDOWN_SYNTAX}`}
            value={draft.about ?? ""}
            onChange={(e) => change({ about: e.target.value })}
          />
          <small className="muted">
            {formatUiNumber((draft.about ?? "").length)}/{formatUiNumber(LOBBY_LIMITS.about)}
          </small>
        </div>
        <h3 className="ws-subhead">
          <Localized k="workspace.interface.main_channels_272f38c" />
        </h3>
        <p className="muted" style={{ margin: 0 }}>
          <Localized k="workspace.interface.up_to_in_the_order_people_should_open_them_people_only_see_the_on_8008c17" slots={[LOBBY_LIMITS.mainChannels]} />
        </p>
        <ChannelPicker value={draft.mainChannelIds} onChange={(mainChannelIds) => change({ mainChannelIds })} channels={textChannels} />
        <h3 className="ws-subhead">
          <Localized k="workspace.interface.faq_dbc468a" />
        </h3>
        <FaqEditor value={draft.faq} onChange={(faq) => change({ faq })} />
        <label className="setting">
          <span className="lines">
            <span>
              <Localized k="workspace.interface.show_who_runs_it_0efe261" />
            </span>
            <small>
              <Localized k="workspace.interface.the_owner_and_people_whose_roles_let_them_edit_or_moderate_the_co_16f39a7" />
            </small>
          </span>
          <Toggle checked={draft.showWhoRunsIt} onChange={(shown) => setDraft(setWhoRunsIt(draft, shown))} label={uiText("workspace.interface.show_who_runs_it_0efe261")} />
        </label>
        {count > 0 && problem && <p className="muted">{problem}</p>}
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-primary btn-sm" disabled={save.busy || count === 0 || !!problem} onClick={submit}>
            {l10n("common.actions.save")}
          </button>
          {count > 0 && (
            <button className="btn btn-ghost btn-sm" disabled={save.busy} onClick={() => setDraft(saved.settings)}>
              {l10n("common.actions.cancel")}
            </button>
          )}
        </div>
      </Card>
      {hasGuide && (
        <button className="lobby-open-editor" onClick={() => navigate({ section: "workspace", workspacePage: "guide" })}>
          <BookOpen size={18} aria-hidden="true" />
          <span className="grow">
            <strong>
              <Localized k="organization.interface.community_guide_0fdcaac" />
            </strong>
            <small>
              <Localized k="workspace.interface.a_welcome_first_tasks_and_resources_shown_in_the_lobby_as_its_own_f7b46db" />
            </small>
          </span>
        </button>
      )}
    </div>
  );
}
