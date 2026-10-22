import { Check, ShieldBan, X } from "lucide-react";
import { useState } from "react";
import { ApiError } from "../../api/client";
import type { Conversation } from "../../api/schemas";
import { useEngine } from "../../application/orbit";
import { navigate } from "../../application/router";
import { answerRequest, remaining } from "../../sync/social";

/**
 * A message request you received (batch B6, android MessageRequestBar): read-only until you answer. Accept moves it to
 * your DMs and connects you; Decline removes it here (the sender isn't told); Block also blocks them.
 */
export function RequestBar({ conversation: c, name }: { conversation: Conversation; name: string }) {
  const engine = useEngine();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const answer = (action: "accept" | "decline" | "block") => {
    setBusy(true);
    setError(null);
    answerRequest(engine, c.id, action)
      .then(() => {
        if (action !== "accept") navigate({ section: "dms" }, true);
      })
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Couldn't answer the request."))
      .finally(() => setBusy(false));
  };
  return (
    <div className="composer-wrap">
      <div className="request-bar" role="region" aria-label="Message request">
        <p style={{ margin: 0 }}>
          <strong>{name} wants to message you.</strong> They can't see whether you've read this. Accept to reply; decline and they aren't told.
        </p>
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => answer("accept")}>
            <Check size={14} /> Accept
          </button>
          <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => answer("decline")}>
            <X size={14} /> Decline
          </button>
          <button className="btn btn-danger-quiet btn-sm" disabled={busy} onClick={() => answer("block")}>
            <ShieldBan size={14} /> Block
          </button>
        </div>
      </div>
    </div>
  );
}

/** Your request waiting for them: how many more messages you may send until they answer. */
export function RequestSentBanner({ conversation: c }: { conversation: Conversation }) {
  const left = remaining(c.request?.sent ?? 0, c.request?.limit ?? 3);
  return (
    <div className="banner info" role="status">
      <span className="grow">Message request sent. They'll see your messages if they accept. {left > 0 ? `You can send ${left} more until then.` : "You can't send more until they accept."}</span>
    </div>
  );
}
