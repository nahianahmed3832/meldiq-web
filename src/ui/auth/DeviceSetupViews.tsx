import { Check, Copy, Download, KeyRound, RefreshCw, ShieldCheck, Smartphone } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import type { AccountView } from "../../api/accountSchemas";
import { createIdentity, enrollWithSeed } from "../../auth/deviceSetup";
import type { SetupCredentials } from "../../auth/setupCredentials";
import { fingerprint } from "../../crypto/identity";
import { decodeRecoveryCode } from "../../crypto/recoveryCode";
import type { DeviceRecord } from "../../model/types";
import { type LinkApproval, LinkError, type PendingLink, pollLinkApproval, startLink } from "../../sync/session";
import { AuthHeading, FormError, LinkButton } from "./AuthFrame";
import { authErrorText, useSubmit } from "./useSubmit";

const POLL_MS = 2000;

// ───────────────────────── first device: make the identity ─────────────────────────

export function CreateIdentityView(props: {
  creds: SetupCredentials;
  account: AccountView;
  deviceName: string;
  onCreated: (device: DeviceRecord, recoveryCode: string) => void;
  onSignOut: () => void;
}) {
  const { busy, error, run } = useSubmit();
  return (
    <div className="auth-form">
      <AuthHeading title="Set up end-to-end encryption" sub={`Signed in as ${props.account.email}.`} />
      <p className="muted" style={{ margin: 0 }}>
        This browser will make your account's encryption keys. They stay on your devices; the server never sees them. You'll get a <b>recovery key</b> to set up your other devices and to get back in
        if you lose this one.
      </p>
      <FormError text={error} />
      <button
        className="btn btn-primary btn-lg"
        disabled={busy}
        onClick={() =>
          void run(async () => {
            const r = await createIdentity(props.creds.accounts, props.account, props.deviceName);
            props.onCreated(r.device, r.recoveryCode);
          })
        }
      >
        <ShieldCheck size={16} /> {busy ? "Making keys…" : "Set up encryption"}
      </button>
      <div className="auth-links">
        <LinkButton onClick={props.onSignOut}>Use a different account</LinkButton>
      </div>
    </div>
  );
}

/** Shows the recovery key once, and won't continue until the person says it's stored. */
export function RecoveryKeyReveal({ code, onDone }: { code: string; onDone: () => void }) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  // The key exists only on this page now: leaving before it's stored loses it.
  useEffect(() => {
    if (saved) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saved]);
  const download = () => {
    const blob = new Blob([`Orbit recovery key\n\n${code}\n\nKeep this somewhere safe. Anyone with it can read your messages.\n`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "orbit-recovery-key.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="auth-form">
      <AuthHeading title="Save your recovery key" sub="It's shown only now. You'll need it to set up a new device without this one." />
      <div className="recovery-key" aria-label="Recovery key">
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
          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={download}>
          <Download size={14} /> Save as a file
        </button>
      </div>
      <div className="banner warn">
        <KeyRound size={16} />
        <span className="grow">Anyone with this key can read your messages. Keep it private, in a password manager or on paper.</span>
      </div>
      <div className="row" style={{ gap: 10, alignItems: "flex-start" }}>
        <input id="rk-saved" type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} style={{ marginTop: 3 }} />
        <label htmlFor="rk-saved">I've stored my recovery key somewhere safe.</label>
      </div>
      <button className="btn btn-primary btn-lg" disabled={!saved} onClick={onDone}>
        Open Orbit
      </button>
    </div>
  );
}

// ───────────────────────── later devices ─────────────────────────

type Way = "phone" | "recovery";

/** Adds this browser to an account that already has keys: approved by another device, or with the recovery key. */
export function AddDeviceView(props: { creds: SetupCredentials; account: AccountView; deviceName: string; onEnrolled: (device: DeviceRecord) => void; onSignOut: () => void }) {
  const [way, setWay] = useState<Way>("phone");
  return (
    <div className="auth-form">
      <AuthHeading title="Set up this browser" sub={`Signed in as ${props.account.email}. To read your messages here, this browser needs your account's keys.`} />
      <div className="segmented auth-ways" role="tablist" aria-label="How to set up this browser">
        <button role="tab" aria-selected={way === "phone"} onClick={() => setWay("phone")}>
          <Smartphone size={14} /> Approve from my phone
        </button>
        <button role="tab" aria-selected={way === "recovery"} onClick={() => setWay("recovery")}>
          <KeyRound size={14} /> Use my recovery key
        </button>
      </div>
      {way === "phone" ? <ApproveFromDevice {...props} /> : <RecoveryKeyEntry {...props} />}
      <div className="auth-links">
        <LinkButton onClick={props.onSignOut}>Use a different account</LinkButton>
      </div>
    </div>
  );
}

