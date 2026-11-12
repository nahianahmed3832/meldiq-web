import { text as uiText } from "../i18n";
import { openAttachment, saveAttachment, streamAttachment } from "./attachments";
import type { SaveItem, SaveStatus } from "./bulkSave";
import { AttachmentZip } from "./attachmentZip";
import type { Engine } from "./engine";
/**
 * Runs a bulk save (android round 7 BulkSaver): one file at a time, each downloaded through the membership-checked
 * endpoint, verified and decrypted here, then written. Where the browser lets a page write into a folder the person
 * picks (Chromium's File System Access), files go there; elsewhere a batch is handed to the browser as one ZIP so it does not require permission for repeated downloads.
 */
interface DirHandle {
  getFileHandle(
    name: string,
    o?: {
      create?: boolean;
    },
  ): Promise<{
    createWritable(): Promise<Writable>;
  }>;
}
interface Writable {
  write(data: Blob | Uint8Array): Promise<void>;
  close(): Promise<void>;
  abort(): Promise<void>;
}
/** Whether this browser can save into a folder the person picks. */
export const canPickFolder = (): boolean =>
  typeof (
    window as unknown as {
      showDirectoryPicker?: unknown;
    }
  ).showDirectoryPicker === "function";
/** Asks for a folder; null when the person closed the picker. */
export async function pickFolder(): Promise<DirHandle | null> {
  const picker = (
    window as unknown as {
      showDirectoryPicker: (o: { mode: "readwrite" }) => Promise<DirHandle>;
    }
  ).showDirectoryPicker;
  try {
    return await picker.call(window, { mode: "readwrite" });
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
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotFoundError") return candidate;
      throw error;
    }
  }
  throw new Error(uiText("workspace.interface.too_many_files_with_this_name_in_that_folder_3229f0e"));
}
async function writeInto(engine: Engine, dir: DirHandle, item: SaveItem, signal?: AbortSignal): Promise<void> {
  const file = await dir.getFileHandle(await freeName(dir, item.fileName), { create: true });
  const out = await file.createWritable();
  try {
    if (item.ref.chunk !== undefined) await streamAttachment(engine, item.ref, (plain) => out.write(new Uint8Array(plain)), signal);
    else await out.write(await openAttachment(engine, item.ref, undefined, signal));
    signal?.throwIfAborted();
    await out.close();
  } catch (e) {
    await out.abort().catch(() => undefined);
    throw e;
  }
}
/** A folder saves each verified file in turn. Browsers without folder access get one archive. */
export async function runBulkSave(
  engine: Engine,
  items: readonly SaveItem[],
  dir: DirHandle | null,
  report: (key: string, status: SaveStatus, error?: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const zip = !dir && items.length > 1 ? new AttachmentZip() : null;
  const archived: string[] = [];
  for (const item of items) {
    if (signal?.aborted) {
      report(item.key, "cancelled");
      continue;
    }
    report(item.key, "saving");
    try {
      if (dir) await writeInto(engine, dir, item, signal);
      else if (zip) {
        await zip.add(item.fileName, await openAttachment(engine, item.ref, undefined, signal), signal);
        archived.push(item.key);
      } else {
        await saveAttachment(engine, { ...item.ref, name: item.fileName }, { signal });
      }
      report(item.key, "saved");
    } catch (e) {
      const cancelled = signal?.aborted || (e instanceof DOMException && e.name === "AbortError");
      report(item.key, cancelled ? "cancelled" : "failed", cancelled ? undefined : e instanceof Error ? e.message : uiText("workspace.interface.couldn_t_save_this_file_fc73a64"));
    }
  }
  if (!zip || !archived.length) return;
  if (signal?.aborted) {
    for (const key of archived) report(key, "cancelled");
    return;
  }
  const url = URL.createObjectURL(zip.finish());
  const a = document.createElement("a");
  a.href = url;
  a.download = "Meldiq.zip";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export type { DirHandle };
