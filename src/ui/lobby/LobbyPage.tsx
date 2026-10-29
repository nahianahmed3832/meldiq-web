import { useEffect, useMemo, useState } from "react";
import type { LobbyChannel, LobbySectionKey } from "../../api/lobbySchemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { lobbyView, markLobbySeen } from "../../sync/lobby";
import { withDraft } from "../../sync/lobbyDraft";
import { workspaceChannels } from "../../sync/workspaces";
import { MeldlingArt } from "../components/MeldlingArt";
import { useLoad } from "../workspace/useLoad";
import { LobbyEditorPanel } from "./LobbyEditorPanel";
import { LobbyContext, type LobbyCtx, toLobbyChannel } from "./lobbyContext";
import { LobbySurface } from "./LobbySurface";
import { useLobbyEditor } from "./useLobbyEditor";
import { LOBBY_EDITOR_EVENT, takeEditorRequest } from "./editorRequest";

/**
 * A community's lobby (community parity B): the page members land on the first time they open the community. People who
 * can edit it get Customize, which puts the live editor beside the page: the page shows the draft as it changes.
 */
export function LobbyPage({ orgId }: { orgId: string }) {
  const engine = useEngine();
  const org = useOrbit((s) => s.orgs.find((o) => o.id === orgId) ?? null);
  const loaded = useLoad(() => lobbyView(engine, orgId), [engine, orgId, org]);
  const { editor, open, close, opening, openError } = useLobbyEditor(orgId, loaded.reload);
  const [channels, setChannels] = useState<LobbyChannel[]>([]);
  const view = loaded.data?.community.id === orgId ? loaded.data : null;

  // The first visit is remembered by the server: the app stops opening the lobby first.
  const unseen = !!view && !view.seen;
  useEffect(() => {
    if (unseen) void markLobbySeen(engine, orgId).catch(() => undefined);
  }, [unseen, engine, orgId]);

  // Another community: the editor (and its draft) closes.
  useEffect(() => close, [orgId, close]);

  const canEdit = !!view?.canEdit;
  useEffect(() => {
    if (!canEdit) return;
    let live = true;
    void workspaceChannels(engine, orgId, false)
      .then((list) => live && setChannels(list.map(toLobbyChannel)))
      .catch(() => undefined);
    const onRequest = () => takeEditorRequest(orgId) && void open();
    onRequest();
    window.addEventListener(LOBBY_EDITOR_EVENT, onRequest);
    return () => {
      live = false;
      window.removeEventListener(LOBBY_EDITOR_EVENT, onRequest);
    };
  }, [canEdit, engine, orgId, open]);

  const drawn = useMemo(() => (view && editor ? withDraft(view, editor.draft, new Map(channels.map((c) => [c.id, c]))) : view), [view, editor, channels]);
  const ctx: LobbyCtx | null = drawn ? { orgId, view: drawn, editor, editing: !!editor && !editor.preview, channels, reload: loaded.reload } : null;

  // A card asked for before the editor opened (the "nothing here yet" buttons) is selected once it's open.
  const [pending, setPending] = useState<LobbySectionKey | null>(null);
  useEffect(() => {
    if (editor && pending) {
      editor.select(pending);
      setPending(null);
    }
  }, [editor, pending]);

  if (!ctx) {
    return (
      <section className="main lobby-main" aria-label="Lobby" aria-busy={loaded.loading}>
        {loaded.error && !loaded.loading ? (
          <div className="empty" style={{ margin: "auto" }}>
            <MeldlingArt pose="confused" />
            <h2>Couldn't open the lobby</h2>
            <p className="muted">{loaded.error}</p>
            <button className="btn btn-secondary" onClick={loaded.reload}>
              Try again
            </button>
          </div>
        ) : (
          <div className="lobby-skeleton">
            <span className="skeleton" style={{ height: 180, borderRadius: 18 }} />
            <span className="skeleton" style={{ height: 120, borderRadius: 18 }} />
          </div>
        )}
      </section>
    );
  }

  return (
    <LobbyContext.Provider value={ctx}>
      <section className={`main lobby-main${editor ? " with-editor" : ""}`} aria-label={`${ctx.view.community.name} lobby`}>
        <div className={`lobby-canvas scroll${editor?.phone ? " phone-preview" : ""}`}>
          {openError && (
            <div className="banner danger" role="alert">
              <span className="grow">{openError}</span>
            </div>
          )}
          <LobbySurface
            onCustomize={
              canEdit
                ? (card) => {
                    if (card) setPending(card);
                    void open();
                  }
                : null
            }
            opening={opening}
          />
        </div>
        {editor && <LobbyEditorPanel editor={editor} onClose={close} />}
      </section>
    </LobbyContext.Provider>
  );
}
