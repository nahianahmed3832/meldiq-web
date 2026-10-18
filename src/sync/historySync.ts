import { zHistoryPage } from "../api/schemas";
import { fromB64, fromUtf8 } from "../crypto/bytes";
import { openHistoryItem } from "../crypto/history";
import { decodeHistoryRecord, mergeHistory } from "../protocol/history";
import type { EngineContext } from "./context";

const CURSOR = "history.cursor";
const PAGE = 500;

export interface RestoreResult {
  restored: number;
  unreadable: number;
}

/**
 * Downloads the account's encrypted history written since this browser last looked (docs/MESSAGE_HISTORY.md) and adds what
 * it doesn't have. A message it has changes only for a later edit or a deletion (android HistoryCodec.merge). Restored
 * messages never count as unread. This browser doesn't upload history: the phone receives a copy of everything it sends
 * or receives and uploads that.
 */
export async function restoreHistory(ctx: EngineContext, onProgress: (r: RestoreResult) => void): Promise<RestoreResult> {
  const { api, store, device } = ctx;
  const keys = device.history;
  const result: RestoreResult = { restored: 0, unreadable: 0 };
  if (!keys) return result;
  let cursor = (await store.getValue<number>(CURSOR)) ?? 0;
  const touched = new Set<string>();
  for (;;) {
    const page = await api.json("GET", `/v1/history/items?after=${cursor}&limit=${PAGE}`, zHistoryPage);
    const batch = [];
    for (const item of page.items) {
      if (!item.body) continue; // a deletion marker: the phone that wrote it already removed its copy
      let record;
      try {
        record = decodeHistoryRecord(fromUtf8(await openHistoryItem(keys, item.tag, fromB64(item.body))));
      } catch {
        result.unreadable++; // written under another identity key (a re-registered account)
        continue;
      }
      const remote = record?.message;
      if (!remote) continue;
      const merged = mergeHistory(await store.message(remote.id), remote);
      if (!merged) continue;
      batch.push(merged);
      touched.add(merged.conversationId);
    }
    if (batch.length) {
      await store.putMessages(batch);
      result.restored += batch.length;
      for (const m of batch) ctx.show(m);
    }
    cursor = page.next;
    await store.setValue(CURSOR, cursor);
    onProgress({ ...result });
    if (!page.more) break;
  }
  for (const id of touched) await ctx.refreshPreview(id);
  return result;
}
