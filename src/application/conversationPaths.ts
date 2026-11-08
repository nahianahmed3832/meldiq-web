import { DECIMAL_LINK_ID, decodeLinkId, encodeLinkId } from "./linkIds";

const sections = ["dms", "activity", "later", "friends", "discover", "lobby"] as const;
const panels = ["details", "search", "pinned", "threads", "members"] as const;
export type ConversationSection = "home" | (typeof sections)[number];
export type ConversationPanel = "thread" | (typeof panels)[number];
const suffix = `(?:/(${panels.join("|")})|/thread/(${DECIMAL_LINK_ID}))?/?$`;
const channels = new RegExp(`^/channels/(?:(${DECIMAL_LINK_ID})/)?(${DECIMAL_LINK_ID})${suffix}`);
const conversations = new RegExp(`^/(${sections.join("|")})/(${DECIMAL_LINK_ID})${suffix}`);

export function numericConversationPath(section: ConversationSection, conversationId: string, communityId?: string | null): string {
  const conversation = encodeLinkId(conversationId);
  if (section !== "home") return `/${section}/${conversation}`;
  return communityId ? `/channels/${encodeLinkId(communityId)}/${conversation}` : `/channels/${conversation}`;
}

export function conversationPath(conversation: { id: string; type: string; orgId?: string | null }): string {
  return numericConversationPath(conversation.type === "CHANNEL" ? "home" : "dms", conversation.id, conversation.orgId);
}

export function parseNumericConversationPath(path: string) {
  const channel = channels.exec(path);
  const match = channel ?? conversations.exec(path);
  if (!match) return null;
  const [, scope, id, panel, root] = match;
  const conversationId = decodeLinkId(id);
  const communityId = channel && scope ? decodeLinkId(scope) : null;
  const threadRoot = root ? decodeLinkId(root) : null;
  if (!conversationId || (channel && scope && !communityId) || (root && !threadRoot)) return null;
  return {
    section: channel ? "home" : (scope as (typeof sections)[number]),
    communityId,
    conversationId,
    panel: root ? "thread" : ((panel as (typeof panels)[number] | undefined) ?? null),
    threadRoot,
  } as const;
}
