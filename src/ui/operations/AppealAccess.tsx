import { useState } from "react";
import { z } from "zod";
import { ApiClient } from "../../api/client";
export function AppealAccess({ base }: { base: string }) {
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
      <summary>Appeal an account restriction</summary>
      <form
        className="auth-form"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <p>Verify your account email to submit an appeal even while sign-in is restricted. This code cannot sign you in or change your account.</p>
        {!challenge ? (
          <label>
            Account email
            <input className="input" required type="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
        ) : (
          <>
            <label>
              Appeal verification code
              <input className="input" required inputMode="numeric" pattern="[0-9]{6}" value={code} onChange={(e) => setCode(e.target.value)} />
            </label>
            <label>
              Appeal subject
              <input className="input" required minLength={3} maxLength={120} value={subject} onChange={(e) => setSubject(e.target.value)} />
            </label>
            <label>
              Appeal details
              <textarea className="textarea" required minLength={10} maxLength={4000} value={body} onChange={(e) => setBody(e.target.value)} />
            </label>
          </>
        )}
        <button className="btn btn-secondary" disabled={busy} type="submit">
          {challenge ? "Submit verified appeal" : "Send appeal code"}
        </button>
        {result && <p role="status">{result}</p>}
      </form>
    </details>
  );
}
