import { openAttachment, streamAttachment } from "./attachments";
import type { SaveItem, SaveStatus } from "./bulkSave";
import type { Engine } from "./engine";

/**
 * Runs a bulk save (android round 7 BulkSaver): one file at a time, each downloaded through the membership-checked
 * endpoint, verified and decrypted here, then written. Where the browser lets a page write into a folder the person
 * picks (Chromium's File System Access), files go there; elsewhere each one is handed to the browser's downloads.
 */
interface DirHandle {
  getFileHandle(name: string, o?: { create?: boolean }): Promise<{ createWritable(): Promise<Writable> }>;
}
interface Writable {
  write(data: Blob | Uint8Array): Promise<void>;
  close(): Promise<void>;
  abort(): Promise<void>;
}

/** Whether this browser can save into a folder the person picks. */
export const canPickFolder = (): boolean => typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === "function";

/** Asks for a folder; null when the person closed the picker. */
export async function pickFolder(): Promise<DirHandle | null> {
  const picker = (window as unknown as { showDirectoryPicker: (o: { mode: "readwrite" }) => Promise<DirHandle> }).showDirectoryPicker;
  try {
    return await picker({ mode: "readwrite" });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return null;
    throw e;
  }
}

/** A name not yet used in [dir]: files already there are never overwritten ("a.jpg" → "a (1).jpg"). */
async function freeName(dir: DirHandle, name: string): Promise<string> {
  const dot = name.lastIndexOf(".") > 0 ? name.lastIndexOf(".") : name.length;
  for (let n = 0; n < 1000; n++) {
    const candidate = n === 0 ? name : `${name.slice(0, dot)} (${n})${name.slice(dot)}`;
    try {
      await dir.getFileHandle(candidate);
    } catch {
      return candidate; // NotFoundError: free
    }
  }
  throw new Error("Too many files with this name in that folder.");
}

async function writeInto(engine: Engine, dir: DirHandle, item: SaveItem): Promise<void> {
  const file = await dir.getFileHandle(await freeName(dir, item.fileName), { create: true });
  const out = await file.createWritable();
  try {
    if (item.ref.chunk !== undefined) await streamAttachment(engine, item.ref, (plain) => out.write(new Uint8Array(plain)));
    else await out.write(await openAttachment(engine, item.ref));
    await out.close();
  } catch (e) {
    await out.abort().catch(() => undefined);
    throw e;
  }
}

async function download(engine: Engine, item: SaveItem): Promise<void> {
  const url = URL.createObjectURL(await openAttachment(engine, item.ref));
  const a = document.createElement("a");
  a.href = url;
  a.download = item.fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/**
 * Saves [items] into [dir] (or as downloads when null), reporting each file's status; [stopped] ends the batch before
 * the next file, leaving the rest "cancelled" for Retry.
 */
export async function runBulkSave(
  engine: Engine,
  items: readonly SaveItem[],
  dir: DirHandle | null,
  report: (key: string, status: SaveStatus, error?: string) => void,
  stopped: () => boolean,
): Promise<void> {
  for (const item of items) {
    if (stopped()) {
      report(item.key, "cancelled");
      continue;
    }
    report(item.key, "saving");
    try {
      await (dir ? writeInto(engine, dir, item) : download(engine, item));
      report(item.key, "saved");
    } catch (e) {
      report(item.key, "failed", e instanceof Error ? e.message : "Couldn't save this file.");
    }
  }
}

export type { DirHandle };
