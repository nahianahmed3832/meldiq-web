import { Check, Copy, Download, KeyRound, RefreshCw, ShieldCheck, Smartphone } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import type { AccountView } from "../../api/accountSchemas";
import type { UnlockDelivery } from "../../auth/accountApi";
import { createIdentity, enrollWithEmailCode, enrollWithSeed } from "../../auth/deviceSetup";
import type { SetupCredentials } from "../../auth/setupCredentials";
import { fingerprint } from "../../crypto/identity";
import { decodeRecoveryCode } from "../../crypto/recoveryCode";
import type { DeviceRecord } from "../../model/types";
import { type LinkApproval, LinkError, type PendingLink, pollLinkApproval, startLink } from "../../sync/session";
import { AuthHeading, FormError, LinkButton } from "./AuthFrame";
import { authErrorText, useSubmit } from "./useSubmit";
import { useT } from "../../i18n";

const POLL_MS = 2000;

// ───────────────────────── first device: make the identity ─────────────────────────

export function CreateIdentityView(props: {
  creds: SetupCredentials;
  account: AccountView;
  deviceName: string;
  /** The sign-in password, to back the new keys up (server docs/KEY_BACKUP.md). */
  password?: string;
  onCreated: (device: DeviceRecord, recoveryCode: string) => void;
  onSignOut: () => void;
}) {
  const { busy, error, run } = useSubmit();
  const t = useT();
  return (
    <div className="auth-form">
      <AuthHeading title={t("create_title")} sub={t("create_signed_in", { email: props.account.email })} />
      <p className="muted" style={{ margin: 0 }}>
        {t("create_body")}
      </p>
      <FormError text={error} />
      <button
        className="btn btn-primary btn-lg"
        disabled={busy}
        onClick={() =>
          void run(async () => {
            const r = await createIdentity(props.creds.accounts, props.account, props.deviceName, props.password);
            props.onCreated(r.device, r.recoveryCode);
          })
        }
      >
        <ShieldCheck size={16} /> {busy ? t("create_busy") : t("create_button")}
      </button>
      <div className="auth-links">
        <LinkButton onClick={props.onSignOut}>{t("common_use_other_account")}</LinkButton>
      </div>
    </div>
  );
}

/** Shows the recovery key once, and won't continue until the person says it's stored. */
export function RecoveryKeyReveal({ code, onDone }: { code: string; onDone: () => void }) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const t = useT();
  // The key exists only on this page now: leaving before it's stored loses it.
  useEffect(() => {
    if (saved) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saved]);
  const download = () => {
    const blob = new Blob([`Meldiq recovery key\n\n${code}\n\nKeep this somewhere safe. Anyone with it can read your messages.\n`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "meldiq-recovery-key.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="auth-form">
      <AuthHeading title={t("reveal_title")} sub={t("reveal_sub")} />
      <div className="recovery-key" aria-label={t("common_recovery_key")}>
        {code.split("-").map((g, i) => (
          <span key={i}>{g}</span>
        ))}
      </div>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() =>
            void navigator.clipboard?.writeText(code).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            })
          }
        >
          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? t("common_copied") : t("common_copy")}
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={download}>
          <Download size={14} /> {t("reveal_save_file")}
        </button>
      </div>
      <div className="banner warn">
        <KeyRound size={16} />
        <span className="grow">{t("reveal_warning")}</span>
      </div>
      <div className="row" style={{ gap: 10, alignItems: "flex-start" }}>
        <input id="rk-saved" type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} style={{ marginTop: 3 }} />
        <label htmlFor="rk-saved">{t("reveal_stored")}</label>
      </div>
      <button className="btn btn-primary btn-lg" disabled={!saved} onClick={onDone}>
        {t("reveal_open")}
      </button>
    </div>
  );
}

// ───────────────────────── later devices ─────────────────────────

/** The ways besides the emailed code. */
type OtherWay = "phone" | "recovery";

interface AddDeviceProps {
  creds: SetupCredentials;
  account: AccountView;
  deviceName: string;
  /** The sign-in password: opens the key backup, or backs the keys up once this browser has them. */
  password?: string;
  onEnrolled: (device: DeviceRecord) => void;
}

