import { ArrowLeft, ChevronRight, KeyRound, LockKeyhole, MailX, Smartphone } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import type { AccountSessionGrant } from "../../api/accountSchemas";
import { ApiError } from "../../api/client";
import type { AccountApi } from "../../auth/accountApi";
import { PasskeyCancelled, signInWithPasskey } from "../../auth/passkeys";
import { cleanVerifyCode, emailProblem, nameProblem, normalizeEmail, PASSWORD_MIN_LENGTH, passwordProblem } from "../../auth/rules";
import { AuthHeading, FormError, FormNotice, LinkButton } from "./AuthFrame";
import { useSubmit } from "./useSubmit";
import { useT } from "../../i18n";

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

export function Back({ onClick, label }: { onClick: () => void; label?: string }) {
  const t = useT();
  return (
    <button type="button" className="btn btn-ghost btn-sm auth-back" onClick={onClick}>
      <ArrowLeft size={14} /> {label ?? t("common_back")}
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
  /** The pre-email device sign-in, kept only in development and test builds (testLinking.ts). */
  canLinkWithPhone: boolean;
  /** This page's relying party when the server offers passkeys here (auth/passkeys.ts passkeyRpId), else null. */
  passkeyRpId: string | null;
  /** [password] is absent after a passkey sign-in. */
  onSignedIn: (grant: AccountSessionGrant, password?: string) => void;
  onUnverified: (email: string, password: string) => void;
  onSignUp: () => void;
  onForgot: (email: string) => void;
  /** Offered when the server has account recovery codes (feature `recovery-codes`). */
  onRecover?: (email: string) => void;
  onLinkWithPhone: () => void;
}) {
  const [email, setEmail] = useState(props.initialEmail ?? "");
  const [password, setPassword] = useState("");
  const [help, setHelp] = useState(false);
  const { busy, error, setError, run } = useSubmit();
  const [withPasskey, setWithPasskey] = useState(false);
  // API 0.46.0: two-step sign-in asks for the authenticator app's code (or a backup code) after the password.
  const [needsCode, setNeedsCode] = useState(false);
  const [code, setCode] = useState("");
  const t = useT();

  const passkey = (rpId: string) => {
    setWithPasskey(true);
    void run(async () => {
      try {
        props.onSignedIn(await signInWithPasskey(props.ctx.accounts, rpId, props.ctx.deviceName));
      } catch (e) {
        if (!(e instanceof PasskeyCancelled)) throw e;
      }
    }).finally(() => setWithPasskey(false));
  };

  const submit = () => {
    const problem = emailProblem(email) ?? (password ? null : t("signin_enter_password"));
    if (problem) return setError(problem);
    if (needsCode && code.replace(/[\s-]/g, "").length < 6) return setError("Enter the 6-digit code from your authenticator app, or a backup code.");
    void run(async () => {
      try {
        props.onSignedIn(await props.ctx.accounts.login(normalizeEmail(email), password, props.ctx.deviceName, undefined, needsCode ? code.trim() : undefined), password);
      } catch (e) {
        if (e instanceof ApiError && e.code === "email_unverified") return props.onUnverified(normalizeEmail(email), password);
        if (e instanceof ApiError && e.code === "totp_required") {
          setNeedsCode(true);
          return;
        }
        throw e;
      }
    });
  };

  if (help) {
    return (
      <SignInHelp
        onForgot={() => props.onForgot(normalizeEmail(email))}
        onRecover={props.onRecover && (() => props.onRecover?.(normalizeEmail(email)))}
        onLinkWithPhone={props.canLinkWithPhone ? props.onLinkWithPhone : undefined}
        onBack={() => setHelp(false)}
      />
    );
  }

  return (
    <form className="auth-form" onSubmit={submitHandler(submit)} noValidate>
      <AuthHeading title={t("signin_title")} sub={t("signin_sub")} />
      <FormNotice text={props.notice ?? null} />
      <FormError text={error} />
      <Field id="si-email" label={t("common_email")}>
        <input id="si-email" className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
      </Field>
      <Field id="si-password" label={t("common_password")}>
        <input id="si-password" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      {needsCode && (
        <Field id="si-code" label="Code from your authenticator app">
          <input
            id="si-code"
            className="input mono"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456 or a backup code"
            value={code}
            maxLength={20}
            onChange={(e) => setCode(e.target.value)}
            autoFocus
          />
        </Field>
      )}
      <button className="btn btn-primary btn-lg" disabled={busy}>
        {busy && !withPasskey ? t("signin_busy") : t("signin_button")}
      </button>
      {props.passkeyRpId && (
        <button type="button" className="btn btn-secondary btn-lg" disabled={busy} onClick={() => passkey(props.passkeyRpId!)}>
          <KeyRound size={16} /> {withPasskey ? t("signin_passkey_busy") : t("signin_passkey")}
        </button>
      )}
      <div className="auth-links">
        <LinkButton onClick={() => setHelp(true)}>{t("signin_trouble")}</LinkButton>
        {props.canSignUp && <LinkButton onClick={props.onSignUp}>{t("signin_create")}</LinkButton>}
      </div>
    </form>
  );
}

