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
}: {
  api: ApiClient;
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
      setError(socialError(e));
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
      setError(socialError(e));
    } finally {
      setBusy(null);
    }
  };
  if (!providers.length) return null;
  return (
    <div style={{ display: "grid", gap: 10 }} aria-label="Connected sign-in methods">
      {providers.map((provider) => (
        <button key={provider} type="button" className="btn btn-secondary btn-lg" disabled={!!busy} onClick={() => void begin(provider)}>
          {(provider === "google" || provider === "discord") && (
            <img src={`/auth-provider-icons/${provider}.svg`} width={20} height={20} alt="" aria-hidden="true" style={{ flexShrink: 0, objectFit: "contain" }} />
          )}
          <span>{busy === provider ? "Connecting…" : `${mode === "link" ? "Connect" : "Continue with"} ${socialProviderName(provider)}`}</span>
        </button>
      ))}
      {busy && (
        <div style={{ display: "grid", gap: 6 }}>
          <p className="muted" role="status">
            Complete sign-in in the provider window, then return here.
          </p>
          <button className="btn btn-ghost" type="button" onClick={() => abort.current?.abort()}>
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
        <div style={{ display: "grid", gap: 8 }}>
          {needsInvite && (
            <label>
              Invitation code
              <input className="input" value={invite} onChange={(e) => setInvite(e.target.value)} />
            </label>
          )}
          {needsCode && (
            <label>
              Authenticator or backup code
              <input className="input" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} />
            </label>
          )}
          <button
            type="button"
            className="btn btn-primary"
            disabled={!!busy || (needsInvite && !invite.trim()) || (needsCode && !code.trim())}
            onClick={() => {
              setBusy(pendingProvider.current);
              void finish(pending).finally(() => setBusy(null));
            }}
          >
            Continue
          </button>
        </div>
      )}
    </div>
  );
}
