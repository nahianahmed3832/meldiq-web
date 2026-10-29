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
      .catch((e: unknown) => live && setError(e instanceof ApiError ? e.message : "Couldn't load the reaction roles."));
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
      setError(e instanceof ApiError ? e.message : "Couldn't save the reaction roles.");
    } finally {
      setBusy(false);
    }
  };
  const update = (i: number, change: Partial<RoleRow>) => setRows((r) => r && r.map((x, j) => (j === i ? { ...x, ...change } : x)));
  const add = (emoji: string) => setRows((r) => r && withEmoji(r, emoji));
  const full = (rows?.length ?? 0) >= REACTION_ROLES_MAX;

  return (
    <Dialog
      title="Reaction roles"
      subtitle="React with the emoji, get the role. Take the reaction off, lose it."
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy || !rows || !!problem} onClick={() => void save()}>
            {busy ? "Saving…" : "Save"}
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
        {rows && roles.length === 0 && <p className="faint">There's no role you can give this way. Roles with admin powers never can.</p>}
        {rows?.map((r, i) => (
          <div key={r.emoji} className="rr-row">
            <span className="rr-emoji" aria-label={`Emoji ${r.emoji}`}>
              {r.emoji}
            </span>
            <select className="input grow" aria-label={`Role for ${r.emoji}`} value={r.roleId} onChange={(e) => update(i, { roleId: e.target.value })}>
              <option value="">Pick a role</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
            <button className="icon-btn" aria-label={`Remove ${r.emoji}`} onClick={() => setRows(rows.filter((_, j) => j !== i))}>
              <X size={16} />
            </button>
          </div>
        ))}
        {rows && (
          <div className="rr-add">
            <span className="faint">Add another one:</span>
            <div className="rr-quick" role="group" aria-label="Quick emoji">
              {QUICK_ROLE_EMOJI.map((e) => (
                <button key={e} className="icon-btn quick-emoji" disabled={full || rows.some((r) => r.emoji === e)} aria-label={`Add ${e}`} onClick={() => add(e)}>
                  {e}
                </button>
              ))}
              <button className="btn btn-secondary btn-sm" disabled={full} onClick={(e) => picker.open(e.currentTarget)} aria-haspopup="menu">
                <SmilePlus size={15} /> Pick an emoji
              </button>
            </div>
          </div>
        )}
        {problem && rows && rows.length > 0 && <small className="faint">{problem}</small>}
      </div>
      {picker.anchor && (
        <Menu
          anchor={picker.anchor}
          label="Pick an emoji"
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
