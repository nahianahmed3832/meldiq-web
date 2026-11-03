import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
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
  useLocaleRender();
  const l10n = useLocalization();
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
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : uiText("workspace.interface.couldn_t_answer_the_request_35c67cd")))
      .finally(() => setBusy(false));
  };
  return (
    <div className="composer-wrap">
      <div className="request-bar" role="region" aria-label={uiText("workspace.interface.message_request_2de564f")}>
        <p style={{ margin: 0 }}>
          <Localized
            k="workspace.interface.they_can_t_see_whether_you_ve_read_this_accept_to_reply_decline_a_e99a2b9"
            slots={[
              <strong>
                <Localized k="workspace.interface.wants_to_message_you_778034d" slots={[name]} />
              </strong>,
            ]}
          />
        </p>
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => answer("accept")}>
            <Check size={14} /> {l10n("calls.accept")}
          </button>
          <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => answer("decline")}>
            <X size={14} /> {l10n("calls.decline")}
          </button>
          <button className="btn btn-danger-quiet btn-sm" disabled={busy} onClick={() => answer("block")}>
            <Localized k="workspace.interface.block_baec36f" slots={[<ShieldBan size={14} />]} />
          </button>
        </div>
      </div>
    </div>
  );
}
/** Your request waiting for them: how many more messages you may send until they answer. */
export function RequestSentBanner({ conversation: c }: { conversation: Conversation }) {
  useLocaleRender();
  const left = remaining(c.request?.sent ?? 0, c.request?.limit ?? 3);
  return (
    <div className="banner info" role="status">
      <span className="grow">
        <Localized
          k="workspace.interface.message_request_sent_they_ll_see_your_messages_if_they_accept_da1c563"
          slots={[left > 0 ? uiText("workspace.interface.you_can_send_value0_more_until_then_a15be08", { value0: left }) : uiText("workspace.interface.you_can_t_send_more_until_they_accept_2eaad0e")]}
        />
      </span>
    </div>
  );
}
