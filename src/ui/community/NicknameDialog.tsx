import { type FormEvent, useState } from "react";
import { ApiError } from "../../api/client";
import { useEngine } from "../../application/orbit";
import { cleanNickname, NICKNAME_MAX, nicknameProblem, setCommunityNickname } from "../../sync/communityParity";
import { Dialog } from "../components/Overlay";

interface NicknameDialogProps {
  orgId: string;
  /** The nickname used here now, or null. */
  current: string | null;
  onClose: () => void;
}

/** Change nickname, from the community menu: a name shown only in this community; empty uses the username. */
export function NicknameDialog({ orgId, current, onClose }: NicknameDialogProps) {
  const engine = useEngine();
  const [text, setText] = useState(current ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const problem = nicknameProblem(text);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      await setCommunityNickname(engine, orgId, cleanNickname(text));
      onClose();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : "Couldn't save the nickname.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog title="Change nickname" onClose={onClose}>
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
          People see it only in this community. Leave it empty to go by your username.
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