/**
 * The ways back in, shown only after "Having trouble signing in?" (Meldiq Android does the same; meldiq
 * docs/product/MELDIQ_AUTH_FLOW_AUDIT.md). A way is offered only when this server and this browser allow it.
 */
function SignInHelp(props: { onForgot: () => void; onRecover?: () => void; onLinkWithPhone?: () => void; onBack: () => void }) {
  const t = useT();
  return (
    <div className="auth-form">
      <AuthHeading title={t("signin_trouble")} sub={t("help_sub")} />
      <div className="auth-choices">
        <ChoiceButton icon={<LockKeyhole size={18} />} title={t("help_forgot")} sub={t("help_forgot_sub")} onClick={props.onForgot} />
        {props.onRecover && <ChoiceButton icon={<MailX size={18} />} title={t("help_no_email")} sub={t("help_no_email_sub")} onClick={props.onRecover} />}
        {props.onLinkWithPhone && <ChoiceButton icon={<Smartphone size={18} />} title={t("help_phone")} sub={t("help_phone_sub")} onClick={props.onLinkWithPhone} />}
      </div>
      <Back onClick={props.onBack} label={t("help_back")} />
    </div>
  );
}

/** One way to choose, as a large button: icon, title and a line about it. */
export function ChoiceButton({ icon, title, sub, onClick }: { icon: ReactNode; title: string; sub: string; onClick: () => void }) {
  return (
    <button type="button" className="auth-choice" onClick={onClick}>
      <span className="auth-choice-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="auth-choice-text">
        <strong>{title}</strong>
        <span className="muted">{sub}</span>
      </span>
      <ChevronRight size={16} aria-hidden="true" />
    </button>
  );
}

// ───────────────────────── sign up ─────────────────────────

