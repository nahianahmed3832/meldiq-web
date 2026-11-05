import { TermsConsent } from "./TermsConsent";
import { PasswordInput } from "../components/PasswordInput";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { SocialSignIn } from "./SocialSignIn";
import { ArrowLeft, ChevronRight, KeyRound, LockKeyhole, Mail, MailX, Smartphone } from "lucide-react";
import { cloneElement, isValidElement, type FormEvent, type ReactElement, type ReactNode, useEffect, useState } from "react";
import type { AccountSessionGrant } from "../../api/accountSchemas";
import { ApiError } from "../../api/client";
import type { AccountApi } from "../../auth/accountApi";
import { acceptRegistrationPolicy, requestedRegistrationPolicy, type RegistrationPolicy } from "../../auth/registrationPolicy";
import { PasskeyCancelled, signInWithPasskey } from "../../auth/passkeys";
import { cleanVerifyCode, emailProblem, nameProblem, normalizeEmail, PASSWORD_MIN_LENGTH, passwordProblem } from "../../auth/rules";
import { AuthHeading, FormError, FormNotice, LinkButton } from "./AuthFrame";
import { useSubmit } from "./useSubmit";
import { useT } from "../../i18n";
import { useCodeCooldown } from "./useCodeCooldown";
/** Shared by every form: the server's account API and this browser's name in the account's session list. */
export interface FormContext {
  accounts: AccountApi;
  deviceName: string;
}
export function Field({ id, label, hint, children }: { id: string; label: string; hint?: ReactNode; children: ReactNode }) {
  useLocaleRender();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {hint && isValidElement(children) ? cloneElement(children as ReactElement<{ "aria-describedby"?: string }>, { "aria-describedby": `${id}-hint` }) : children}
      {hint && (
        <span id={`${id}-hint`} className="hint">
          {hint}
        </span>
      )}
    </div>
  );
}
export function Back({ onClick, label, disabled = false }: { onClick: () => void; label?: string; disabled?: boolean }) {
  useLocaleRender();
  const t = useT();
  return (
    <button type="button" className="btn btn-ghost btn-sm auth-back" disabled={disabled} onClick={onClick}>
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
  onSignedIn: (grant: AccountSessionGrant, password?: string, consentAccepted?: boolean) => void;
  onUnverified: (email: string, password: string) => void;
  onSignUp: () => void;
  onForgot: (email: string) => void;
  /** Offered when the server has account recovery codes (feature `recovery-codes`). */
  onRecover?: (email: string) => void;
  onLinkWithPhone: () => void;
}) {
  useLocaleRender();
  const [email, setEmail] = useState(props.initialEmail ?? "");
  const [password, setPassword] = useState("");
  const [help, setHelp] = useState(false);
  const [step, setStep] = useState<"options" | "email">("options");
  const [socialActive, setSocialActive] = useState(false);
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
    if (needsCode && code.replace(/[\s-]/g, "").length < 6) return setError(uiText("auth.interface.enter_the_6_digit_code_from_your_authenticator_app_or_a_backup_co_42c0053"));
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
  if (step === "options") {
    return (
      <div className="auth-form" data-auth-step={socialActive ? "social" : "methods"}>
        {!socialActive && <AuthHeading title={t("signin_title")} sub={t("signin_sub")} />}
        {!socialActive && <FormNotice text={props.notice ?? null} />}
        <SocialSignIn api={props.ctx.accounts.api} onSignedIn={(grant, accepted) => props.onSignedIn(grant, undefined, accepted)} onStepChange={setSocialActive} disabled={busy} />
        {!socialActive && (
          <>
            <div className="auth-divider" aria-hidden="true">
              <span>{t("signin_or")}</span>
            </div>
            <FormError text={error} />
            <button
              type="button"
              className="btn btn-secondary btn-lg"
              disabled={busy}
              onClick={() => {
                setError(null);
                setStep("email");
              }}
            >
              <Mail size={18} /> {t("signin_email_method")}
            </button>
            {props.passkeyRpId && (
              <button type="button" className="btn btn-secondary btn-lg" disabled={busy} onClick={() => passkey(props.passkeyRpId!)}>
                <KeyRound size={18} /> {withPasskey ? t("signin_passkey_busy") : t("signin_passkey")}
              </button>
            )}
            <div className="auth-links">
              <LinkButton onClick={() => setHelp(true)}>{t("signin_trouble")}</LinkButton>
              {props.canSignUp && <LinkButton onClick={props.onSignUp}>{t("signin_create")}</LinkButton>}
            </div>
          </>
        )}
      </div>
    );
  }
  return (
    <form className="auth-form" data-auth-step={needsCode ? "verification" : "email"} onSubmit={submitHandler(submit)} noValidate>
      <Back
        disabled={busy}
        onClick={() => {
          setError(null);
          setCode("");
          if (needsCode) setNeedsCode(false);
          else {
            setPassword("");
            setStep("options");
          }
        }}
      />
      <AuthHeading title={t(needsCode ? "signin_verify_title" : "signin_email_title")} sub={t(needsCode ? "signin_verify_sub" : "signin_email_sub")} />
      <FormNotice text={props.notice ?? null} />
      <FormError text={error} />
      {!needsCode ? (
        <>
          <Field id="si-email" label={t("common_email")}>
            <input
              id="si-email"
              className="input"
              type="email"
              autoComplete="username"
              value={email}
              onInput={(e) => setEmail(e.currentTarget.value)}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
          </Field>
          <Field id="si-password" label={t("common_password")}>
            <PasswordInput
              id="si-password"
              className="input"

              autoComplete="current-password"
              value={password}
              onInput={(e) => setPassword(e.currentTarget.value)}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
        </>
      ) : (
        <Field id="si-code" label={t("signin_code_label")}>
          <input id="si-code" className="input mono" autoComplete="one-time-code" value={code} maxLength={20} onChange={(e) => setCode(e.target.value)} autoFocus />
        </Field>
      )}
      <button className="btn btn-primary btn-lg" disabled={busy}>
        {busy ? t("signin_busy") : t(needsCode ? "signin_verify_button" : "signin_button")}
      </button>
      {!needsCode && (
        <div className="auth-links">
          <LinkButton onClick={() => setHelp(true)}>{t("signin_trouble")}</LinkButton>
        </div>
      )}
    </form>
  );
}
/**
 * The ways back in, shown only after "Having trouble signing in?" (Meldiq Android does the same; meldiq
 * docs/product/MELDIQ_AUTH_FLOW_AUDIT.md). A way is offered only when this server and this browser allow it.
 */
