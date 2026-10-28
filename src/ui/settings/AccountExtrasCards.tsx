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
          <strong>Bug hunting</strong>
          <small>Found something broken, or a way to do something you shouldn't? Report it: when we confirm it, you get the Bug Hunter badge.</small>
        </span>
        <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}>
          <Bug size={14} /> Report a bug
        </button>
      </div>
      {mine.data?.bugHunter && <span className="badge-pill">🐞 Bug Hunter</span>}
      {reports.length === 0 ? (
        <small className="faint">No bug reports yet.</small>
      ) : (
        <ul className="ws-list" aria-label="Your bug reports">
          {reports.map((r) => (
            <li key={r.id} className="ws-row">
              <span className="lines grow">
                <span className="ellipsis">{r.summary}</span>
                <small>
                  {relative(r.createdAt)}
                  {r.staffNote ? ` · ${r.staffNote}` : ""}
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
            engine.notice("info", "Thanks! Your bug report was sent.");
          }}
        />
      )}
    </div>
  );
}

function BugReportDialog({ onClose, onSent }: { onClose: () => void; onSent: () => void }) {
  const engine = useEngine();
  const route = useRoute();
  const [summary, setSummary] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (summary.trim().length < 4 || details.trim().length < 10) return setError("Give it a short title and say what happened (at least a sentence).");
    setBusy(true);
    setError(null);
    // The page is the section and settings page only, never a conversation id.
    const page = `/${route.section}${route.section === "settings" ? `/${route.settingsPage}` : ""}`;
    new AccountSafetyApi(engine.api)
      .reportBug(summary.trim(), details.trim(), page, `Meldiq Web ${APP_VERSION}; ${navigator.userAgent}`.slice(0, 200))
      .then(onSent)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Couldn't send it. Try again."))
      .finally(() => setBusy(false));
  };
  return (
    <Dialog title="Report a bug" onClose={onClose}>
      <form className="dialog-body" onSubmit={submit} noValidate>
        <label className="field">
          <span>What's wrong, in a few words</span>
          <input className="input" maxLength={120} value={summary} onChange={(e) => setSummary(e.target.value)} disabled={busy} data-autofocus />
        </label>
        <label className="field">
          <span>What happened, and how to make it happen again</span>
          <textarea className="input" rows={6} maxLength={4000} value={details} onChange={(e) => setDetails(e.target.value)} disabled={busy} />
        </label>
        <small className="faint">We get what you type here, this page's name and your browser's version. Nothing from your messages is sent.</small>
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Sending…" : "Send report"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/** Settings › My Account › Your data: one JSON file of what this browser holds (sync/dataExport.ts). */
export function DataExportCard() {
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
        setTimeout(() => URL.revokeObjectURL(url), 30_000);
      })
      .catch(() => setError("Couldn't build the file. Try again."))
      .finally(() => setBusy(false));
  };
  return (
    <div className="card setting-card">
      <div className="setting-card-head">
        <span className="lines grow">
          <strong>Download your data</strong>
          <small>Your account, profile, communities, conversations and the messages loaded on this page, as one JSON file.</small>
        </span>
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={download}>
          <Download size={14} /> {busy ? "Preparing…" : "Download"}
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
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Couldn't sign out everywhere. Try again."))
      .finally(() => setBusy(false));
  };
  return (
    <div className="card setting-card danger-zone">
      <div className="setting-card-head">
        <span className="lines grow">
          <strong>Log out of all devices</strong>
          <small>Signs this account out everywhere, including here. Use it if you think someone else has your login.</small>
        </span>
        <button className="btn btn-danger-quiet btn-sm" onClick={() => setAsking(true)}>
          <LogOut size={14} /> Log out everywhere
        </button>
      </div>
      {asking && (
        <Dialog
          title="Log out of all devices?"
          onClose={() => setAsking(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setAsking(false)}>
                Cancel
              </button>
              <button className="btn btn-danger" disabled={busy} onClick={go}>
                {busy ? "Signing out…" : "Log out everywhere"}
              </button>
            </>
          }
        >
          <div className="dialog-body">
            <p style={{ margin: 0 }}>
              Every phone and browser signed in to your account is signed out, then this one too. Your chats stay on Meldiq's servers and are all there when you sign in again.
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
