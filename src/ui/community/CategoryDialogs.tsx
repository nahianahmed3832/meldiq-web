import { BellOff, Timer, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { ApiError } from "../../api/client";
import type { Category } from "../../api/communitySchemas";
import { useEngine } from "../../app/orbit";
import { createCategory, deleteCategory, renameCategory } from "../../sync/community";
import { MUTE_CHOICES } from "../../sync/communityRules";
import { Dialog } from "../components/Overlay";

const errorText = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

/** Create category, or rename one (people who manage channels). */
export function CategoryNameDialog({ orgId, category, onClose }: { orgId: string; category: Category | null; onClose: () => void }) {
  const engine = useEngine();
  const [name, setName] = useState(category?.name ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("Give the category a name.");
    setBusy(true);
    setError(null);
    try {
      if (category) await renameCategory(engine, orgId, category.id, name);
      else await createCategory(engine, orgId, name);
      onClose();
    } catch (err) {
      setError(errorText(err, "Couldn't save the category."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog title={category ? "Rename category" : "Create category"} onClose={onClose}>
      <form className="dialog-body" onSubmit={(e) => void submit(e)} noValidate>
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        <div className="field">
          <label htmlFor="cat-name">Category name</label>
          <input id="cat-name" className="input" data-autofocus value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="e.g. Projects" />
        </div>
        {!category && (
          <p className="faint" style={{ margin: 0, fontSize: 13 }}>
            Channels you put in it can follow its permissions, so you can open or close a whole group at once.
          </p>
        )}
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : category ? "Save" : "Create category"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/** Its channels stay, without a category; the server refuses while the category's permissions decide who sees them. */
export function DeleteCategoryDialog({ orgId, category, onClose }: { orgId: string; category: Category; onClose: () => void }) {
  const engine = useEngine();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteCategory(engine, orgId, category.id);
      onClose();
    } catch (e) {
      setError(errorText(e, "Couldn't delete the category."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog title={`Delete ${category.name}?`} onClose={onClose}>
      <div className="dialog-body">
        <p style={{ margin: 0 }}>Its channels aren't deleted: they move out of the category. If its permissions decide who sees them, move them out first.</p>
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-danger" disabled={busy} onClick={() => void run()}>
            <Trash2 size={15} /> {busy ? "Deleting…" : "Delete category"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

/**
 * Mute for (batch B3): 15 minutes to 24 hours, or until turned back on. [timed] false (a server without
 * `channel-preferences`) offers only the mute without an end. [onPick] gets the duration in ms, or null.
 */
export function MuteForDialog({ title, timed, onPick, onClose }: { title: string; timed: boolean; onPick: (ms: number | null) => void; onClose: () => void }) {
  return (
    <Dialog title={`Mute ${title}`} onClose={onClose}>
      <div className="dialog-body" style={{ gap: 2 }}>
        {MUTE_CHOICES.filter((c) => timed || c.ms === null).map((c) => (
          <button
            key={c.label}
            className="list-row"
            onClick={() => {
              onPick(c.ms);
              onClose();
            }}
          >
            <span className="glyph">{c.ms === null ? <BellOff size={16} /> : <Timer size={16} />}</span>
            <span className="lines">
              <span>{c.label}</span>
            </span>
          </button>
        ))}
        <p className="faint" style={{ margin: "6px 0 0", fontSize: 12.5 }}>
          Muted channels stay quiet and out of your counts. A mention of you by name still notifies you.
        </p>
      </div>
    </Dialog>
  );
}