function SignInHelp(props: { onForgot: () => void; onRecover?: () => void; onLinkWithPhone?: () => void; onBack: () => void }) {
  useLocaleRender();
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
  useLocaleRender();
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
export function SignUpForm(props: { ctx: FormContext; inviteRequired: boolean; versionedPolicy: boolean; onSent: (email: string, password: string) => void; onBack: () => void }) {
  useLocaleRender();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [invite, setInvite] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [policy, setPolicy] = useState<RegistrationPolicy | null>(null);
  const [policyError, setPolicyError] = useState(false);
  const [policyAttempt, setPolicyAttempt] = useState(0);
  const { busy, error, setError, run } = useSubmit();
  const t = useT();
  useEffect(() => {
    if (!props.versionedPolicy) return;
    let current = true;
    void props.ctx.accounts
      .registrationPolicy()
      .then((value) => {
        if (current) {
          setPolicy(value);
          setPolicyError(!value);
          setAccepted(false);
        }
      })
      .catch(() => {
        if (current) setPolicyError(true);
      });
    return () => {
      current = false;
    };
  }, [props.ctx.accounts, props.versionedPolicy, policyAttempt]);
  const policyReady = !props.versionedPolicy || policy !== null;
  const submit = () => {
    if (!policyReady) return;
    const problem = nameProblem(name) ?? emailProblem(email) ?? passwordProblem(password, email) ?? (props.inviteRequired && !invite.trim() ? t("signup_invite_missing") : null);
    if (problem) return setError(problem);
    if (!accepted) {
      document.getElementById("su-terms")?.focus();
      return setError(t("auth.foundation.termsRequired"));
    }
    void run(async () => {
      try {
        await props.ctx.accounts.register(name.trim(), normalizeEmail(email), password, invite.trim() || undefined, policy ? acceptRegistrationPolicy(policy) : undefined);
      } catch (e) {
        const current = requestedRegistrationPolicy(e);
        if (current) {
          setPolicy(current);
          setAccepted(false);
        }
        throw e;
      }
      props.onSent(normalizeEmail(email), password);
    });
  };
  return (
    <form className="auth-form" onSubmit={submitHandler(submit)} noValidate>
      <Back onClick={props.onBack} label={t("signup_back")} disabled={busy} />
      <AuthHeading title={t("signup_title")} sub={t("signup_sub")} />
      <FormError text={error} />
      <Field id="su-name" label={t("common_your_name")} hint={t("signup_name_hint")}>
        <input id="su-name" className="input" autoComplete="name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
      <Field id="su-email" label={t("common_email")}>
        <input id="su-email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field id="su-password" label={t("common_password")} hint={t("signup_password_hint", { n: PASSWORD_MIN_LENGTH })}>
        <PasswordInput id="su-password" className="input" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      {props.inviteRequired && (
        <Field id="su-invite" label={t("signup_invite")} hint={t("signup_invite_hint")}>
          <input id="su-invite" className="input" value={invite} onChange={(e) => setInvite(e.target.value)} autoComplete="off" />
        </Field>
      )}
      {policyReady ? (
        <TermsConsent id="su-terms" accepted={accepted} onChange={setAccepted} disabled={busy} policy={policy} />
      ) : policyError ? (
        <div>
          <FormError text={t("errors.generic")} />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setPolicyError(false);
              setPolicyAttempt((n) => n + 1);
            }}
          >
            {t("common.actions.retry")}
          </button>
        </div>
      ) : (
        <p role="status">{t("common.status.loading")}</p>
      )}
      <button className="btn btn-primary btn-lg" disabled={busy || !policyReady}>
        {busy ? t("signup_busy") : t("signup_button")}
      </button>
    </form>
  );
}
// ───────────────────────── email code ─────────────────────────
export function VerifyEmailForm(props: { ctx: FormContext; email: string; password: string; sentAt?: number; onVerified: (grant: AccountSessionGrant) => void; onBack: () => void }) {
  useLocaleRender();
  const t = useT();
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState<string | null>(() => t("verify_sent", { email: props.email }));
  const { busy, error, setError, run } = useSubmit();
  const cooldown = useCodeCooldown(props.sentAt ? props.sentAt + 30_000 : 0);
  const submit = () => {
    const c = cleanVerifyCode(code);
    if (c.length !== 6) return setError(t("verify_enter"));
    void run(async () => {
      await props.ctx.accounts.verifyEmail(props.email, c, props.password);
      props.onVerified(await props.ctx.accounts.login(props.email, props.password, props.ctx.deviceName));
    });
  };
  const resend = () => {
    if (cooldown.seconds || busy) return;
    void run(async () => {
      try {
        await props.ctx.accounts.resendVerification(props.email);
        cooldown.waitUntil(Date.now() + 30_000);
        setNotice(t("verify_resent", { email: props.email }));
      } catch (error) {
        if (error instanceof ApiError && error.status === 429) cooldown.waitUntil(Date.now() + (error.retryAfterMs ?? 30_000));
        throw error;
      }
    });
  };
  return (
    <form className="auth-form" onSubmit={submitHandler(submit)} noValidate>
      <Back onClick={props.onBack} disabled={busy} />
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
        <LinkButton onClick={resend} disabled={busy || cooldown.seconds > 0}>
          {cooldown.seconds ? t("auth.foundation.resendIn", { seconds: cooldown.seconds }) : t("common_send_new_code")}
        </LinkButton>
      </div>
    </form>
  );
}
// ───────────────────────── forgotten password ─────────────────────────
export function ForgotPasswordForm(props: { ctx: FormContext; initialEmail: string; onSent: (email: string) => void; onBack: () => void }) {
  useLocaleRender();
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
  useLocaleRender();
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
        <PasswordInput id="rp-password" className="input" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <button className="btn btn-primary btn-lg" disabled={busy}>
        {busy ? t("common_saving") : t("reset_button")}
      </button>
    </form>
  );
}
