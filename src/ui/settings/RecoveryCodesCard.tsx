import { Copy, Download, LifeBuoy } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { AccountApi } from "../../auth/accountApi";
import { BRAND } from "../../application/brand";
import { dayLabel } from "../format";
import { useAction, useLoad } from "../workspace/useLoad";

/**
 * Account recovery codes (android Settings › Security › Recovery codes, server docs/ACCOUNT_RECOVERY.md): ten single-use
 * codes that get the person back into the account if they lose access to its email address. Only counts are ever read
 * back; a new set is shown once and replaces the old one; making or revoking a set needs the password again. They never
 * restore encryption keys: that is the separate encryption recovery key.
 */
export function RecoveryCodesCard() {
  const engine = useEngine();
  const offered = useOrbit((s) => s.server?.features.includes("recovery-codes") ?? false);
  const accounts = new AccountApi(engine.api);
  const [version, setVersion] = useState(0);
  const status = useLoad(() => accounts.recoveryCodesStatus(), [engine, version]);
  const [asking, setAsking] = useState<"make" | "revoke" | null>(null);
  const [password, setPassword] = useState("");
  const [shown, setShown] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);
  const act = useAction();
  if (!offered) return null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!password || !asking) return;
    void act.act(async () => {
      if (asking === "make") setShown((await accounts.makeRecoveryCodes(password)).codes);
      else await accounts.revokeRecoveryCodes(password);
      setPassword("");
      setAsking(null);
      setVersion((v) => v + 1);
    });
  };

  const text = shown ? `${BRAND.name} account recovery codes\nEach works once. Keep them somewhere safe, away from this computer.\n\n${shown.join("\n")}\n` : "";
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "meldiq-recovery-codes.txt" });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  return (
    <div className="card" style={{ padding: 20, display: "grid", gap: 12 }}>
      <div className="row" style={{ gap: 10, alignItems: "flex-start" }}>
        <LifeBuoy size={18} className="faint" style={{ marginTop: 2 }} />
        <div className="grow" style={{ display: "grid", gap: 4 }}>
          <strong>Recovery codes</strong>
          <span className="muted" style={{ fontSize: 13 }}>
            If you lose access to your email, one of these codes moves your account to a new address (sign-in › Lost access to your email?). They don't restore encryption keys; keep your encryption
            recovery key as well.
          </span>
          <span style={{ fontSize: 13 }}>
            {status.data
              ? status.data.total
                ? `${status.data.remaining} of ${status.data.total} left${status.data.createdAt ? ` · made ${dayLabel(status.data.createdAt)}` : ""}`
                : "You have no recovery codes."
              : status.error
                ? status.error
                : "Checking…"}
          </span>
        </div>
      </div>
      {act.error && (
        <div className="banner danger" role="alert">
          {act.error}
        </div>
      )}
      {shown && (
        <div style={{ display: "grid", gap: 10 }}>
          <div className="banner warn" role="status">
            <span className="grow">Save these now. They won't be shown again, and they replace any codes you had before.</span>
          </div>
          <div className="recovery-key" aria-label="Recovery codes">
            {shown.map((c) => (
              <span key={c} style={{ gridColumn: "span 2" }}>
                {c}
              </span>
            ))}
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => void navigator.clipboard?.writeText(text).then(() => setCopied(true))}>
              <Copy size={14} /> {copied ? "Copied" : "Copy"}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={download}>
              <Download size={14} /> Download
            </button>
            <span className="grow" />
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setShown(null);
                setCopied(false);
              }}
            >
              I've saved them
            </button>
          </div>
        </div>
      )}
      {asking ? (
        <form className="row" style={{ gap: 8, flexWrap: "wrap" }} onSubmit={submit}>
          <input
            className="input"
            style={{ flex: "1 1 220px" }}
            type="password"
            autoComplete="current-password"
            placeholder="Your password"
            aria-label="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAsking(null)}>
            Cancel
          </button>
          <button className={`btn btn-sm ${asking === "revoke" ? "btn-danger" : "btn-primary"}`} disabled={!password || act.busy}>
            {act.busy ? "Checking…" : asking === "make" ? "Make codes" : "Revoke codes"}
          </button>
        </form>
      ) : (
        !shown && (
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setAsking("make")}>
              {status.data?.total ? "Make a new set" : "Make recovery codes"}
            </button>
            {!!status.data?.total && (
              <button className="btn btn-danger-quiet btn-sm" onClick={() => setAsking("revoke")}>
                Revoke
              </button>
            )}
          </div>
        )
      )}
    </div>
  );
}
