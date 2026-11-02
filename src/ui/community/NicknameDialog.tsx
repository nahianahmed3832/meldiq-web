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
      setError(err instanceof ApiError || err instanceof Error ? err.message : "Couldn't save the nickname.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog title={own ? "Change nickname" : `Nickname for ${name ?? "this member"}`} onClose={onClose}>
      <form className="dialog-body" onSubmit={(e) => void submit(e)} noValidate>
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        <div className="field">
          <label htmlFor="nick-name">Nickname</label>
          <input id="nick-name" className="input" data-autofocus value={text} maxLength={NICKNAME_MAX} onChange={(e) => setText(e.target.value)} />
        </div>
        <p className="faint" style={{ margin: 0, fontSize: 13 }}>
          {own ? "People see it only in this community. Leave it empty to go by your username." : "Shown only in this community. Leave it empty to show their username again."}
        </p>
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
