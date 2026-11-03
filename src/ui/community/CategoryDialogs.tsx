import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { BellOff, Timer, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { ApiError } from "../../api/client";
import type { Category } from "../../api/communitySchemas";
import { useEngine } from "../../application/orbit";
import { createCategory, deleteCategory, renameCategory } from "../../sync/community";
import { MUTE_CHOICES } from "../../sync/communityRules";
import { Dialog } from "../components/Overlay";
const errorText = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);
/** Create category, or rename one (people who manage channels). */
export function CategoryNameDialog({ orgId, category, onClose }: { orgId: string; category: Category | null; onClose: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const [name, setName] = useState(category?.name ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError(uiText("organization.interface.give_the_category_a_name_16bb7c6"));
    setBusy(true);
    setError(null);
    try {
      if (category) await renameCategory(engine, orgId, category.id, name);
      else await createCategory(engine, orgId, name);
      onClose();
    } catch (err) {
      setError(errorText(err, uiText("organization.interface.couldn_t_save_the_category_c49543d")));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog title={category ? uiText("organization.interface.rename_category_8979931") : uiText("organization.interface.create_category_12748aa")} onClose={onClose}>
      <form className="dialog-body" onSubmit={(e) => void submit(e)} noValidate>
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        <div className="field">
          <label htmlFor="cat-name">
            <Localized k="organization.interface.category_name_73ddd93" />
          </label>
          <input
            id="cat-name"
            className="input"
            data-autofocus
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            placeholder={uiText("organization.interface.e_g_projects_03697e0")}
          />
        </div>
        {!category && (
          <p className="faint" style={{ margin: 0, fontSize: 13 }}>
            <Localized k="organization.interface.channels_you_put_in_it_can_follow_its_permissions_so_you_can_open_f8ff473" />
          </p>
        )}
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {l10n("common.actions.cancel")}
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? l10n("common.common_saving") : category ? l10n("common.actions.save") : uiText("organization.interface.create_category_12748aa")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
/** Its channels stay, without a category; the server refuses while the category's permissions decide who sees them. */
export function DeleteCategoryDialog({ orgId, category, onClose }: { orgId: string; category: Category; onClose: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
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
      setError(errorText(e, uiText("organization.interface.couldn_t_delete_the_category_9cf6074")));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog title={uiText("organization.interface.delete_value0_3d83de3", { value0: category.name })} onClose={onClose}>
      <div className="dialog-body">
        <p style={{ margin: 0 }}>
          <Localized k="organization.interface.its_channels_aren_t_deleted_they_move_out_of_the_category_if_its_c7e210a" />
        </p>
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button className="btn btn-secondary" onClick={onClose}>
            {l10n("common.actions.cancel")}
          </button>
          <button className="btn btn-danger" disabled={busy} onClick={() => void run()}>
            <Trash2 size={15} /> {busy ? uiText("organization.interface.deleting_43b5894") : uiText("organization.interface.delete_category_a91d008")}
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
  useLocaleRender();
  return (
    <Dialog title={uiText("organization.interface.mute_value0_3adce73", { value0: title })} onClose={onClose}>
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
          <Localized k="organization.interface.muted_channels_stay_quiet_and_out_of_your_counts_a_mention_of_you_f8f5411" />
        </p>
      </div>
    </Dialog>
  );
}
