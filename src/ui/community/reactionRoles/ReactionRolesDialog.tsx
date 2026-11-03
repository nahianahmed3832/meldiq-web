import { useLocaleRender } from "../../../i18n/Localized";
import { text as uiText } from "../../../i18n";
import { Localized } from "../../../i18n/Localized";
import { useT as useLocalization } from "../../../i18n";
import { SmilePlus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError } from "../../../api/client";
import { useEngine } from "../../../application/orbit";
import { reactionRoles, removeReactionRoles, setReactionRoles } from "../../../sync/posting/api";
import { givableRoles, QUICK_ROLE_EMOJI, REACTION_ROLES_MAX, type RoleRow, rowsProblem, withEmoji } from "../../../sync/posting/reactionRoles";
import { type Role, rolesOverview } from "../../../sync/roles";
import { Dialog, Menu, useMenu } from "../../components/Overlay";
import { EmojiPicker } from "../../chat/EmojiPicker";
interface ReactionRolesDialogProps {
  orgId: string;
  channelId: string;
  messageId: string;
  onClose: () => void;
}
/** Reaction roles… (the message menu): rows of a role and its emoji, quick emoji to add one, then Save. */
export function ReactionRolesDialog({ orgId, channelId, messageId, onClose }: ReactionRolesDialogProps) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const [rows, setRows] = useState<RoleRow[] | null>(null);
  const [had, setHad] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const picker = useMenu();
  useEffect(() => {
    let live = true;
    Promise.all([reactionRoles(engine, orgId, channelId, messageId), rolesOverview(engine, orgId)])
      .then(([current, overview]) => {
        if (!live) return;
        setRows(current.reactionRoles.map((p) => ({ emoji: p.emoji, roleId: p.roleId })));
        setHad(current.reactionRoles.length > 0);
        setRoles(givableRoles(overview));
      })
      .catch((e: unknown) => live && setError(e instanceof ApiError ? e.message : uiText("organization.interface.couldn_t_load_the_reaction_roles_c8e523f")));
    return () => {
      live = false;
    };
  }, [engine, orgId, channelId, messageId]);
  const problem = rows ? rowsProblem(rows) : null;
  const save = async () => {
    if (!rows || problem) return;
    setBusy(true);
    setError(null);
    try {
      if (rows.length) await setReactionRoles(engine, orgId, channelId, messageId, rows);
      else if (had) await removeReactionRoles(engine, orgId, channelId, messageId);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : uiText("organization.interface.couldn_t_save_the_reaction_roles_210d89d"));
    } finally {
      setBusy(false);
    }
  };
  const update = (i: number, change: Partial<RoleRow>) => setRows((r) => r && r.map((x, j) => (j === i ? { ...x, ...change } : x)));
  const add = (emoji: string) => setRows((r) => r && withEmoji(r, emoji));
  const full = (rows?.length ?? 0) >= REACTION_ROLES_MAX;
  return (
    <Dialog
      title={uiText("organization.interface.reaction_roles_ef9205a")}
      subtitle={uiText("organization.interface.react_with_the_emoji_get_the_role_take_the_reaction_off_lose_it_ebdb63d")}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            {l10n("common.actions.cancel")}
          </button>
          <button className="btn btn-primary" disabled={busy || !rows || !!problem} onClick={() => void save()}>
            {busy ? l10n("common.common_saving") : l10n("common.actions.save")}
          </button>
        </>
      }
    >
      <div className="dialog-body">
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        {!rows && !error && <span className="skeleton" aria-busy="true" style={{ height: 40 }} />}
        {rows && roles.length === 0 && (
          <p className="faint">
            <Localized k="organization.interface.there_s_no_role_you_can_give_this_way_roles_with_admin_powers_nev_2b53fbb" />
          </p>
        )}
        {rows?.map((r, i) => (
          <div key={r.emoji} className="rr-row">
            <span className="rr-emoji" aria-label={uiText("calls.interface.emoji_value0_9057e7c", { value0: r.emoji })}>
              {r.emoji}
            </span>
            <select
              className="input grow"
              aria-label={uiText("organization.interface.role_for_value0_4abcf3e", { value0: r.emoji })}
              value={r.roleId}
              onChange={(e) => update(i, { roleId: e.target.value })}
            >
              <option value="">
                <Localized k="organization.interface.pick_a_role_575cd55" />
              </option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
            <button className="icon-btn" aria-label={uiText("messaging.interface.remove_value0_3028bf7", { value0: r.emoji })} onClick={() => setRows(rows.filter((_, j) => j !== i))}>
              <X size={16} />
            </button>
          </div>
        ))}
        {rows && (
          <div className="rr-add">
            <span className="faint">
              <Localized k="organization.interface.add_another_one_5ac2318" />
            </span>
            <div className="rr-quick" role="group" aria-label={uiText("organization.interface.quick_emoji_516096c")}>
              {QUICK_ROLE_EMOJI.map((e) => (
                <button
                  key={e}
                  className="icon-btn quick-emoji"
                  disabled={full || rows.some((r) => r.emoji === e)}
                  aria-label={uiText("organization.interface.add_value0_641cf33", { value0: e })}
                  onClick={() => add(e)}
                >
                  {e}
                </button>
              ))}
              <button className="btn btn-secondary btn-sm" disabled={full} onClick={(e) => picker.open(e.currentTarget)} aria-haspopup="menu">
                <Localized k="organization.interface.pick_an_emoji_b49fe80" slots={[<SmilePlus size={15} />]} />
              </button>
            </div>
          </div>
        )}
        {problem && rows && rows.length > 0 && <small className="faint">{problem}</small>}
      </div>
      {picker.anchor && (
        <Menu
          anchor={picker.anchor}
          label={uiText("organization.interface.pick_an_emoji_0df2714")}
          onClose={picker.close}
          entries={[
            {
              custom: (
                <EmojiPicker
                  onPick={(e) => {
                    picker.close();
                    add(e);
                  }}
                />
              ),
            },
          ]}
        />
      )}
    </Dialog>
  );
}
