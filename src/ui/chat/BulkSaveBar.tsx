import { Download, RotateCcw, Square, X } from "lucide-react";
import { useRef, useState } from "react";
import { useEngine } from "../../app/orbit";
import { MAX_BYTES, MAX_ITEMS, planSave, type SaveItem, saveKey, type SaveStatus, saveSummary } from "../../sync/bulkSave";
import { canPickFolder, type DirHandle, pickFolder, runBulkSave } from "../../sync/bulkSaver";
import { bytes } from "../format";
import type { GalleryItem } from "./gallery";

export const itemKey = (i: GalleryItem): string => saveKey(i.messageId, i.ref.id);

interface Run {
  items: SaveItem[];
  dir: DirHandle | null;
  status: Record<string, SaveStatus>;
  errors: Record<string, string>;
}

/** Selection and saving of several files from the media gallery (android round 7 bulk select and save). */
export function useBulkSave() {
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const toggle = (key: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  const stop = () => {
    setSelecting(false);
    setSelected(new Set());
  };
  return { selecting, start: () => setSelecting(true), stop, selected, toggle, selectAll: (keys: string[]) => setSelected(new Set(keys)) };
}

/** The bar above the gallery while selecting: count, Select all, Save, and the batch's progress with Stop and Retry. */
export function BulkSaveBar({ all, bulk }: { all: GalleryItem[]; bulk: ReturnType<typeof useBulkSave> }) {
  const engine = useEngine();
  const [run, setRun] = useState<Run | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const stopped = useRef(false);
  const summary = run ? saveSummary(run.status) : null;

  const start = async (items: SaveItem[], dir: DirHandle | null) => {
    stopped.current = false;
    const status = Object.fromEntries(items.map((i) => [i.key, "waiting" as SaveStatus]));
    setRun({ items, dir, status, errors: {} });
    await runBulkSave(
      engine,
      items,
      dir,
      (key, s, error) => setRun((r) => (r ? { ...r, status: { ...r.status, [key]: s }, errors: error ? { ...r.errors, [key]: error } : r.errors } : r)),
      () => stopped.current,
    );
  };

  const save = async () => {
    setProblem(null);
    const plan = planSave(all.filter((i) => bulk.selected.has(itemKey(i))));
    if (plan.kind === "empty") return setProblem("Select the files to save first.");
    if (plan.kind === "tooMany") return setProblem(`That's ${plan.count} files. Save at most ${MAX_ITEMS} at a time, in parts.`);
    if (plan.kind === "tooLarge") return setProblem(`That's ${bytes(plan.bytes)}. Save at most ${bytes(MAX_BYTES)} at a time, in parts.`);
    let dir: DirHandle | null = null;
    if (canPickFolder()) {
      try {
        dir = await pickFolder();
      } catch {
        return setProblem("That folder can't be written to. Choose another.");
      }
      if (!dir) return; // the picker was closed
    }
    await start(plan.items, dir);
  };

  const retry = () => {
    if (!run) return;
    const again = run.items.filter((i) => run.status[i.key] === "failed" || run.status[i.key] === "cancelled");
    void start(again, run.dir);
  };

  if (run && summary) {
    const firstError = Object.values(run.errors)[0];
    return (
      <div className="bulk-bar" role="status" aria-live="polite">
        <span className="grow">
          {summary.running ? `Saving ${summary.saved + summary.failed + 1} of ${summary.total}…` : `Saved ${summary.saved} of ${summary.total}`}
          {summary.failed ? ` · ${summary.failed} failed` : ""}
          {summary.cancelled ? ` · ${summary.cancelled} stopped` : ""}
          {!summary.running && firstError && <small className="faint"> · {firstError}</small>}
        </span>
        {summary.running ? (
          <button className="btn btn-secondary btn-sm" onClick={() => (stopped.current = true)}>
            <Square size={13} /> Stop
          </button>
        ) : (
          <>
            {summary.retryable > 0 && (
              <button className="btn btn-secondary btn-sm" onClick={retry}>
                <RotateCcw size={13} /> Retry {summary.retryable}
              </button>
            )}
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setRun(null);
                bulk.stop();
              }}
            >
              Done
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="bulk-bar">
      <span className="grow">
        {bulk.selected.size === 1 ? "1 file selected" : `${bulk.selected.size} files selected`}
        {problem && <small className="danger-text"> · {problem}</small>}
      </span>
      <button className="btn btn-ghost btn-sm" onClick={() => bulk.selectAll(all.map(itemKey))}>
        Select all
      </button>
      <button className="btn btn-primary btn-sm" onClick={() => void save()} disabled={bulk.selected.size === 0}>
        <Download size={14} /> {canPickFolder() ? "Save to a folder…" : "Download"}
      </button>
      <button className="icon-btn" onClick={bulk.stop} aria-label="Stop selecting">
        <X size={16} />
      </button>
    </div>
  );
}
