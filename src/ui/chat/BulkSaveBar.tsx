import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { RotateCcw, Square, X } from "lucide-react";
import { Icon } from "../icons/Icon";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEngine } from "../../application/orbit";
import { MAX_ITEMS, planSave, type SaveItem, saveKey, type SaveStatus, saveSummary } from "../../sync/bulkSave";
import { canPickFolder, type DirHandle, pickFolder, runBulkSave } from "../../sync/bulkSaver";
import { bytes } from "../format";
type FileChoice = Pick<SaveItem, "messageId" | "ref">;
export const itemKey = (i: FileChoice): string => saveKey(i.messageId, i.ref.id);
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
  const toggle = useCallback(
    (key: string) =>
      setSelected((cur) => {
        const next = new Set(cur);
        if (!next.delete(key)) next.add(key);
        return next;
      }),
    [],
  );
  const stop = useCallback(() => {
    setSelecting(false);
    setSelected(new Set());
  }, []);
  const include = useCallback((keys: string[]) => {
    setSelecting(true);
    setSelected((cur) => new Set([...cur, ...keys]));
  }, []);
  return useMemo(
    () => ({
      include,
      selecting,
      start: () => setSelecting(true),
      stop,
      selected,
      toggle,
      selectAll: (keys: string[]) => setSelected(new Set(keys)),
    }),
    [include, selecting, stop, selected, toggle],
  );
}
/** The bar above the gallery while selecting: count, Select all, Save, and the batch's progress with Stop and Retry. */
export function BulkSaveBar({ all, bulk, chat = false }: { all: FileChoice[]; bulk: ReturnType<typeof useBulkSave>; chat?: boolean }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const [run, setRun] = useState<Run | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const active = useRef<AbortController | null>(null);
  const choosing = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      active.current?.abort();
    };
  }, []);
  const selected = all.filter((i) => bulk.selected.has(itemKey(i)));
  const summary = run ? saveSummary(run.status) : null;
  const start = async (items: SaveItem[], dir: DirHandle | null) => {
    if (!mounted.current || active.current) return;
    const controller = new AbortController();
    active.current = controller;
    const status = Object.fromEntries(items.map((i) => [i.key, "waiting" as SaveStatus]));
    setRun({ items, dir, status, errors: {} });
    try {
      await runBulkSave(
        engine,
        items,
        dir,
        (key, s, error) => setRun((r) => (r ? { ...r, status: { ...r.status, [key]: s }, errors: error ? { ...r.errors, [key]: error } : r.errors } : r)),
        controller.signal,
      );
    } finally {
      active.current = null;
    }
  };
  const save = async () => {
    setProblem(null);
    if (choosing.current || active.current) return;
    const plan = planSave(selected, undefined, canPickFolder());
    if (plan.kind === "empty") return setProblem(uiText("messaging.interface.select_the_files_to_save_first_315164c"));
    if (plan.kind === "tooMany") return setProblem(uiText("messaging.interface.that_s_value0_files_save_at_most_value1_at_a_time_in_parts_8c72825", { value0: plan.count, value1: MAX_ITEMS }));
    if (plan.kind === "tooLarge")
      return setProblem(uiText("messaging.interface.that_s_value0_save_at_most_value1_at_a_time_in_parts_437c718", { value0: bytes(plan.bytes), value1: bytes(plan.limit) }));
    let dir: DirHandle | null = null;
    if (canPickFolder() && (!chat || plan.items.length > 1)) {
      choosing.current = true;
      try {
        dir = await pickFolder();
      } catch {
        return setProblem(uiText("messaging.interface.that_folder_can_t_be_written_to_choose_another_5dc0a79"));
      } finally {
        choosing.current = false;
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
          {summary.running
            ? uiText("messaging.interface.saving_value0_of_value1_fc994f8", { value0: summary.saved + summary.failed + 1, value1: summary.total })
            : uiText("messaging.interface.saved_value0_of_value1_ebd1e37", { value0: summary.saved, value1: summary.total })}
          {summary.failed ? uiText("messaging.interface.value0_failed_07c826a", { value0: summary.failed }) : ""}
          {summary.cancelled ? uiText("messaging.interface.value0_stopped_17663b4", { value0: summary.cancelled }) : ""}
          {!summary.running && firstError && <small className="faint"> · {firstError}</small>}
        </span>
        {summary.running ? (
          <button className="btn btn-secondary btn-sm" onClick={() => active.current?.abort()}>
            <Localized k="messaging.interface.stop_bf10943" slots={[<Square size={13} />]} />
          </button>
        ) : (
          <>
            {summary.retryable > 0 && (
              <button className="btn btn-secondary btn-sm" onClick={retry}>
                <Localized k="messaging.interface.retry_54eb251" slots={[<RotateCcw size={13} />, summary.retryable]} />
              </button>
            )}
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setRun(null);
                bulk.stop();
              }}
            >
              {l10n("common.actions.done")}
            </button>
          </>
        )}
      </div>
    );
  }
  return (
    <div className="bulk-bar">
      <span className="grow">
        {selected.length === 1 ? uiText("messaging.interface.1_file_selected_f462886") : uiText("messaging.interface.value0_files_selected_3f10f27", { value0: selected.length })}
        {problem && <small className="danger-text"> · {problem}</small>}
      </span>
      {!chat && (
        <button className="btn btn-ghost btn-sm" onClick={() => bulk.selectAll(all.map(itemKey))}>
          <Localized k="messaging.interface.select_all_1fc9a38" />
        </button>
      )}
      <button className="btn btn-primary btn-sm" onClick={() => void save()} disabled={selected.length === 0}>
        <Icon name="files.download" size={16} /> {!chat && canPickFolder() ? uiText("messaging.interface.save_to_a_folder_7bf4547") : l10n("common.actions.download")}
      </button>
      <button className="icon-btn" onClick={bulk.stop} aria-label={uiText("messaging.interface.stop_selecting_5a7244d")}>
        <X size={16} />
      </button>
    </div>
  );
}