/**
 * Adds this browser to an account that already has keys. With a key backup for the current password, the emailed code
 * is the one way shown (server docs/KEY_BACKUP.md); approving from the phone and the recovery key open only from
 * "Account recovery". Without a backup they are the only ways, so they're shown at once (meldiq
 * docs/product/MELDIQ_AUTH_FLOW_AUDIT.md).
 */
export function AddDeviceView(props: AddDeviceProps & { onSignOut: () => void }) {
  // The key backup check: which attempt it answers, and whether a backup exists (null: the server couldn't say).
  const [status, setStatus] = useState<{ attempt: number; exists: boolean | null } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [way, setWay] = useState<OtherWay>("phone");
  const [others, setOthers] = useState(false);
  const { creds } = props;
  const t = useT();
  useEffect(() => {
    let live = true;
    creds.accounts
      .keyBackupStatus()
      .then((s) => live && setStatus({ attempt, exists: s.exists }))
      // The server couldn't say: offer the other ways without claiming there's no backup.
      .catch(() => live && setStatus({ attempt, exists: null }));
    return () => {
      live = false;
    };
  }, [creds, attempt]);
  const checking = status?.attempt !== attempt;
  const backup = checking ? null : status.exists;
  const emailWay = backup === true && !others;
  return (
    <div className="auth-form">
      <AuthHeading title={t("setup_title")} sub={t("setup_sub", { email: props.account.email })} />
      {checking ? (
        <p className="muted" role="status" style={{ margin: 0 }}>
          {t("setup_checking")}
        </p>
      ) : emailWay ? (
        <EmailUnlock {...props} onRecovery={() => setOthers(true)} />
      ) : (
        <>
          {backup === true && (
            <p className="muted" style={{ margin: 0 }}>
              {t("setup_other_ways")}
            </p>
          )}
          {backup === false && (
            <p className="hint" style={{ margin: 0 }}>
              {t("setup_no_backup")}
            </p>
          )}
          {backup === null && (
            <div className="banner warn" role="alert">
              <span className="grow">{t("setup_check_failed")}</span>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAttempt((n) => n + 1)}>
                <RefreshCw size={14} /> {t("setup_try_again")}
              </button>
            </div>
          )}
          <div className="segmented auth-ways" role="tablist" aria-label={t("setup_ways")}>
            <button role="tab" aria-selected={way === "phone"} onClick={() => setWay("phone")}>
              <Smartphone size={14} /> {t("setup_way_phone")}
            </button>
            <button role="tab" aria-selected={way === "recovery"} onClick={() => setWay("recovery")}>
              <KeyRound size={14} /> {t("setup_way_recovery")}
            </button>
          </div>
          {way === "phone" ? <ApproveFromDevice {...props} /> : <RecoveryKeyEntry {...props} />}
          {backup === true && (
            <div className="auth-links">
              <LinkButton onClick={() => setOthers(false)}>{t("setup_back_to_email")}</LinkButton>
            </div>
          )}
        </>
      )}
      {!emailWay && (
        <div className="auth-links">
          <LinkButton onClick={props.onSignOut}>{t("common_use_other_account")}</LinkButton>
        </div>
      )}
    </div>
  );
}

/** A code emailed this long ago is still the one to type: opening the page again doesn't send another. */
const RESEND_AFTER_MS = 2 * 60_000;
const SENT_KEY = "meldiq.keyUnlock.sent";

function recentlySentTo(email: string): boolean {
  try {
    const sent = JSON.parse(sessionStorage.getItem(SENT_KEY) ?? "null") as { to?: unknown; at?: unknown } | null;
    return sent?.to === email && typeof sent.at === "number" && Date.now() - sent.at < RESEND_AFTER_MS;
  } catch {
    return false;
  }
}

function rememberSent(email: string): void {
  try {
    sessionStorage.setItem(SENT_KEY, JSON.stringify({ to: email, at: Date.now() }));
  } catch {
    /* a reload sends a new code */
  }
}
/**
 * The key backup (reported 2026-10-23: asking "Email me a code" first was a needless step): the code is emailed as soon
 * as this opens and the screen asks only for it (and the password, if this page lost it). Having trouble? sends a new
 * code or switches account; Account recovery opens the other ways (phone, recovery key). An account made in the admin
 * console (API 0.63.0) may need the tester code it was given instead, or no code: then the password alone unlocks.
 */
