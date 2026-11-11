import { useId, useState } from "react";
import { useT } from "../../i18n";
import type { CollectionOp, SavedCollection } from "../../sync/savedCollections";
import { Dialog } from "../components/Overlay";

export function CollectionEditor({
  collection,
  busy,
  error,
  save,
  close,
}: {
  collection?: SavedCollection;
  busy: boolean;
  error: string | null;
  save: (op: CollectionOp) => Promise<boolean>;
  close: () => void;
}) {
  const t = useT();
  const [name, setName] = useState(collection?.name ?? "");
  const [id] = useState(() => collection?.id ?? crypto.randomUUID());
  const errorId = useId();
  return (
    <Dialog title={t(collection ? "workspace.experience.renameCollection" : "workspace.experience.newCollection")} onClose={close}>
      <form
        className="dialog-body experience-panel collection-editor"
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy && name.trim())
            void save({ op: collection ? "rename" : "create", id, name: name.trim() }).then((ok) => {
              if (ok) close();
            });
        }}
      >
        <label className="field">
          {t("workspace.experience.collectionName")}
          <input className="input" data-autofocus required maxLength={60} value={name} aria-describedby={error ? errorId : undefined} onChange={(event) => setName(event.target.value)} />
        </label>
        {error && (
          <p id={errorId} className="banner danger" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn-primary" disabled={busy || !name.trim()}>
          {t(busy ? "workspace.experience.savingCollection" : "common.actions.save")}
        </button>
      </form>
    </Dialog>
  );
}
