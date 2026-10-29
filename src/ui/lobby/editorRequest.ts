/** Set by "Open the live editor" in Community settings › Lobby: the lobby opens with its editor once. */
let requested: string | null = null;

/** Fired when the editor is asked for, for a lobby that's already on screen (behind the settings window). */
export const LOBBY_EDITOR_EVENT = "meldiq:lobby-editor";

export function requestLobbyEditor(orgId: string): void {
  requested = orgId;
  window.dispatchEvent(new Event(LOBBY_EDITOR_EVENT));
}

/** Whether the editor was asked for [orgId]; asking is used up. */
export function takeEditorRequest(orgId: string): boolean {
  if (requested !== orgId) return false;
  requested = null;
  return true;
}