function RecoveryKeyEntry(props: { creds: SetupCredentials; account: AccountView; deviceName: string; onEnrolled: (device: DeviceRecord) => void }) {
  const [code, setCode] = useState("");
  const { busy, error, setError, run } = useSubmit();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const seed = await decodeRecoveryCode(code);
      if (!seed) return setError("That recovery key isn't complete or has a typo. Check it and try again.");
      try {
        props.onEnrolled((await enrollWithSeed(props.creds.accounts, props.account, seed, props.deviceName)).device);
      } finally {
        seed.fill(0);
      }
    });
  };
  return (
    <form className="auth-form" onSubmit={submit} noValidate>
      <FormError text={error} />
      <div className="field">
        <label htmlFor="rk-code">Recovery key</label>
        <textarea id="rk-code" className="textarea mono" rows={3} autoComplete="off" spellCheck={false} value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
        <span className="hint">It stays in this browser: only a signature made with it is sent.</span>
      </div>
      <button className="btn btn-primary btn-lg" disabled={busy || !code.trim()}>
        {busy ? "Setting up…" : "Set up this browser"}
      </button>
    </form>
  );
}

type Pairing = { k: "starting" } | { k: "waiting"; link: PendingLink; deviceFp: string } | { k: "finishing" } | { k: "expired" } | { k: "error"; message: string };

function ApproveFromDevice(props: { creds: SetupCredentials; account: AccountView; deviceName: string; onEnrolled: (device: DeviceRecord) => void }) {
  const [state, setState] = useState<Pairing>({ k: "starting" });
  const gen = useRef(0);
  const { creds, account, deviceName, onEnrolled } = props;

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
        onEnrolled((await enrollWithSeed(creds.accounts, account, r.seed, deviceName, state.link.keys)).device);
      } catch (e) {
        setState({ k: "error", message: authErrorText(e) });
      } finally {
        r.seed.fill(0);
      }
    };
    timer = setTimeout(tick, POLL_MS);
    return () => clearTimeout(timer);
  }, [state, creds, account, deviceName, onEnrolled]);

  const code = state.k === "waiting" ? `${state.link.code.slice(0, 5)} ${state.link.code.slice(5)}` : "";
  return (
    <ol className="steps">
      <li>
        <div>
          <strong>On your phone, open Orbit</strong>
          <div className="muted">
            Go to <b>Settings › Devices</b> and tap <b>Approve new device</b>.
          </div>
        </div>
      </li>
      <li>
        <div style={{ display: "grid", gap: 10 }}>
          <strong>Enter this code</strong>
          {state.k === "waiting" ? (
            <div className="code-box">
              <span className="code" aria-label={`Link code ${state.link.code.split("").join(" ")}`}>
                {code}
              </span>
            </div>
          ) : state.k === "expired" || state.k === "error" ? (
            <div className={`banner ${state.k === "error" ? "danger" : "warn"}`} role="alert">
              <span className="grow">{state.k === "error" ? state.message : "That code expired."}</span>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => void begin()}>
                <RefreshCw size={14} /> New code
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
          <strong>Check the device key, then approve</strong>
          <span className="muted">Your phone shows a device key. It must match this one exactly:</span>
          <span className="fingerprint" aria-label="Device key">
            {state.k === "waiting" ? state.deviceFp : "····· ····· ····· ····· ····· ·····"}
          </span>
          <span className="faint" aria-live="polite" style={{ fontSize: 12.5 }}>
            {state.k === "finishing" ? "Approved. Setting up this browser…" : state.k === "waiting" ? "Waiting for your phone to approve…" : ""}
          </span>
        </div>
      </li>
    </ol>
  );
}
