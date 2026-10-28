import { apiBase } from "../../application/config";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AccountSessionGrant, AccountView } from "../../api/accountSchemas";
import { ApiClient } from "../../api/client";
import { type ServerInfo, zServerInfo } from "../../api/schemas";
import { AccountApi } from "../../auth/accountApi";
import { passkeyRpId } from "../../auth/passkeys";
import { SetupCredentials, type SetupSessionEnd } from "../../auth/setupCredentials";
import { RecoverCompleteForm, RecoverStartForm } from "./RecoverForms";
import type { DeviceRecord } from "../../model/types";
import { browserDeviceName } from "../../sync/session";
import { AuthFrame, AuthHeading, FormError } from "./AuthFrame";
import { ForgotPasswordForm, type FormContext, ResetPasswordForm, SignInForm, SignUpForm, VerifyEmailForm } from "./AccountForms";
import { TEST_DEVICE_LINKING } from "../../auth/testLinking";
import { AddDeviceView, CreateIdentityView, RecoveryKeyReveal } from "./DeviceSetupViews";
import { authErrorText } from "./useSubmit";
import { IntroPages, introSeen } from "./IntroPages";
import { useT } from "../../i18n";

type Step =
  | { k: "signIn"; notice?: string; email?: string }
  | { k: "signUp" }
  | { k: "verify"; email: string; password: string }
  | { k: "forgot"; email: string }
  | { k: "reset"; email: string }
  | { k: "recover"; email: string }
  | { k: "recoverConfirm"; ticket: string; newEmail: string }
  | { k: "create"; creds: SetupCredentials; account: AccountView; password?: string }
  | { k: "addDevice"; creds: SetupCredentials; account: AccountView; password?: string }
  | { k: "recoveryKey"; device: DeviceRecord; grant: AccountSessionGrant; code: string }
  | { k: "failed"; message: string };

/**
 * Signed out: Orbit 2.0 sign-in and sign-up, then this browser's encryption setup (docs/ORBIT_2_ARCHITECTURE §2–§5).
 * [onReady] gets the new device and its account session. The old account system's ways in (moving a pre-email account,
 * signing in by linking a phone) were retired here (brief v4 §13); the phone link remains for the browser tests only
 * (auth/testLinking.ts). Existing accounts and their data are untouched.
 */
/** What the sign-in screen says when the session setting this browser up was ended before it finished. */
const SETUP_ENDED: Record<SetupSessionEnd, string> = {
  session_ended:
    "This sign-in was ended before the browser was set up: it was signed out from another device (for example removed from the session list on your phone), or it expired. Sign in again to continue.",
  account_disabled: "This account is disabled.",
};

