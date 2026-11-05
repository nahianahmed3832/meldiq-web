import { text as uiText } from "../i18n";
import type { RichContent, StoredMessage } from "../model/types";
import { openAttachment, type PickedFile, uploadFiles } from "./attachments";
import type { Engine } from "./engine";
/** At most this many conversations at once (android Forward To). */
export const MAX_FORWARD_TARGETS = 5;
/** The optional message sent with a forward. */
export const MAX_FORWARD_NOTE = 2000;
/**
 * Where a message forwarded out of a community channel came from (android ForwardOrigin): the community's name, when
 * it was sent, and its ids, so people in that channel can open it. A DM's or group's origin is never sent.
 */
export function originOf(
  m: Pick<StoredMessage, "id" | "conversationId" | "sentAt" | "sortTs">,
  source:
    | {
        type: string;
        orgId: string | null;
      }
    | undefined,
  communityName: string | null,
): RichContent["origin"] | undefined {
  if (!source || source.type !== "CHANNEL" || !source.orgId || !communityName) return undefined;
  return { place: communityName.trim().slice(0, 60), at: m.sentAt || m.sortTs || null, conversationId: m.conversationId, messageId: m.id };
}
/**
 * Forwards a message (docs/RICH_MESSAGES.md › Forwarding; android Forward To, 2026-10-23): to up to five conversations,
 * each a new message marked "Forwarded", without naming the original sender or carrying its mentions, and the optional
 * [note] sent after it. Files are decrypted here once and encrypted again with new keys for each destination, because
 * each conversation's files can only be fetched by its members. Voice stays voice. Returns what it sent where;
 * the first failure is thrown only when none was reached.
 */
export async function forwardMessage(
  engine: Engine,
  m: StoredMessage,
  targets: string | readonly string[],
  note = "",
): Promise<
  {
    conversationId: string;
    messageId: string;
  }[]
> {
  if (m.kind !== "text" || m.deleted) throw new Error(uiText("workspace.interface.this_message_can_t_be_forwarded_01073a4"));
  const to = (typeof targets === "string" ? [targets] : [...new Set(targets)]).slice(0, MAX_FORWARD_TARGETS);
  const blobs = await Promise.all(m.attachments.map((a) => openAttachment(engine, a)));
  const files: PickedFile[] = m.attachments.map((a, i) => ({
    name: a.name,
    type: a.mime,
    size: a.size,
    source: blobs[i],
    bytes: async () => new Uint8Array(await blobs[i].arrayBuffer()),
    ...(a.voice ? { voiceDurationMs: a.durationMs ?? 0 } : {}),
  }));
  const st = engine.state.get();
  const source = st.conversations[m.conversationId];
  const origin = originOf(m, source, st.orgs.find((o) => o.id === source?.orgId)?.name ?? null);
  // A forwarded poll starts fresh: its votes and closing belong to the conversation it came from.
  const { botComponents: _controls, ...forwardable } = m.rich ?? {};
  const base: RichContent | null = m.rich ? (m.rich.poll ? { ...forwardable, votes: undefined, votePrivacy: undefined, pollClosed: undefined } : forwardable) : null;
  const rich: RichContent | null = origin ? { ...(base ?? {}), origin } : base ? { ...base, origin: undefined } : null;
  const text = note.trim().slice(0, MAX_FORWARD_NOTE);
  const done: {
    conversationId: string;
    messageId: string;
  }[] = [];
  let failure: unknown = null;
  for (const id of to) {
    try {
      const attachments = files.length ? await uploadFiles(engine, id, files) : undefined;
      const messageId = await engine.sendText(id, m.text, { attachments, rich: rich ?? undefined, forwarded: true });
      if (text) await engine.sendText(id, text);
      done.push({ conversationId: id, messageId });
    } catch (e) {
      failure ??= e;
    }
  }
  if (failure && done.length === 0) throw failure;
  return done;
}
