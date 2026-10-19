import { useState } from "react";
import { cleanVerifyCode, emailProblem, normalizeEmail, PASSWORD_MIN_LENGTH, passwordProblem } from "../../auth/rules";
import { AuthHeading, FormError, FormNotice } from "./AuthFrame";
import { Back, Field, type FormContext, submitHandler } from "./AccountForms";
import { useSubmit } from "./useSubmit";

/** A recovery code as typed: "abcd-efgh-jklm", spaces or none; the server ignores dashes and case. */
const RECOVERY_CODE_MIN = 12;

/**
 * Getting back into an account after losing its email address (android sign-in › Lost access to your email?, server
 * docs/ACCOUNT_RECOVERY.md). Step 1: the account's address, one recovery code (used up by this step) and the new address,
 * which is sent a 6-digit code. Recovery codes restore the account only: setting up this browser afterwards still needs
 * the encryption recovery key or a signed-in phone.
 */
export function RecoverStartForm(props: { ctx: FormContext; initialEmail: string; onStarted: (ticket: string, newEmail: string) => void; onBack: () => void }) {
  const [email, setEmail] = useState(props.initialEmail);
  const [code, setCode] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const { busy, error, setError, run } = useSubmit();
  const submit = () => {
    const raw = code.replace(/[\s-]/g, "");
    const problem =
      emailProblem(email) ??
      (raw.length < RECOVERY_CODE_MIN ? "Enter one of your recovery codes (12 characters, like ABCD-EFGH-JKLM)." : null) ??
      emailProblem(newEmail) ??
      (normalizeEmail(newEmail) === normalizeEmail(email) ? "The new address must be different. If you can still read this one, reset your password instead." : null);
    if (problem) return setError(problem);
    void run(async () => {
      const r = await props.ctx.accounts.recoverStart(normalizeEmail(email), code.trim(), normalizeEmail(newEmail));
      props.onStarted(r.ticket, r.email);
    });
  };
  return (
    <form className="auth-form" onSubmit={submitHandler(submit)} noValidate>
      <Back onClick={props.onBack} />
      <AuthHeading
        title="Lost access to your email?"
        sub="Use one of the recovery codes you saved to move your account to a new address. This gets you back into your account; your encryption keys come back separately, with your encryption recovery key or your phone."
      />
      <FormError text={error} />
      <Field id="rc-email" label="Your account's current email">
        <input id="rc-email" className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus={!props.initialEmail} />
      </Field>
      <Field id="rc-code" label="Recovery code" hint="Each code works once. This step uses it up.">
        <input id="rc-code" className="input code-input" autoComplete="off" spellCheck={false} value={code} maxLength={40} onChange={(e) => setCode(e.target.value)} autoFocus={!!props.initialEmail} />
      </Field>
      <Field id="rc-new" label="New email address" hint="We'll send a code there to make sure it's yours.">
        <input id="rc-new" className="input" type="email" autoComplete="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
      </Field>
      <button className="btn btn-primary btn-lg" disabled={busy}>
        {busy ? "Checking…" : "Continue"}
      </button>
    </form>
  );
}

/** Step 2: the 6-digit code sent to the new address and a new password. Every session of the account is signed out. */
export function RecoverCompleteForm(props: { ctx: FormContext; ticket: string; newEmail: string; onDone: (email: string, remainingCodes: number) => void; onBack: () => void }) {
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const { busy, error, setError, run } = useSubmit();
  const submit = () => {
    const digits = cleanVerifyCode(code);
    const problem = (digits.length === 6 ? null : "Enter the 6-digit code from the email.") ?? passwordProblem(password, props.newEmail);
    if (problem) return setError(problem);
    void run(async () => {
      const r = await props.ctx.accounts.recoverComplete(props.ticket, digits, password);
      props.onDone(r.email, r.remainingCodes);
    });
  };
  return (
    <form className="auth-form" onSubmit={submitHandler(submit)} noValidate>
      <Back onClick={props.onBack} label="Start again" />
      <AuthHeading title="Confirm your new address" />
      <FormNotice text={`We sent a 6-digit code to ${props.newEmail}. It's valid for 30 minutes.`} />
      <FormError text={error} />
      <Field id="rc-email-code" label="Code from the email">
        <input id="rc-email-code" className="input code-input" inputMode="numeric" autoComplete="one-time-code" value={code} maxLength={12} onChange={(e) => setCode(e.target.value)} autoFocus />
      </Field>
      <Field id="rc-password" label="New password" hint={`At least ${PASSWORD_MIN_LENGTH} characters. Every device of the account signs out and signs in again with it.`}>
        <input id="rc-password" className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <button className="btn btn-primary btn-lg" disabled={busy}>
        {busy ? "Saving…" : "Move my account"}
      </button>
    </form>
  );
}
