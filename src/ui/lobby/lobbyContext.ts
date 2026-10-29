import { createContext, useContext } from "react";
import type { LobbyChannel, LobbyView } from "../../api/lobbySchemas";
import type { Conversation } from "../../api/schemas";
import { navigate } from "../../application/router";
import { joinCommunityChannel } from "../../sync/community";
import type { Engine } from "../../sync/engine";
import type { LobbyEditor } from "./useLobbyEditor";

/** What every lobby card needs: the community, the lobby as drawn (the draft while editing), and the editor if open. */
export interface LobbyCtx {
  orgId: string;
  view: LobbyView;
  /** The live editor, while it's open (null for members and outside editing). */
  editor: LobbyEditor | null;
  /** Editing and not previewing: cards show their editing affordances. */
  editing: boolean;
  /** The community's channels for pickers (editors only; empty otherwise). */
  channels: LobbyChannel[];
  reload: () => void;
}

export const LobbyContext = createContext<LobbyCtx | null>(null);

export function useLobby(): LobbyCtx {
  const ctx = useContext(LobbyContext);
  if (!ctx) throw new Error("useLobby outside the lobby");
  return ctx;
}

/** A channel as the lobby lists it. */
export function toLobbyChannel(c: Pick<Conversation, "id" | "name" | "kind" | "voice" | "format">): LobbyChannel {
  return { id: c.id, name: c.name, kind: c.kind, voice: c.voice, format: c.format === "forum" ? "forum" : "text", lastActiveAt: null };
}

/** Opens a channel of the community, joining it first when it's one this account can see but hasn't joined. */
export async function openChannel(engine: Engine, orgId: string, channelId: string): Promise<void> {
  try {
    if (!engine.state.get().conversations[channelId]) await joinCommunityChannel(engine, orgId, channelId);
    navigate({ section: "home", conversationId: channelId });
  } catch {
    engine.notice("error", "That channel isn't available to you.");
  }
}
