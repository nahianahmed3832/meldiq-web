import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
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
  useLocaleRender();
  const l10n = useLocalization();
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
  const text = shown ? uiText("settings.interface.value0_account_recovery_codes_each_works_once_keep_them_somewhere_4a296ca", { value0: BRAND.name, value1: shown.join("\n") }) : "";
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "meldiq-recovery-codes.txt" });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };
  return (
    <div className="card" style={{ padding: 20, display: "grid", gap: 12 }}>
      <div className="row" style={{ gap: 10, alignItems: "flex-start" }}>
        <LifeBuoy size={18} className="faint" style={{ marginTop: 2 }} />
        <div className="grow" style={{ display: "grid", gap: 4 }}>
          <strong>
            <Localized k="settings.interface.recovery_codes_36880d1" />
          </strong>
          <span className="muted" style={{ fontSize: 13 }}>
            <Localized k="settings.interface.if_you_lose_access_to_your_email_one_of_these_codes_moves_your_ac_6ebfaa1" />
          </span>
          <span style={{ fontSize: 13 }}>
            {status.data
              ? status.data.total
                ? uiText("settings.interface.value0_of_value1_left_value2_6e83ff9", {
                    value0: status.data.remaining,
                    value1: status.data.total,
                    value2: status.data.createdAt ? uiText("settings.interface.made_a070aed", { value0: dayLabel(status.data.createdAt) }) : "",
                  })
                : uiText("settings.interface.you_have_no_recovery_codes_b9cf69f")
              : status.error
                ? status.error
                : l10n("common.common_checking")}
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
            <span className="grow">
              <Localized k="settings.interface.save_these_now_they_won_t_be_shown_again_and_they_replace_any_cod_46fc050" />
            </span>
          </div>
          <div className="recovery-key" aria-label={uiText("settings.interface.recovery_codes_36880d1")}>
            {shown.map((c) => (
              <span key={c} style={{ gridColumn: "span 2" }}>
                {c}
              </span>
            ))}
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => void navigator.clipboard?.writeText(text).then(() => setCopied(true))}>
              <Copy size={14} /> {copied ? l10n("common.common_copied") : l10n("common.actions.copy")}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={download}>
              <Download size={14} /> {l10n("common.actions.download")}
            </button>
            <span className="grow" />
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setShown(null);
                setCopied(false);
              }}
            >
              <Localized k="settings.interface.i_ve_saved_them_578d17a" />
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
            placeholder={uiText("settings.interface.your_password_bbda702")}
            aria-label={uiText("settings.interface.your_password_bbda702")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAsking(null)}>
            {l10n("common.actions.cancel")}
          </button>
          <button className={`btn btn-sm ${asking === "revoke" ? "btn-danger" : "btn-primary"}`} disabled={!password || act.busy}>
            {act.busy ? l10n("common.common_checking") : asking === "make" ? uiText("settings.interface.make_codes_1dba82a") : uiText("settings.interface.revoke_codes_0f5e1f9")}
          </button>
        </form>
      ) : (
        !shown && (
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setAsking("make")}>
              {status.data?.total ? uiText("settings.interface.make_a_new_set_797c345") : uiText("settings.interface.make_recovery_codes_f6c614a")}
            </button>
            {!!status.data?.total && (
              <button className="btn btn-danger-quiet btn-sm" onClick={() => setAsking("revoke")}>
                <Localized k="settings.interface.revoke_87e6d00" />
              </button>
            )}
          </div>
        )
      )}
    </div>
  );
}
