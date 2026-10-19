import type { StoredMessage } from "../model/types";
import { openAttachment, type PickedFile, uploadFiles } from "./attachments";
import type { Engine } from "./engine";

/**
 * Forwards a message to another conversation (docs/RICH_MESSAGES.md › Forwarding): a new message marked "Forwarded",
 * without naming the original sender or carrying its mentions. Files are decrypted here and encrypted again with new keys
 * for the destination, because each conversation's files can only be fetched by its members. Voice stays voice.
 */
export async function forwardMessage(engine: Engine, m: StoredMessage, toConversationId: string): Promise<string> {
  if (m.kind !== "text" || m.deleted) throw new Error("This message can't be forwarded.");
  const files: PickedFile[] = await Promise.all(
    m.attachments.map(async (a) => {
      const blob = await openAttachment(engine, a);
      return {
        name: a.name,
        type: a.mime,
        size: a.size,
        bytes: async () => new Uint8Array(await blob.arrayBuffer()),
        ...(a.voice ? { voiceDurationMs: a.durationMs ?? 0 } : {}),
      };
    }),
  );
  const attachments = files.length ? await uploadFiles(engine, toConversationId, files) : undefined;
  return engine.sendText(toConversationId, m.text, { attachments, rich: m.rich, forwarded: true });
}
