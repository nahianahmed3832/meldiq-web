import { ArrowLeft } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import type { AccountSessionGrant, LegacyTicket } from "../../api/accountSchemas";
import { ApiError } from "../../api/client";
import type { AccountApi } from "../../auth/accountApi";
import { verifyLegacyAccount } from "../../auth/legacyMove";
import { cleanVerifyCode, emailProblem, nameProblem, normalizeEmail, PASSWORD_MIN_LENGTH, passwordProblem } from "../../auth/rules";
import { AuthHeading, FormError, FormNotice, LinkButton } from "./AuthFrame";
import { useSubmit } from "./useSubmit";

/** Shared by every form: the server's account API and this browser's name in the account's session list. */
export interface FormContext {
  accounts: AccountApi;
  deviceName: string;
}

export function Field({ id, label, hint, children }: { id: string; label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export function Back({ onClick, label = "Back" }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" className="btn btn-ghost btn-sm auth-back" onClick={onClick}>
      <ArrowLeft size={14} /> {label}
    </button>
  );
}

export const submitHandler = (fn: () => void) => (e: FormEvent) => {
  e.preventDefault();
  fn();
};

// ───────────────────────── sign in ─────────────────────────

export function SignInForm(props: {
  ctx: FormContext;
  notice?: string | null;
  initialEmail?: string;
  canSignUp: boolean;
  canMove: boolean;
  canLinkWithPhone: boolean;
  onSignedIn: (grant: AccountSessionGrant, password: string) => void;
  onUnverified: (email: string, password: string) => void;
  onSignUp: () => void;
  onForgot: (email: string) => void;
  /** Offered when the server has account recovery codes (feature `recovery-codes`). */
  onRecover?: (email: string) => void;
  onMove: () => void;
  onLinkWithPhone: () => void;
}) {
  const [email, setEmail] = useState(props.initialEmail ?? "");
  const [password, setPassword] = useState("");
  const { busy, error, setError, run } = useSubmit();

  const submit = () => {
    const problem = emailProblem(email) ?? (password ? null : "Enter your password.");
    if (problem) return setError(problem);
    void run(async () => {
      try {
        props.onSignedIn(await props.ctx.accounts.login(normalizeEmail(email), password, props.ctx.deviceName), password);
      } catch (e) {
        if (e instanceof ApiError && e.code === "email_unverified") return props.onUnverified(normalizeEmail(email), password);
        throw e;
      }
    });
  };

  return (
    <form className="auth-form" onSubmit={submitHandler(submit)} noValidate>
      <AuthHeading title="Sign in to Meldiq" sub="Use the email and password of your Meldiq account." />
      <FormNotice text={props.notice ?? null} />
      <FormError text={error} />
      <Field id="si-email" label="Email">
        <input id="si-email" className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
      </Field>
      <Field id="si-password" label="Password">
        <input id="si-password" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <button className="btn btn-primary btn-lg" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <div className="auth-links">
        <LinkButton onClick={() => props.onForgot(normalizeEmail(email))}>Forgot password?</LinkButton>
        {props.canSignUp && <LinkButton onClick={props.onSignUp}>Create an account</LinkButton>}
      </div>
      {props.onRecover && (
        <div className="auth-links">
          <LinkButton onClick={() => props.onRecover?.(normalizeEmail(email))}>Lost access to your email?</LinkButton>
        </div>
      )}
      {(props.canMove || props.canLinkWithPhone) && (
        <div className="auth-alt">
          {props.canMove && (
            <div>
              <strong>Used Orbit (now Meldiq) before email sign-in?</strong>
              <span className="muted"> Move your account with your username and recovery key. </span>
              <LinkButton onClick={props.onMove}>Move my account</LinkButton>
            </div>
          )}
          {props.canLinkWithPhone && (
            <div>
              <span className="muted">Haven't moved yet and have your phone? </span>
              <LinkButton onClick={props.onLinkWithPhone}>Link with your phone instead</LinkButton>
            </div>
          )}
        </div>
      )}
    </form>
  );
}

// ───────────────────────── sign up ─────────────────────────

export function SignUpForm(props: { ctx: FormContext; inviteRequired: boolean; onSent: (email: string, password: string) => void; onBack: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [invite, setInvite] = useState("");
  const { busy, error, setError, run } = useSubmit();

  const submit = () => {
    const problem = nameProblem(name) ?? emailProblem(email) ?? passwordProblem(password, email) ?? (props.inviteRequired && !invite.trim() ? "Enter your invitation code." : null);
    if (problem) return setError(problem);
    void run(async () => {
      await props.ctx.accounts.register(name.trim(), normalizeEmail(email), password, invite.trim() || undefined);
      props.onSent(normalizeEmail(email), password);
    });
  };

  return (
    <form className="auth-form" onSubmit={submitHandler(submit)} noValidate>
      <Back onClick={props.onBack} label="Sign in instead" />
      <AuthHeading title="Create your Meldiq account" sub="We'll email you a code to confirm the address." />
      <FormError text={error} />
      <Field id="su-name" label="Your name" hint="Shown to the people you talk to.">
        <input id="su-name" className="input" autoComplete="name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
      <Field id="su-email" label="Email">
        <input id="su-email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field id="su-password" label="Password" hint={`At least ${PASSWORD_MIN_LENGTH} characters. A few unrelated words make a strong one.`}>
        <input id="su-password" className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      {props.inviteRequired && (
        <Field id="su-invite" label="Invitation code" hint="This server only admits people with an invitation.">
          <input id="su-invite" className="input" value={invite} onChange={(e) => setInvite(e.target.value)} autoComplete="off" />
        </Field>
      )}
      <button className="btn btn-primary btn-lg" disabled={busy}>
        {busy ? "Creating…" : "Create account"}
      </button>
    </form>
  );
}

// ───────────────────────── email code ─────────────────────────

export function VerifyEmailForm(props: { ctx: FormContext; email: string; password: string; onVerified: (grant: AccountSessionGrant) => void; onBack: () => void }) {
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState<string | null>(`We sent a 6-digit code to ${props.email}. It's valid for 15 minutes.`);
  const { busy, error, setError, run } = useSubmit();

  const submit = () => {
    const c = cleanVerifyCode(code);
    if (c.length !== 6) return setError("Enter the 6-digit code from the email.");
    void run(async () => {
      await props.ctx.accounts.verifyEmail(props.email, c, props.password);
      props.onVerified(await props.ctx.accounts.login(props.email, props.password, props.ctx.deviceName));
    });
  };

  const resend = () =>
    void run(async () => {
      await props.ctx.accounts.resendVerification(props.email);
      setNotice(`If ${props.email} is waiting for a code, a new one is on its way.`);
    });

  return (
    <form className="auth-form" onSubmit={submitHandler(submit)} noValidate>
      <Back onClick={props.onBack} />
      <AuthHeading title="Check your email" />
      <FormNotice text={notice} />
      <FormError text={error} />
      <Field id="ve-code" label="Code">
        <input id="ve-code" className="input code-input" inputMode="numeric" autoComplete="one-time-code" value={code} maxLength={9} onChange={(e) => setCode(e.target.value)} autoFocus />
      </Field>
      <button className="btn btn-primary btn-lg" disabled={busy}>
        {busy ? "Checking…" : "Confirm"}
      </button>
      <div className="auth-links">
        <LinkButton onClick={resend}>Send a new code</LinkButton>
      </div>
    </form>
  );
}

// ───────────────────────── forgotten password ─────────────────────────

export function ForgotPasswordForm(props: { ctx: FormContext; initialEmail: string; onSent: (email: string) => void; onBack: () => void }) {
  const [email, setEmail] = useState(props.initialEmail);
  const { busy, error, setError, run } = useSubmit();
  const submit = () => {
    const problem = emailProblem(email);
    if (problem) return setError(problem);
    void run(async () => {
      await props.ctx.accounts.forgotPassword(normalizeEmail(email));
      props.onSent(normalizeEmail(email));
    });
  };
  return (
    <form className="auth-form" onSubmit={submitHandler(submit)} noValidate>
      <Back onClick={props.onBack} />
      <AuthHeading title="Reset your password" sub="We'll email you a code. Resetting signs you out everywhere; your messages and keys stay on your devices." />
      <FormError text={error} />
      <Field id="fp-email" label="Email">
        <input id="fp-email" className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
      </Field>
      <button className="btn btn-primary btn-lg" disabled={busy}>
        {busy ? "Sending…" : "Send code"}
      </button>
    </form>
  );
}

export function ResetPasswordForm(props: { ctx: FormContext; email: string; onDone: () => void; onBack: () => void }) {
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const { busy, error, setError, run } = useSubmit();
  const submit = () => {
    const problem = (code.trim() ? null : "Enter the code from the email.") ?? passwordProblem(password, props.email);
    if (problem) return setError(problem);
    void run(async () => {
      await props.ctx.accounts.resetPassword(props.email, code.trim(), password);
      props.onDone();
    });
  };
  return (
    <form className="auth-form" onSubmit={submitHandler(submit)} noValidate>
      <Back onClick={props.onBack} />
      <AuthHeading title="Choose a new password" />
      <FormNotice text={`If ${props.email} has a Meldiq account, we sent it a reset code. It's valid for 15 minutes.`} />
      <FormError text={error} />
      <Field id="rp-code" label="Reset code">
        <input id="rp-code" className="input code-input" autoComplete="one-time-code" value={code} maxLength={32} onChange={(e) => setCode(e.target.value)} autoFocus />
      </Field>
      <Field id="rp-password" label="New password" hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}>
        <input id="rp-password" className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <button className="btn btn-primary btn-lg" disabled={busy}>
        {busy ? "Saving…" : "Set password"}
      </button>
    </form>
  );
}

// ───────────────────────── moving an older account ─────────────────────────

export function LegacyVerifyForm(props: { ctx: FormContext; onVerified: (ticket: LegacyTicket, seed: Uint8Array) => void; onBack: () => void }) {
  const [username, setUsername] = useState("");
  const [recovery, setRecovery] = useState("");
  const { busy, error, setError, run } = useSubmit();
  const submit = () => {
    if (!username.trim()) return setError("Enter your Meldiq username.");
    if (!recovery.trim()) return setError("Enter your recovery key.");
    void run(async () => {
      const { ticket, seed } = await verifyLegacyAccount(props.ctx.accounts, username, recovery);
      props.onVerified(ticket, seed);
    });
  };
  return (
    <form className="auth-form" onSubmit={submitHandler(submit)} noValidate>
      <Back onClick={props.onBack} />
      <AuthHeading title="Move your Orbit account to Meldiq" sub="Your conversations, workspaces and contacts stay as they are. Your recovery key is checked here in the browser and never sent." />
      <FormError text={error} />
      <Field id="lg-username" label="Username">
        <input id="lg-username" className="input" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
      </Field>
      <Field id="lg-recovery" label="Recovery key" hint="On your phone: Settings › Privacy & Security › Recovery key.">
        <textarea id="lg-recovery" className="textarea mono" rows={3} autoComplete="off" spellCheck={false} value={recovery} onChange={(e) => setRecovery(e.target.value)} />
      </Field>
      <button className="btn btn-primary btn-lg" disabled={busy}>
        {busy ? "Checking…" : "Continue"}
      </button>
    </form>
  );
}

export function LegacyDetailsForm(props: { ctx: FormContext; ticket: LegacyTicket; onSent: (email: string, password: string) => void; onBack: () => void }) {
  const [name, setName] = useState(props.ticket.legacyUser.displayName);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { busy, error, setError, run } = useSubmit();
  const submit = () => {
    const problem = nameProblem(name) ?? emailProblem(email) ?? passwordProblem(password, email);
    if (problem) return setError(problem);
    void run(async () => {
      await props.ctx.accounts.legacyComplete(props.ticket.ticket, name.trim(), normalizeEmail(email), password);
      props.onSent(normalizeEmail(email), password);
    });
  };
  return (
    <form className="auth-form" onSubmit={submitHandler(submit)} noValidate>
      <Back onClick={props.onBack} />
      <AuthHeading title={`Welcome back, @${props.ticket.legacyUser.username}`} sub="Choose the email and password you'll sign in with from now on." />
      <FormError text={error} />
      <Field id="ld-name" label="Your name">
        <input id="ld-name" className="input" autoComplete="name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field id="ld-email" label="Email">
        <input id="ld-email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
      </Field>
      <Field id="ld-password" label="Password" hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}>
        <input id="ld-password" className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <button className="btn btn-primary btn-lg" disabled={busy}>
        {busy ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}
