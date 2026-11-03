import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useState } from "react";
import { z } from "zod";
import { ApiClient } from "../../api/client";
export function AppealAccess({ base }: { base: string }) {
  useLocaleRender();
  const [email, setEmail] = useState(""),
    [challenge, setChallenge] = useState<string | null>(null),
    [code, setCode] = useState(""),
    [subject, setSubject] = useState("Account suspension appeal"),
    [body, setBody] = useState(""),
    [result, setResult] = useState(""),
    [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    setResult("");
    try {
      const api = new ApiClient(base);
      if (!challenge) {
        const r = await api.json("POST", "/v2/platform/appeals/email/start", z.object({ challengeId: z.string(), message: z.string() }), { auth: false, body: { email } });
        setChallenge(r.challengeId);
        setResult(r.message);
      } else {
        const r = await api.json("POST", "/v2/platform/appeals/email/complete", z.object({ id: z.string() }), { auth: false, body: { challengeId: challenge, code, subject, body } });
        setResult(`Appeal ${r.id} submitted. Staff will review your account restriction.`);
        setChallenge(null);
      }
    } catch (e) {
      setResult(e instanceof Error ? e.message : "Appeal could not be submitted");
    } finally {
      setBusy(false);
    }
  };
  return (
    <details style={{ marginTop: 20 }}>
      <summary>
        <Localized k="workspace.interface.appeal_an_account_restriction_2a0a485" />
      </summary>
      <form
        className="auth-form"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <p>
          <Localized k="workspace.interface.verify_your_account_email_to_submit_an_appeal_even_while_sign_in_bb21083" />
        </p>
        {!challenge ? (
          <label>
            <Localized k="workspace.interface.account_email_316ef5f" />
            <input className="input" required type="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
        ) : (
          <>
            <label>
              <Localized k="workspace.interface.appeal_verification_code_9e9a37b" />
              <input className="input" required inputMode="numeric" pattern="[0-9]{6}" value={code} onChange={(e) => setCode(e.target.value)} />
            </label>
            <label>
              <Localized k="workspace.interface.appeal_subject_d44c7b4" />
              <input className="input" required minLength={3} maxLength={120} value={subject} onChange={(e) => setSubject(e.target.value)} />
            </label>
            <label>
              <Localized k="workspace.interface.appeal_details_1348a06" />
              <textarea className="textarea" required minLength={10} maxLength={4000} value={body} onChange={(e) => setBody(e.target.value)} />
            </label>
          </>
        )}
        <button className="btn btn-secondary" disabled={busy} type="submit">
          {challenge ? uiText("workspace.interface.submit_verified_appeal_3f00635") : uiText("workspace.interface.send_appeal_code_18f7877")}
        </button>
        {result && <p role="status">{result}</p>}
      </form>
    </details>
  );
}
