import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { Bug, Download, LogOut } from "lucide-react";
import { type FormEvent, useState } from "react";
import { ApiError } from "../../api/client";
import { AccountApi } from "../../auth/accountApi";
import { useEngine, useOrbit } from "../../application/orbit";
import { useRoute } from "../../application/router";
import { AccountSafetyApi, BUG_STATUS_LABEL } from "../../sync/accountSafety";
import { signOut } from "../../sync/account";
import { buildDataExport } from "../../sync/dataExport";
import { relative } from "../format";
import { Dialog } from "../components/Overlay";
import { useLoad } from "../workspace/useLoad";
import { APP_VERSION } from "../../application/env";
/**
 * Settings › My Account › Bug hunting (API 0.46.0): report what went wrong and follow what staff said. A report staff
 * confirm or fix earns the Bug Hunter badge on your profile. Only what's typed, the page and the app version are sent.
 */
export function BugReportsCard() {
  useLocaleRender();
  const engine = useEngine();
  const offered = useOrbit((s) => s.server?.features.includes("bug-reports") ?? false);
  const [version, setVersion] = useState(0);
  const mine = useLoad(() => (offered ? new AccountSafetyApi(engine.api).bugReports() : Promise.resolve(null)), [engine, offered, version]);
  const [open, setOpen] = useState(false);
  if (!offered) return null;
  const reports = mine.data?.reports ?? [];
  return (
    <div className="card setting-card">
      <div className="setting-card-head">
        <span className="lines grow">
          <strong>
            <Localized k="settings.interface.bug_hunting_a9dcb3b" />
          </strong>
          <small>
            <Localized k="settings.interface.found_something_broken_or_a_way_to_do_something_you_shouldn_t_rep_7a6de6c" />
          </small>
        </span>
        <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}>
          <Localized k="settings.interface.report_a_bug_65acdd9" slots={[<Bug size={14} />]} />
        </button>
      </div>
      {mine.data?.bugHunter && (
        <span className="badge-pill">
          <Localized k="settings.interface.bug_hunter_215db5b" />
        </span>
      )}
      {reports.length === 0 ? (
        <small className="faint">
          <Localized k="settings.interface.no_bug_reports_yet_5570ae6" />
        </small>
      ) : (
        <ul className="ws-list" aria-label={uiText("settings.interface.your_bug_reports_a6fff4d")}>
          {reports.map((r) => (
            <li key={r.id} className="ws-row">
              <span className="lines grow">
                <span className="ellipsis">{r.summary}</span>
                <small>
                  {relative(r.createdAt)}
                  {r.staffNote ? uiText("calls.interface.value0_9402340", { value0: r.staffNote }) : ""}
                </small>
              </span>
              <span className={`status-badge status-${r.status === "fixed" || r.status === "confirmed" ? "active" : "pending"}`}>{BUG_STATUS_LABEL[r.status] ?? r.status}</span>
            </li>
          ))}
        </ul>
      )}
      {open && (
        <BugReportDialog
          onClose={() => setOpen(false)}
          onSent={() => {
            setOpen(false);
            setVersion((v) => v + 1);
            engine.notice("info", uiText("settings.interface.thanks_your_bug_report_was_sent_9d857e8"));
          }}
        />
      )}
    </div>
  );
}
function BugReportDialog({ onClose, onSent }: { onClose: () => void; onSent: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const route = useRoute();
  const [summary, setSummary] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (summary.trim().length < 4 || details.trim().length < 10) return setError(uiText("settings.interface.give_it_a_short_title_and_say_what_happened_at_least_a_sentence_6e3d7c6"));
    setBusy(true);
    setError(null);
    // The page is the section and settings page only, never a conversation id.
    const page = `/${route.section}${route.section === "settings" ? `/${route.settingsPage}` : ""}`;
    new AccountSafetyApi(engine.api)
      .reportBug(summary.trim(), details.trim(), page, `Meldiq Web ${APP_VERSION}; ${navigator.userAgent}`.slice(0, 200))
      .then(onSent)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : uiText("settings.interface.couldn_t_send_it_try_again_77ae9b5")))
      .finally(() => setBusy(false));
  };
  return (
    <Dialog title={uiText("settings.interface.report_a_bug_f75e0bd")} onClose={onClose}>
      <form className="dialog-body" onSubmit={submit} noValidate>
        <label className="field">
          <span>
            <Localized k="settings.interface.what_s_wrong_in_a_few_words_e4df9ab" />
          </span>
          <input className="input" maxLength={120} value={summary} onChange={(e) => setSummary(e.target.value)} disabled={busy} data-autofocus />
        </label>
        <label className="field">
          <span>
            <Localized k="settings.interface.what_happened_and_how_to_make_it_happen_again_df59ae5" />
          </span>
          <textarea className="input" rows={6} maxLength={4000} value={details} onChange={(e) => setDetails(e.target.value)} disabled={busy} />
        </label>
        <small className="faint">
          <Localized k="settings.interface.we_get_what_you_type_here_this_page_s_name_and_your_browser_s_ver_057210a" />
        </small>
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {l10n("common.actions.cancel")}
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? l10n("common.common_sending") : uiText("messaging.interface.send_report_a44d353")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
/** Settings › My Account › Your data: one JSON file of what this browser holds (sync/dataExport.ts). */
export function DataExportCard() {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const download = () => {
    setBusy(true);
    setError(null);
    buildDataExport(engine)
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `meldiq-data-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
      })
      .catch(() => setError(uiText("settings.interface.couldn_t_build_the_file_try_again_7f69c38")))
      .finally(() => setBusy(false));
  };
  return (
    <div className="card setting-card">
      <div className="setting-card-head">
        <span className="lines grow">
          <strong>
            <Localized k="settings.interface.download_your_data_fdbb4b3" />
          </strong>
          <small>
            <Localized k="settings.interface.your_account_profile_communities_conversations_and_the_messages_l_ee0b5e9" />
          </small>
        </span>
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={download}>
          <Download size={14} /> {busy ? uiText("settings.interface.preparing_5d1fa38") : l10n("common.actions.download")}
        </button>
      </div>
      {error && (
        <div className="banner danger" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
/** Settings › My Account › Log out of all devices: every session of the account ends, this browser's last. */
export function LogOutEverywhereCard({ onSignedOut }: { onSignedOut: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = () => {
    setBusy(true);
    setError(null);
    const accounts = new AccountApi(engine.api);
    // Nothing to back up first: the server keeps every message (API 0.57.0).
    accounts
      .sessions()
      .then(async (list) => {
        for (const s of list.filter((x) => !x.current)) await accounts.endSession(s.id);
        await signOut(engine, true, true);
        onSignedOut();
      })
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : uiText("settings.interface.couldn_t_sign_out_everywhere_try_again_a011118")))
      .finally(() => setBusy(false));
  };
  return (
    <div className="card setting-card danger-zone">
      <div className="setting-card-head">
        <span className="lines grow">
          <strong>
            <Localized k="settings.interface.log_out_of_all_devices_8071d70" />
          </strong>
          <small>
            <Localized k="settings.interface.signs_this_account_out_everywhere_including_here_use_it_if_you_th_13bed71" />
          </small>
        </span>
        <button className="btn btn-danger-quiet btn-sm" onClick={() => setAsking(true)}>
          <Localized k="settings.interface.log_out_everywhere_8029231" slots={[<LogOut size={14} />]} />
        </button>
      </div>
      {asking && (
        <Dialog
          title={uiText("settings.interface.log_out_of_all_devices_c31bf65")}
          onClose={() => setAsking(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setAsking(false)}>
                {l10n("common.actions.cancel")}
              </button>
              <button className="btn btn-danger" disabled={busy} onClick={go}>
                {busy ? uiText("settings.interface.signing_out_08c6bd3") : uiText("settings.interface.log_out_everywhere_317eaad")}
              </button>
            </>
          }
        >
          <div className="dialog-body">
            <p style={{ margin: 0 }}>
              <Localized k="settings.interface.every_phone_and_browser_signed_in_to_your_account_is_signed_out_t_1c6d47c" />
            </p>
            {error && (
              <div className="banner danger" role="alert">
                {error}
              </div>
            )}
          </div>
        </Dialog>
      )}
    </div>
  );
}
