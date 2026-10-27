/**
 * Folders on the rail (2026-10-28, API 0.50.0 keeps them in the personal preferences, `railFolders`): communities
 * grouped under one tile, opened to show them in a tinted column. Where a folder sits is where its first community sits
 * in the rail order, so the order stays one flat list (`railOrder`) that older apps keep understanding. Dragging decides
 * everything here: reorder, drop onto a community to make a folder, onto a folder to add to it, out of one to take out.
 * Pure, so the rules are tested without a browser.
 */
export interface RailFolder {
  id: string;
  name: string;
  color: string | null;
  orgIds: string[];
}

export type RailItem = { kind: "org"; id: string } | { kind: "folder"; folder: RailFolder };

export interface RailState {
  /** Every community, in rail order (folder members included, in their folder's order). */
  order: string[];
  folders: RailFolder[];
}

/** What's dragged and where it's dropped: before or after an item, or into it (a community or a folder). */
export type DragRef = { kind: "org"; id: string } | { kind: "folder"; id: string };
export type DropZone = "before" | "after" | "into";

/** Folders cleaned against the communities that exist: members only once, unknown ones dropped, empty folders gone. */
export function liveFolders(folders: readonly RailFolder[], orgIds: readonly string[]): RailFolder[] {
  const exists = new Set(orgIds);
  const placed = new Set<string>();
  return folders.flatMap((f) => {
    const members = f.orgIds.filter((id) => exists.has(id) && !placed.has(id) && (placed.add(id), true));
    return members.length ? [{ ...f, orgIds: members }] : [];
  });
}

/** The rail's items in order: a folder where its first community would be, its other members inside it. */
export function railItems(order: readonly string[], folders: readonly RailFolder[]): RailItem[] {
  const live = liveFolders(folders, order);
  const folderOf = new Map(live.flatMap((f) => f.orgIds.map((id) => [id, f] as const)));
  const shown = new Set<string>();
  const out: RailItem[] = [];
  for (const id of order) {
    const f = folderOf.get(id);
    if (!f) out.push({ kind: "org", id });
    else if (!shown.has(f.id)) {
      shown.add(f.id);
      out.push({ kind: "folder", folder: f });
    }
  }
  return out;
}

/** The flat order the rail shows: top-level items in order, each folder's members where the folder is. */
function flatten(items: readonly RailItem[]): string[] {
  return items.flatMap((it) => (it.kind === "org" ? [it.id] : it.folder.orgIds));
}

const newId = () => `f_${Math.random().toString(36).slice(2, 10)}`;

/**
 * The rail after dropping [drag] on [target] at [zone]. [target] is an item as shown: a top-level community or folder,
 * or (inside an open folder) a member, given with [targetFolder]. Answers the state unchanged for drops that mean
 * nothing (onto itself, a folder into a folder).
 */
export function dropOnRail(state: RailState, drag: DragRef, target: DragRef, zone: DropZone, targetFolder: string | null = null): RailState {
  const folders = liveFolders(state.folders, state.order);
  if (drag.kind === target.kind && drag.id === target.id) return state;
  const items = railItems(state.order, folders);
  if (drag.kind === "folder") {
    // A folder moves as a block, beside top-level items only.
    if (zone === "into" || targetFolder) return state;
    const moving = items.find((it) => it.kind === "folder" && it.folder.id === drag.id);
    if (!moving) return state;
    const rest = items.filter((it) => it !== moving);
    const at = rest.findIndex((it) => (it.kind === "org" ? target.kind === "org" && it.id === target.id : target.kind === "folder" && it.folder.id === target.id));
    if (at < 0) return state;
    rest.splice(zone === "after" ? at + 1 : at, 0, moving);
    return { order: flatten(rest), folders };
  }
  // A community: first taken out of wherever it was.
  const id = drag.id;
  let nextFolders = folders.map((f) => ({ ...f, orgIds: f.orgIds.filter((x) => x !== id) }));
  if (target.kind === "folder" && zone === "into") {
    nextFolders = nextFolders.map((f) => (f.id === target.id ? { ...f, orgIds: [...f.orgIds, id] } : f));
  } else if (target.kind === "org" && targetFolder) {
    // Among an open folder's members: placed in that folder, before or after the member (into it means after).
    nextFolders = nextFolders.map((f) => {
      if (f.id !== targetFolder) return f;
      const at = f.orgIds.indexOf(target.id);
      const list = [...f.orgIds];
      list.splice(at < 0 ? list.length : zone === "before" ? at : at + 1, 0, id);
      return { ...f, orgIds: list };
    });
  } else if (target.kind === "org" && zone === "into") {
    // Onto a community at the top level: the two make a new folder where the target was.
    const created: RailFolder = { id: newId(), name: "", color: null, orgIds: [target.id, id] };
    nextFolders = [...nextFolders.filter((f) => !f.orgIds.includes(target.id)), created];
  }
  nextFolders = nextFolders.filter((f) => f.orgIds.length > 0);
  // The new top-level order: the dragged community, if not in a folder now, beside its target.
  const before = railItems(
    state.order.filter((x) => x !== id),
    nextFolders,
  );
  const inFolder = nextFolders.some((f) => f.orgIds.includes(id));
  let top: RailItem[] = before;
  if (!inFolder) {
    const at = before.findIndex((it) => (it.kind === "org" ? target.kind === "org" && it.id === target.id : target.kind === "folder" && it.folder.id === target.id));
    const fromFolderAt = targetFolder ? before.findIndex((it) => it.kind === "folder" && it.folder.id === targetFolder) : -1;
    const anchor = at >= 0 ? at : fromFolderAt;
    top = [...before];
    if (anchor < 0) top.push({ kind: "org", id });
    else top.splice(zone === "before" ? anchor : anchor + 1, 0, { kind: "org", id });
  } else if (target.kind === "org" && zone === "into" && !targetFolder) {
    // The new folder takes the target's place.
    const created = nextFolders[nextFolders.length - 1];
    top = before.map((it) => (it.kind === "org" && it.id === target.id ? { kind: "folder", folder: created } : it));
  }
  // Folders' members come from nextFolders, so order and folders agree.
  const byId = new Map(nextFolders.map((f) => [f.id, f]));
  const order = top.flatMap((it) => (it.kind === "org" ? [it.id] : (byId.get(it.folder.id)?.orgIds ?? it.folder.orgIds)));
  return { order: [...new Set([...order, ...state.order.filter((x) => !order.includes(x))])], folders: nextFolders };
}

/** A folder renamed, recoloured, or taken apart (its communities stay where it was). */
export function renameFolder(state: RailState, id: string, name: string, color: string | null): RailState {
  return { ...state, folders: state.folders.map((f) => (f.id === id ? { ...f, name: name.trim().slice(0, 40), color } : f)) };
}

export function ungroupFolder(state: RailState, id: string): RailState {
  return { ...state, folders: state.folders.filter((f) => f.id !== id) };
}