function EmailUnlock(props: AddDeviceProps & { onSignOut: () => void; onRecovery: () => void }) {
  const email = props.account.email;
  const [sentTo, setSentTo] = useState<string | null>(() => (recentlySentTo(email) ? email : null));
  const [delivery, setDelivery] = useState<UnlockDelivery>("email");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [trouble, setTrouble] = useState(false);
  const { busy, error, run } = useSubmit();
  const t = useT();
  const enroll = async (c: string | null, pw: string) =>
    props.onEnrolled((await enrollWithEmailCode(props.creds.accounts, props.account, c, pw, props.deviceName)).device);
  const send = () =>
    void run(async () => {
      const started = await props.creds.accounts.startKeyUnlock();
      const how = started.delivery ?? "email";
      setDelivery(how);
      // Only an emailed code is worth not sending again; the other ways cost nothing to start.
      if (how === "email") rememberSent(email);
      setSentTo(started.email);
      if (how === "none" && props.password) await enroll(null, props.password);
    });
  const sentOnce = useRef(false);
  useEffect(() => {
    if (sentOnce.current || recentlySentTo(email)) return;
    sentOnce.current = true;
    send();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sends once when the screen opens; Send a new code sends again
  }, []);
  const needsCode = delivery !== "none";
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run(() => enroll(needsCode ? code : null, props.password ?? password));
  };
  const ready = (!needsCode || code.replace(/\D/g, "").length === 6) && (!!props.password || password.length > 0);
  const status =
    delivery === "fixed_code"
      ? t("setup_fixed_code")
      : delivery === "none"
        ? t("setup_no_code")
        : sentTo
          ? t("setup_code_sent", { email: sentTo })
          : busy
            ? t("setup_code_sending", { email })
            : t("setup_code_will_send", { email });
  return (
    <form className="auth-form" onSubmit={submit} noValidate>
      <p className="muted" role="status" style={{ margin: 0 }}>
        {status}
      </p>
      <FormError text={error} />
      {needsCode && (
        <div className="field">
          <label htmlFor="ku-code">{t("setup_code_label")}</label>
          <input id="ku-code" className="input mono" inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
        </div>
      )}
      {!props.password && (
        <div className="field">
          <label htmlFor="ku-password">{t("common_password")}</label>
          <input id="ku-password" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <span className="hint">{t("setup_password_hint")}</span>
        </div>
      )}
      <button className="btn btn-primary btn-lg" disabled={busy || !ready}>
        {busy && sentTo ? t("setup_unlocking") : t("setup_unlock")}
      </button>
      <div className="auth-links">
        <LinkButton onClick={() => setTrouble((open) => !open)}>{t("setup_trouble")}</LinkButton>
        <LinkButton onClick={props.onRecovery}>{t("setup_recovery")}</LinkButton>
      </div>
      {trouble && (
        <div className="auth-links">
          {delivery === "email" && <LinkButton onClick={send}>{t("common_send_new_code")}</LinkButton>}
          <LinkButton onClick={props.onSignOut}>{t("common_use_other_account")}</LinkButton>
        </div>
      )}
    </form>
  );
}

function RecoveryKeyEntry(props: AddDeviceProps) {
  const [code, setCode] = useState("");
  const { busy, error, setError, run } = useSubmit();
  const t = useT();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const seed = await decodeRecoveryCode(code);
      if (!seed) return setError(t("setup_recovery_bad"));
      try {
        props.onEnrolled((await enrollWithSeed(props.creds.accounts, props.account, seed, props.deviceName, undefined, props.password)).device);
      } finally {
        seed.fill(0);
      }
    });
  };
  return (
    <form className="auth-form" onSubmit={submit} noValidate>
      <FormError text={error} />
      <div className="field">
        <label htmlFor="rk-code">{t("common_recovery_key")}</label>
        <textarea id="rk-code" className="textarea mono" rows={3} autoComplete="off" spellCheck={false} value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
        <span className="hint">{t("setup_recovery_hint")}</span>
      </div>
      <button className="btn btn-primary btn-lg" disabled={busy || !code.trim()}>
        {busy ? t("setup_busy") : t("setup_button")}
      </button>
    </form>
  );
}

