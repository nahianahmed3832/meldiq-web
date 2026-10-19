import { useCallback, useEffect, useMemo, useState } from "react";
import type { AccountSessionGrant, AccountView, LegacyTicket } from "../../api/accountSchemas";
import { ApiClient } from "../../api/client";
import { type ServerInfo, zServerInfo } from "../../api/schemas";
import { AccountApi } from "../../auth/accountApi";
import { enrollWithSeed } from "../../auth/deviceSetup";
import { SetupCredentials } from "../../auth/setupCredentials";
import type { DeviceRecord } from "../../model/types";
import { browserDeviceName } from "../../sync/session";
import { AuthFrame, AuthHeading, FormError } from "./AuthFrame";
import { ForgotPasswordForm, type FormContext, LegacyDetailsForm, LegacyVerifyForm, ResetPasswordForm, SignInForm, SignUpForm, VerifyEmailForm } from "./AccountForms";
import { AddDeviceView, CreateIdentityView, RecoveryKeyReveal } from "./DeviceSetupViews";
import { authErrorText } from "./useSubmit";

type Step =
  | { k: "signIn"; notice?: string; email?: string }
  | { k: "signUp" }
  | { k: "verify"; email: string; password: string }
  | { k: "forgot"; email: string }
  | { k: "reset"; email: string }
  | { k: "legacy" }
  | { k: "legacyDetails"; ticket: LegacyTicket }
  | { k: "create"; creds: SetupCredentials; account: AccountView }
  | { k: "addDevice"; creds: SetupCredentials; account: AccountView }
  | { k: "enrolling" }
  | { k: "recoveryKey"; device: DeviceRecord; grant: AccountSessionGrant; code: string }
  | { k: "failed"; message: string };

/**
 * Signed out: Orbit 2.0 sign-in and sign-up, then this browser's encryption setup (docs/ORBIT_2_ARCHITECTURE §2–§5).
 * [onReady] gets the new device and its account session. [onLinkWithPhone] opens the older phone-only linking, offered
 * while the server still accepts device-key sign-in.
 */
export function AuthScreen(props: {
  base?: string;
  /** Keeps the new device and its session, before the recovery key is shown (so a reload then doesn't lose the device). */
  onSave: (device: DeviceRecord, grant: AccountSessionGrant) => Promise<void>;
  onReady: (device: DeviceRecord, grant: AccountSessionGrant) => void;
  onLinkWithPhone: () => void;
}) {
  const base = props.base ?? "";
  const [step, setStep] = useState<Step>({ k: "signIn" });
  const [server, setServer] = useState<ServerInfo | null>(null);
  // A legacy account's identity seed, from its recovery key: sets up this browser right after the move, then is wiped.
  const [legacySeed, setLegacySeed] = useState<Uint8Array | null>(null);
  const ctx: FormContext = useMemo(() => ({ accounts: AccountApi.anonymous(base), deviceName: browserDeviceName() }), [base]);

  useEffect(() => {
    new ApiClient(base)
      .json("GET", "/v1/server-info", zServerInfo, { auth: false })
      .then(setServer)
      .catch(() => setServer(null));
  }, [base]);

  useEffect(
    () => () => {
      legacySeed?.fill(0);
    },
    [legacySeed],
  );

  const forgetSeed = useCallback(() => {
    setLegacySeed((s) => {
      s?.fill(0);
      return null;
    });
  }, []);

  /** Signed in: set up encryption on this browser, or (after a move) do it at once with the recovery key typed earlier. */
  const signedIn = useCallback(
    async (grant: AccountSessionGrant) => {
      const creds = new SetupCredentials(base, grant);
      const account = grant.account;
      if (!account.identity) return setStep({ k: "create", creds, account });
      if (!legacySeed) return setStep({ k: "addDevice", creds, account });
      setStep({ k: "enrolling" });
      try {
        const { device } = await enrollWithSeed(creds.accounts, account, legacySeed, ctx.deviceName);
        props.onReady(device, creds.grant);
      } catch (e) {
        setStep({ k: "failed", message: authErrorText(e) });
      } finally {
        forgetSeed();
      }
    },
    [base, ctx.deviceName, legacySeed, forgetSeed, props],
  );

  const accounts = server?.accounts;
  const toSignIn = (notice?: string, email?: string) => {
    forgetSeed();
    setStep({ k: "signIn", notice, email });
  };

  let body;
  switch (step.k) {
    case "signIn":
      body = (
        <SignInForm
          ctx={ctx}
          notice={step.notice ?? (server && !accounts ? "This Orbit server is older than email accounts. Link this browser with your phone instead." : null)}
          initialEmail={step.email}
          canSignUp={accounts?.registration ?? false}
          canMove={(accounts?.legacyMigration ?? false) && (accounts?.registration ?? false)}
          canLinkWithPhone={!accounts || accounts.legacyLogin}
          onSignedIn={(g) => void signedIn(g)}
          onUnverified={(email, password) => setStep({ k: "verify", email, password })}
          onSignUp={() => setStep({ k: "signUp" })}
          onForgot={(email) => setStep({ k: "forgot", email })}
          onMove={() => setStep({ k: "legacy" })}
          onLinkWithPhone={props.onLinkWithPhone}
        />
      );
      break;
    case "signUp":
      body = <SignUpForm ctx={ctx} inviteRequired={server?.registration === "invite"} onSent={(email, password) => setStep({ k: "verify", email, password })} onBack={() => toSignIn()} />;
      break;
    case "verify":
      body = <VerifyEmailForm ctx={ctx} email={step.email} password={step.password} onVerified={(g) => void signedIn(g)} onBack={() => toSignIn(undefined, step.email)} />;
      break;
    case "forgot":
      body = <ForgotPasswordForm ctx={ctx} initialEmail={step.email} onSent={(email) => setStep({ k: "reset", email })} onBack={() => toSignIn(undefined, step.email)} />;
      break;
    case "reset":
      body = (
        <ResetPasswordForm
          ctx={ctx}
          email={step.email}
          onDone={() => toSignIn("Your password was changed and every session signed out. Sign in with the new one.", step.email)}
          onBack={() => setStep({ k: "forgot", email: step.email })}
        />
      );
      break;
    case "legacy":
      body = (
        <LegacyVerifyForm
          ctx={ctx}
          onVerified={(ticket, seed) => {
            setLegacySeed(seed);
            setStep({ k: "legacyDetails", ticket });
          }}
          onBack={() => toSignIn()}
        />
      );
      break;
    case "legacyDetails":
      body = <LegacyDetailsForm ctx={ctx} ticket={step.ticket} onSent={(email, password) => setStep({ k: "verify", email, password })} onBack={() => toSignIn()} />;
      break;
    case "create":
      body = (
        <CreateIdentityView
          creds={step.creds}
          account={step.account}
          deviceName={ctx.deviceName}
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
      body = <AddDeviceView creds={step.creds} account={step.account} deviceName={ctx.deviceName} onEnrolled={(device) => props.onReady(device, step.creds.grant)} onSignOut={() => toSignIn()} />;
      break;
    case "enrolling":
      body = <AuthHeading title="Setting up this browser…" sub="Certifying this browser's keys with your account's identity." />;
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
      {body}
      <div className="link-meta">
        <span>
          Server: {location.host}
          {server ? ` · ${server.instanceName ?? "Orbit"} ${server.version}` : ""}
        </span>
      </div>
    </AuthFrame>
  );
}
