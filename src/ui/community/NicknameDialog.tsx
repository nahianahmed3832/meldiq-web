import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { type FormEvent, useEffect, useState } from "react";
import { ApiError } from "../../api/client";
import { useEngine } from "../../application/orbit";
import { cleanNickname, NICKNAME_MAX, nicknameProblem, setCommunityNickname } from "../../sync/communityParity";
import { directory } from "../../sync/workspaces";
import { Dialog } from "../components/Overlay";
import { forgetCommunityMembers } from "./useCommunityMembers";
interface NicknameDialogProps {
  orgId: string;
  /** Whose nickname: your own (Change nickname in the community menu) or a member's (moderators, from their row). */
  userId: string;
  /** Their name, when it's someone else's nickname. */
  name?: string;
  /** Their nickname now, when known; otherwise it's looked up. */
  current?: string | null;
  onClose: () => void;
  onSaved?: () => void;
}
/** Change nickname: a name shown only in this community; empty goes back to the username (community parity A1). */
export function NicknameDialog({ orgId, userId, name, current, onClose, onSaved }: NicknameDialogProps) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const own = userId === engine.device.userId;
  const [text, setText] = useState(current ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (current !== undefined) return;
    let alive = true;
    // The directory carries everyone's nickname; without access to it the field starts empty.
    directory(engine, orgId)
      .then((people) => alive && setText((t) => t || (people.find((p) => p.id === userId)?.nickname ?? "")))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [engine, orgId, userId, current]);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const problem = nicknameProblem(text);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      await setCommunityNickname(engine, orgId, userId, cleanNickname(text));
      forgetCommunityMembers(orgId);
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : uiText("organization.interface.couldn_t_save_the_nickname_9584a65"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      title={
        own
          ? uiText("organization.interface.change_nickname_27297a1")
          : uiText("organization.interface.nickname_for_value0_fb4bcdf", { value0: name ?? uiText("organization.interface.this_member_4cc7045") })
      }
      onClose={onClose}
    >
      <form className="dialog-body" onSubmit={(e) => void submit(e)} noValidate>
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        <div className="field">
          <label htmlFor="nick-name">
            <Localized k="organization.interface.nickname_d720f61" />
          </label>
          <input id="nick-name" className="input" data-autofocus value={text} maxLength={NICKNAME_MAX} onChange={(e) => setText(e.target.value)} />
        </div>
        <p className="faint" style={{ margin: 0, fontSize: 13 }}>
          {own
            ? uiText("organization.interface.people_see_it_only_in_this_community_leave_it_empty_to_go_by_your_5af8c04")
            : uiText("organization.interface.shown_only_in_this_community_leave_it_empty_to_show_their_usernam_e754a4d")}
        </p>
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {l10n("common.actions.cancel")}
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? l10n("common.common_saving") : l10n("common.actions.save")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