type Pairing = { k: "starting" } | { k: "waiting"; link: PendingLink; deviceFp: string } | { k: "finishing" } | { k: "expired" } | { k: "error"; message: string };

function ApproveFromDevice(props: AddDeviceProps) {
  const [state, setState] = useState<Pairing>({ k: "starting" });
  const gen = useRef(0);
  const { creds, account, deviceName, password, onEnrolled } = props;
  const t = useT();

  const begin = async () => {
    const mine = ++gen.current;
    setState({ k: "starting" });
    try {
      const link = await startLink(creds.accounts.api.base, deviceName);
      if (mine === gen.current) setState({ k: "waiting", link, deviceFp: await fingerprint(link.keys.signingPublic) });
    } catch (e) {
      if (mine === gen.current) setState({ k: "error", message: authErrorText(e) });
    }
  };

  useEffect(() => {
    const generation = gen;
    void begin();
    return () => {
      generation.current++; // abandons a request still being made
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- starts once; "New code" restarts it
  }, []);

  useEffect(() => {
    if (state.k !== "waiting") return;
    const mine = gen.current;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (mine !== gen.current) return;
      let r: LinkApproval;
      try {
        r = await pollLinkApproval(creds.accounts.api.base, state.link);
      } catch (e) {
        if (e instanceof LinkError) return setState({ k: "error", message: e.message });
        timer = setTimeout(tick, POLL_MS); // a network hiccup: keep asking
        return;
      }
      if (mine !== gen.current) {
        if (r.status === "approved") r.seed.fill(0);
        return;
      }
      if (r.status === "expired") return setState({ k: "expired" });
      if (r.status === "pending") {
        timer = setTimeout(tick, POLL_MS);
        return;
      }
      setState({ k: "finishing" });
      try {
        onEnrolled((await enrollWithSeed(creds.accounts, account, r.seed, deviceName, state.link.keys, password)).device);
      } catch (e) {
        setState({ k: "error", message: authErrorText(e) });
      } finally {
        r.seed.fill(0);
      }
    };
    timer = setTimeout(tick, POLL_MS);
    return () => clearTimeout(timer);
  }, [state, creds, account, deviceName, password, onEnrolled]);

  const code = state.k === "waiting" ? `${state.link.code.slice(0, 5)} ${state.link.code.slice(5)}` : "";
  return (
    <ol className="steps">
      <li>
        <div>
          <strong>{t("phone_step_open")}</strong>
          <div className="muted">{t("phone_step_open_sub")}</div>
        </div>
      </li>
      <li>
        <div style={{ display: "grid", gap: 10 }}>
          <strong>{t("phone_step_code")}</strong>
          {state.k === "waiting" ? (
            <div className="code-box">
              <span className="code" aria-label={`Link code ${state.link.code.split("").join(" ")}`}>
                {code}
              </span>
            </div>
          ) : state.k === "expired" || state.k === "error" ? (
            <div className={`banner ${state.k === "error" ? "danger" : "warn"}`} role="alert">
              <span className="grow">{state.k === "error" ? state.message : t("phone_expired")}</span>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => void begin()}>
                <RefreshCw size={14} /> {t("phone_new_code")}
              </button>
            </div>
          ) : (
            <div className="code-box" aria-busy="true">
              <span className="skeleton" style={{ width: 220, height: 30 }} />
            </div>
          )}
        </div>
      </li>
      <li>
        <div style={{ display: "grid", gap: 6 }}>
          <strong>{t("phone_step_check")}</strong>
          <span className="muted">{t("phone_step_check_sub")}</span>
          <span className="fingerprint" aria-label="Device key">
            {state.k === "waiting" ? state.deviceFp : "····· ····· ····· ····· ····· ·····"}
          </span>
          <span className="faint" aria-live="polite" style={{ fontSize: 12.5 }}>
            {state.k === "finishing" ? t("phone_finishing") : state.k === "waiting" ? t("phone_waiting") : ""}
          </span>
        </div>
      </li>
    </ol>
  );
}