export function SignUpForm(props: { ctx: FormContext; inviteRequired: boolean; onSent: (email: string, password: string) => void; onBack: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [invite, setInvite] = useState("");
  const { busy, error, setError, run } = useSubmit();
  const t = useT();

  const submit = () => {
    const problem = nameProblem(name) ?? emailProblem(email) ?? passwordProblem(password, email) ?? (props.inviteRequired && !invite.trim() ? t("signup_invite_missing") : null);
    if (problem) return setError(problem);
    void run(async () => {
      await props.ctx.accounts.register(name.trim(), normalizeEmail(email), password, invite.trim() || undefined);
      props.onSent(normalizeEmail(email), password);
    });
  };

  return (
    <form className="auth-form" onSubmit={submitHandler(submit)} noValidate>
      <Back onClick={props.onBack} label={t("signup_back")} />
      <AuthHeading title={t("signup_title")} sub={t("signup_sub")} />
      <FormError text={error} />
      <Field id="su-name" label={t("common_your_name")} hint={t("signup_name_hint")}>
        <input id="su-name" className="input" autoComplete="name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
      <Field id="su-email" label={t("common_email")}>
        <input id="su-email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field id="su-password" label={t("common_password")} hint={t("signup_password_hint", { n: PASSWORD_MIN_LENGTH })}>
        <input id="su-password" className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      {props.inviteRequired && (
        <Field id="su-invite" label={t("signup_invite")} hint={t("signup_invite_hint")}>
          <input id="su-invite" className="input" value={invite} onChange={(e) => setInvite(e.target.value)} autoComplete="off" />
        </Field>
      )}
      <button className="btn btn-primary btn-lg" disabled={busy}>
        {busy ? t("signup_busy") : t("signup_button")}
      </button>
    </form>
  );
}

// ───────────────────────── email code ─────────────────────────

export function VerifyEmailForm(props: { ctx: FormContext; email: string; password: string; onVerified: (grant: AccountSessionGrant) => void; onBack: () => void }) {
  const t = useT();
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState<string | null>(() => t("verify_sent", { email: props.email }));
  const { busy, error, setError, run } = useSubmit();

  const submit = () => {
    const c = cleanVerifyCode(code);
    if (c.length !== 6) return setError(t("verify_enter"));
    void run(async () => {
      await props.ctx.accounts.verifyEmail(props.email, c, props.password);
      props.onVerified(await props.ctx.accounts.login(props.email, props.password, props.ctx.deviceName));
    });
  };

  const resend = () =>
    void run(async () => {
      await props.ctx.accounts.resendVerification(props.email);
      setNotice(t("verify_resent", { email: props.email }));
    });

  return (
    <form className="auth-form" onSubmit={submitHandler(submit)} noValidate>
      <Back onClick={props.onBack} />
      <AuthHeading title={t("verify_title")} />
      <FormNotice text={notice} />
      <FormError text={error} />
      <Field id="ve-code" label={t("common_code")}>
        <input id="ve-code" className="input code-input" inputMode="numeric" autoComplete="one-time-code" value={code} maxLength={9} onChange={(e) => setCode(e.target.value)} autoFocus />
      </Field>
      <button className="btn btn-primary btn-lg" disabled={busy}>
        {busy ? t("common_checking") : t("verify_button")}
      </button>
      <div className="auth-links">
        <LinkButton onClick={resend}>{t("common_send_new_code")}</LinkButton>
      </div>
    </form>
  );
}

// ───────────────────────── forgotten password ─────────────────────────

export function ForgotPasswordForm(props: { ctx: FormContext; initialEmail: string; onSent: (email: string) => void; onBack: () => void }) {
  const [email, setEmail] = useState(props.initialEmail);
  const { busy, error, setError, run } = useSubmit();
  const t = useT();
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
      <AuthHeading title={t("forgot_title")} sub={t("forgot_sub")} />
      <FormError text={error} />
      <Field id="fp-email" label={t("common_email")}>
        <input id="fp-email" className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
      </Field>
      <button className="btn btn-primary btn-lg" disabled={busy}>
        {busy ? t("common_sending") : t("forgot_button")}
      </button>
    </form>
  );
}

export function ResetPasswordForm(props: { ctx: FormContext; email: string; onDone: () => void; onBack: () => void }) {
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const { busy, error, setError, run } = useSubmit();
  const t = useT();
  const submit = () => {
    const problem = (code.trim() ? null : t("reset_enter_code")) ?? passwordProblem(password, props.email);
    if (problem) return setError(problem);
    void run(async () => {
      await props.ctx.accounts.resetPassword(props.email, code.trim(), password);
      props.onDone();
    });
  };
  return (
    <form className="auth-form" onSubmit={submitHandler(submit)} noValidate>
      <Back onClick={props.onBack} />
      <AuthHeading title={t("reset_title")} />
      <FormNotice text={t("reset_sent", { email: props.email })} />
      <FormError text={error} />
      <Field id="rp-code" label={t("reset_code")}>
        <input id="rp-code" className="input code-input" autoComplete="one-time-code" value={code} maxLength={32} onChange={(e) => setCode(e.target.value)} autoFocus />
      </Field>
      <Field id="rp-password" label={t("reset_new_password")} hint={t("common_password_min", { n: PASSWORD_MIN_LENGTH })}>
        <input id="rp-password" className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <button className="btn btn-primary btn-lg" disabled={busy}>
        {busy ? t("common_saving") : t("reset_button")}
      </button>
    </form>
  );
}
