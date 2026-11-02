import { useCallback, useState } from "react";
import { ApiError } from "../../api/client";
import type { LobbySectionKey, LobbySettings, LobbySettingsView, LobbyTemplateKey } from "../../api/lobbySchemas";
import { useEngine } from "../../application/orbit";
import { applyLobbyTemplate, LobbyStale, lobbySettings, saveLobby } from "../../sync/lobby";
import { changeCount, draftProblem, settingsBody } from "../../sync/lobbyDraft";

/** The card being edited: a section, or the top of the page. */
export type Selected = LobbySectionKey | "top" | null;
export type EditorTab = "templates" | "look" | "sections";

export interface LobbyEditor {
  saved: LobbySettingsView;
  draft: LobbySettings;
  change: (fn: (d: LobbySettings) => LobbySettings) => void;
  count: number;
  problem: string | null;
  busy: boolean;
  error: string | null;
  selected: Selected;
  select: (s: Selected) => void;
  tab: EditorTab;
  setTab: (t: EditorTab) => void;
  phone: boolean;
  setPhone: (p: boolean) => void;
  preview: boolean;
  setPreview: (p: boolean) => void;
  save: () => Promise<boolean>;
  cancel: () => void;
  applyTemplate: (key: LobbyTemplateKey) => Promise<void>;
  /** The feed URL's state changed (created, rotated, deleted). */
  setFeed: (feed: LobbySettingsView["feed"]) => void;
}

/**
 * The live editor's state: the saved settings and revision, the draft the page renders, and Save (only what changed,
 * on the saved revision; someone else's save in between loads theirs and says so).
 */
export function useLobbyEditor(orgId: string, onSaved: () => void): { editor: LobbyEditor | null; open: () => Promise<void>; close: () => void; opening: boolean; openError: string | null } {
  const engine = useEngine();
  const [saved, setSaved] = useState<LobbySettingsView | null>(null);
  const [draft, setDraft] = useState<LobbySettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  const [selected, select] = useState<Selected>(null);
  const [tab, setTab] = useState<EditorTab>("sections");
  const [phone, setPhone] = useState(false);
  const [preview, setPreview] = useState(false);

  const load = useCallback((view: LobbySettingsView) => {
    setSaved(view);
    setDraft(view.settings);
  }, []);

  const open = useCallback(async () => {
    setOpening(true);
    setOpenError(null);
    try {
      load(await lobbySettings(engine, orgId));
    } catch (e) {
      setOpenError(e instanceof ApiError ? e.message : "Couldn't open the editor. Try again.");
    } finally {
      setOpening(false);
    }
  }, [engine, orgId, load]);

  const close = useCallback(() => {
    setSaved(null);
    setDraft(null);
    setError(null);
    select(null);
    setPreview(false);
    setPhone(false);
  }, []);

  /** Runs a server change; a stale revision reloads the server's version and explains. */
  const run = useCallback(
    async (fn: () => Promise<LobbySettingsView>): Promise<boolean> => {
      setBusy(true);
      setError(null);
      try {
        load(await fn());
        onSaved();
        return true;
      } catch (e) {
        if (e instanceof LobbyStale) {
          setError(e.message);
          await lobbySettings(engine, orgId)
            .then(load)
            .catch(() => undefined);
          onSaved();
        } else setError(e instanceof ApiError ? e.message : "That didn't work. Try again.");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [engine, orgId, load, onSaved],
  );

  if (!saved || !draft) return { editor: null, open, close, opening, openError };
  const editor: LobbyEditor = {
    saved,
    draft,
    change: (fn) => {
      setError(null);
      setDraft((d) => (d ? fn(d) : d));
    },
    count: changeCount(saved.settings, draft),
    problem: draftProblem(draft),
    busy,
    error,
    selected,
    select,
    tab,
    setTab,
    phone,
    setPhone,
    preview,
    setPreview,
    save: () => run(() => saveLobby(engine, orgId, settingsBody(saved.settings, draft, saved.rev))),
    cancel: () => {
      setDraft(saved.settings);
      setError(null);
      select(null);
    },
    applyTemplate: async (key) => {
      await run(() => applyLobbyTemplate(engine, orgId, key, saved.rev));
    },
    setFeed: (feed) => setSaved({ ...saved, feed }),
  };
  return { editor, open, close, opening, openError };
}
