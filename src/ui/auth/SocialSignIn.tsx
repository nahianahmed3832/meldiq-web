import { ArrowLeft } from "lucide-react";
import { AuthHeading } from "./AuthFrame";
import { useT } from "../../i18n";
import { useEffect, useRef, useState } from "react";
import { ApiClient, ApiError } from "../../api/client";
import type { AccountSessionGrant } from "../../api/accountSchemas";
import { completeSocial, socialError, socialProviderName, startSocial, zSocialConfig, type SocialProvider, type SocialReceipt } from "../../auth/socialAuth";
import { browserDeviceName } from "../../sync/session";

export function SocialSignIn({
  api,
  mode = "login",
  password,
  totpCode,
  onSignedIn,
  onLinked,
  deviceProof,
  onStepChange,
  disabled = false,
}: {
  api: ApiClient;
  onStepChange?: (active: boolean) => void;
  disabled?: boolean;
  mode?: "login" | "link";
  password?: string;
  totpCode?: string;
  onSignedIn?: (grant: AccountSessionGrant) => void | Promise<void>;
  onLinked?: () => void;
  deviceProof?: () => Promise<{ deviceId: string; nonce: string; signature: string }>;
}) {
  const [providers, setProviders] = useState<SocialProvider[]>([]);
  const [busy, setBusy] = useState<SocialProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<SocialReceipt | null>(null);
  const [needsInvite, setNeedsInvite] = useState(false);
  const [needsCode, setNeedsCode] = useState(false);
  const [invite, setInvite] = useState("");
  const [code, setCode] = useState("");
  const abort = useRef<AbortController | null>(null);
  const pendingProvider = useRef<SocialProvider>("google");
  const t = useT();
  const dedicated = mode === "login" && !!onStepChange;
  const activeStep = dedicated && (!!busy || !!pending);
  useEffect(() => {
    onStepChange?.(activeStep);
  }, [activeStep, onStepChange]);
  const reset = () => {
    abort.current?.abort();
    setPending(null);
    setBusy(null);
    setError(null);
    setNeedsInvite(false);
    setNeedsCode(false);
    setInvite("");
    setCode("");
  };
  useEffect(() => {
    let live = true;
    api
      .json("GET", "/v2/auth/social/config", zSocialConfig, { auth: false })
      .then((c) => {
        if (live) setProviders(c.providers);
      })
      .catch(() => undefined);
    return () => {
      live = false;
      abort.current?.abort();
    };
  }, [api]);
  const finish = async (receipt: SocialReceipt, initial = false) => {
    setError(null);
    try {
      const result = await completeSocial(
        api,
        receipt,
        {
          deviceName: browserDeviceName(),
          inviteCode: initial ? undefined : invite.trim() || undefined,
          totpCode: initial ? totpCode : code.trim() || totpCode || undefined,
          device: deviceProof ? await deviceProof() : undefined,
        },
        mode === "link",
      );
      setPending(null);
      if ("grant" in result) await onSignedIn?.(result.grant);
      else onLinked?.();
    } catch (e) {
      if (e instanceof ApiError && ["invite_required", "invalid_invite"].includes(e.code)) {
        setNeedsInvite(true);
        setPending(receipt);
      }
      if (e instanceof ApiError && ["totp_required", "totp_invalid"].includes(e.code)) {
        setNeedsCode(true);
        setPending(receipt);
      }
      setError(e instanceof ApiError && ["invite_required", "totp_required"].includes(e.code) ? null : socialError(e));
    }
  };
  const begin = async (provider: SocialProvider) => {
    // Open synchronously so Safari can allow the user-initiated popup.
    const popup = window.open("about:blank", "_blank", "popup,width=500,height=700");
    if (!popup) return setError("Allow pop-ups for Meldiq, then try again.");
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setBusy(provider);
    setError(null);
    setPending(null);
    pendingProvider.current = provider;
    setInvite("");
    setCode("");
    setNeedsCode(false);
    setNeedsInvite(false);
    try {
      await finish(await startSocial(api, popup, provider, { mode, password, totpCode }, controller.signal), true);
    } catch (e) {
      try {
        popup.close();
      } catch {
        /* A provider-isolated popup may have detached its handle. */
      }
      if (!controller.signal.aborted) setError(socialError(e));
    } finally {
      setBusy(null);
    }
  };
  const continuePending = () => {
    if (!pending || busy || (needsInvite && !invite.trim()) || (needsCode && !code.trim())) return;
    setBusy(pendingProvider.current);
    void finish(pending).finally(() => setBusy(null));
  };
  if (!providers.length) return null;
  return (
    <div style={{ display: "grid", gap: 10 }} aria-label="Connected sign-in methods" aria-busy={!!busy}>
      {activeStep && (
        <>
          {pending && (
            <button type="button" className="btn btn-ghost btn-sm auth-back" disabled={!!busy} onClick={reset}>
              <ArrowLeft size={14} /> {t("signin_options_back")}
            </button>
          )}
          <AuthHeading
            title={t(needsCode ? "signin_verify_title" : needsInvite ? "signin_invite_title" : "signin_provider_title", { provider: socialProviderName(pendingProvider.current) })}
            sub={t(needsCode ? "signin_verify_sub" : needsInvite ? "signin_invite_sub" : "signin_provider_sub", { provider: socialProviderName(pendingProvider.current) })}
          />
        </>
      )}
      {!activeStep &&
        providers.map((provider) => (
          <button key={provider} type="button" className="btn btn-secondary btn-lg" disabled={!!busy || disabled} onClick={() => void begin(provider)}>
            {(provider === "google" || provider === "discord") && (
              <img src={`/auth-provider-icons/${provider}.svg`} width={20} height={20} alt="" aria-hidden="true" style={{ flexShrink: 0, objectFit: "contain" }} />
            )}
            <span>{busy === provider ? "Connecting…" : `${mode === "link" ? "Connect" : "Continue with"} ${socialProviderName(provider)}`}</span>
          </button>
        ))}
      {busy && !pending && (
        <div style={{ display: "grid", gap: 6 }}>
          <p className="muted" role="status">
            Complete sign-in in the provider window, then return here.
          </p>
          <button className="btn btn-ghost" type="button" onClick={reset}>
            Cancel sign-in
          </button>
        </div>
      )}
      {error && (
        <p className="banner danger" role="alert">
          {error}
        </p>
      )}
      {pending && (
        <div
          style={{ display: "grid", gap: 8 }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              continuePending();
            }
          }}
        >
          {needsInvite && (
            <label>
              Invitation code
              <input className="input" autoFocus={dedicated} value={invite} onChange={(e) => setInvite(e.target.value)} />
            </label>
          )}
          {needsCode && (
            <label>
              {t("signin_code_label")}
              <input className="input" autoComplete="one-time-code" autoFocus={dedicated} value={code} onChange={(e) => setCode(e.target.value)} />
            </label>
          )}
          <button type="button" className="btn btn-primary" disabled={!!busy || (needsInvite && !invite.trim()) || (needsCode && !code.trim())} onClick={continuePending}>
            {t("common_continue")}
          </button>
        </div>
      )}
    </div>
  );
}
