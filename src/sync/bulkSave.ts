import { type AttachmentRef, safeFileName } from "../protocol/payload";

/**
 * Saving many files at once (android round 7 BulkSave, server docs ATTACHMENTS.md › Saving several files): photos,
 * videos and files picked across messages and albums, saved with one action. Files are end-to-end encrypted, so the
 * server can't build an archive: each is downloaded through the same membership-checked endpoint as a single click,
 * verified and decrypted here, then written, one at a time.
 */
export const MAX_ITEMS = 200;
export const MAX_BYTES = 4 * 1024 * 1024 * 1024;

export interface SaveItem {
  key: string;
  messageId: string;
  ref: AttachmentRef;
  fileName: string;
}

export type SavePlan = { kind: "empty" } | { kind: "ready"; items: SaveItem[] } | { kind: "tooMany"; count: number; limit: number } | { kind: "tooLarge"; bytes: number; limit: number };

export type SaveStatus = "waiting" | "saving" | "saved" | "failed" | "cancelled";

export const saveKey = (messageId: string, refId: string): string => `${messageId}/${refId}`;

/**
 * A batch: each picked file once, without the excluded ones; refused (not cut) over the limits; names that would clash
 * in one folder get " (1)", " (2)" before the extension.
 */
export function planSave(picked: readonly { messageId: string; ref: AttachmentRef }[], excluded: ReadonlySet<string> = new Set()): SavePlan {
  const seen = new Set<string>();
  const unique = picked.filter((p) => {
    const k = saveKey(p.messageId, p.ref.id);
    if (seen.has(k) || excluded.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (unique.length === 0) return { kind: "empty" };
  if (unique.length > MAX_ITEMS) return { kind: "tooMany", count: unique.length, limit: MAX_ITEMS };
  const bytes = unique.reduce((n, p) => n + Math.max(0, p.ref.size), 0);
  if (bytes > MAX_BYTES) return { kind: "tooLarge", bytes, limit: MAX_BYTES };
  const names = uniqueNames(unique.map((p) => safeFileName(p.ref.name)));
  return { kind: "ready", items: unique.map((p, i) => ({ key: saveKey(p.messageId, p.ref.id), messageId: p.messageId, ref: p.ref, fileName: names[i] })) };
}

/** Case-insensitive de-duplication, the way most file systems compare names. */
export function uniqueNames(names: readonly string[]): string[] {
  const taken = new Set<string>();
  return names.map((name) => {
    const dot = name.lastIndexOf(".") > 0 ? name.lastIndexOf(".") : name.length;
    const stem = name.slice(0, dot);
    const ext = name.slice(dot);
    let candidate = name;
    for (let n = 1; taken.has(candidate.toLowerCase()); n++) candidate = `${stem} (${n})${ext}`;
    taken.add(candidate.toLowerCase());
    return candidate;
  });
}

export interface SaveSummary {
  total: number;
  saved: number;
  failed: number;
  cancelled: number;
  running: boolean;
  finished: boolean;
  retryable: number;
}

export function saveSummary(status: Readonly<Record<string, SaveStatus>>): SaveSummary {
  const v = Object.values(status);
  const count = (s: SaveStatus) => v.filter((x) => x === s).length;
  const saved = count("saved");
  const failed = count("failed");
  const cancelled = count("cancelled");
  const running = v.some((x) => x === "waiting" || x === "saving");
  return { total: v.length, saved, failed, cancelled, running, finished: !running && saved + failed + cancelled === v.length, retryable: failed + cancelled };
}