export function AuthScreen(props: {
  base?: string;
  /** Keeps the new device and its session, before the recovery key is shown (so a reload then doesn't lose the device). */
  onSave: (device: DeviceRecord, grant: AccountSessionGrant) => Promise<void>;
  onReady: (device: DeviceRecord, grant: AccountSessionGrant) => void;
  onLinkWithPhone: () => void;
}) {
  const base = props.base ?? apiBase();
  const [step, setStep] = useState<Step>({ k: "signIn" });
  const [intro, setIntro] = useState(() => !introSeen());
  const [server, setServer] = useState<ServerInfo | null>(null);
  const t = useT();
  const ctx: FormContext = useMemo(() => ({ accounts: AccountApi.anonymous(base), deviceName: browserDeviceName() }), [base]);

  useEffect(() => {
    new ApiClient(base)
      .json("GET", "/v1/server-info", zServerInfo, { auth: false })
      .then(setServer)
      .catch(() => setServer(null));
  }, [base]);

  /**
   * Signed in: set up encryption on this browser. [password] stays in memory for the key backup (unlocking it, or
   * making it once this browser has the keys).
   */
  const signedIn = useCallback(
    (grant: AccountSessionGrant, password?: string) => {
      // Ended from elsewhere before setup finished (e.g. removed in the phone's session list): sign in again, email kept.
      const creds = new SetupCredentials(base, grant, (why) => setStep({ k: "signIn", notice: SETUP_ENDED[why], email: grant.account.email }));
      const account = grant.account;
      setStep(account.identity ? { k: "addDevice", creds, account, password } : { k: "create", creds, account, password });
    },
    [base],
  );

  const accounts = server?.accounts;
  const toSignIn = (notice?: string, email?: string) => setStep({ k: "signIn", notice, email });

  let body;
  switch (step.k) {
    case "signIn":
      body = (
        <SignInForm
          ctx={ctx}
          notice={step.notice ?? (server && !accounts ? t("signin_old_server") : null)}
          initialEmail={step.email}
          canSignUp={accounts?.registration ?? false}
          canLinkWithPhone={TEST_DEVICE_LINKING && (!accounts || accounts.legacyLogin)}
          passkeyRpId={passkeyRpId(server)}
          onSignedIn={(g, password) => signedIn(g, password)}
          onUnverified={(email, password) => setStep({ k: "verify", email, password })}
          onSignUp={() => setStep({ k: "signUp" })}
          onForgot={(email) => setStep({ k: "forgot", email })}
          onRecover={server?.features.includes("recovery-codes") ? (email) => setStep({ k: "recover", email }) : undefined}
          onLinkWithPhone={props.onLinkWithPhone}
        />
      );
      break;
    case "signUp":
      body = <SignUpForm ctx={ctx} inviteRequired={server?.registration === "invite"} onSent={(email, password) => setStep({ k: "verify", email, password })} onBack={() => toSignIn()} />;
      break;
    case "verify":
      body = <VerifyEmailForm ctx={ctx} email={step.email} password={step.password} onVerified={(g) => signedIn(g, step.password)} onBack={() => toSignIn(undefined, step.email)} />;
      break;
    case "recover":
      body = (
        <RecoverStartForm ctx={ctx} initialEmail={step.email} onStarted={(ticket, newEmail) => setStep({ k: "recoverConfirm", ticket, newEmail })} onBack={() => toSignIn(undefined, step.email)} />
      );
      break;
    case "recoverConfirm":
      body = (
        <RecoverCompleteForm
          ctx={ctx}
          ticket={step.ticket}
          newEmail={step.newEmail}
          onDone={(email, left) =>
            toSignIn(
              `Your account now uses ${email}. Sign in with your new password, then set up this browser with your encryption recovery key or your phone. ${left === 1 ? "1 recovery code is" : `${left} recovery codes are`} left; make a new set in Settings › Account when you can.`,
              email,
            )
          }
          onBack={() => setStep({ k: "recover", email: "" })}
        />
      );
      break;
    case "forgot":
      body = <ForgotPasswordForm ctx={ctx} initialEmail={step.email} onSent={(email) => setStep({ k: "reset", email })} onBack={() => toSignIn(undefined, step.email)} />;
      break;
    case "reset":
      body = <ResetPasswordForm ctx={ctx} email={step.email} onDone={() => toSignIn(t("reset_done"), step.email)} onBack={() => setStep({ k: "forgot", email: step.email })} />;
      break;
    case "create":
      body = (
        <CreateIdentityView
          creds={step.creds}
          account={step.account}
          deviceName={ctx.deviceName}
          password={step.password}
          onCreated={(device, code) => {
            const grant = step.creds.grant;
            void props
              .onSave(device, grant)
              .then(() => setStep({ k: "recoveryKey", device, grant, code }))
              .catch((e) => setStep({ k: "failed", message: authErrorText(e) }));
          }}
          onSignOut={() => toSignIn()}
        />
      );
      break;
    case "addDevice":
      body = (
        <AddDeviceView
          creds={step.creds}
          account={step.account}
          deviceName={ctx.deviceName}
          password={step.password}
          onEnrolled={(device) => props.onReady(device, step.creds.grant)}
          onSignOut={() => toSignIn()}
        />
      );
      break;
    case "recoveryKey":
      body = <RecoveryKeyReveal code={step.code} onDone={() => props.onReady(step.device, step.grant)} />;
      break;
    case "failed":
      body = (
        <div className="auth-form">
          <AuthHeading title="This browser couldn't be set up" />
          <FormError text={step.message} />
          <button className="btn btn-primary" onClick={() => toSignIn()}>
            Start again
          </button>
        </div>
      );
      break;
  }

  return (
    <AuthFrame>
      {intro && <IntroPages onDone={() => setIntro(false)} />}
      {body}
    </AuthFrame>
  );
}
