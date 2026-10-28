import { Eye, EyeOff, Pencil } from "lucide-react";
import { type FormEvent, useState } from "react";
import { ApiError } from "../../api/client";
import { useEngine, useOrbit } from "../../application/orbit";
import { navigate } from "../../application/router";
import { AccountSafetyApi, maskEmail } from "../../sync/accountSafety";
import { myProfile, updateMyProfile } from "../../sync/profile";
import { usePhoto } from "../components/photos";
import { Dialog } from "../components/Overlay";
import { LookAvatar, StyledName, useUserLook } from "../people/NameStyle";
import { useLoad } from "../workspace/useLoad";

type Editing = "displayName" | "username" | "email" | null;

/**
 * Settings › My Account, top (the reference's account card, 2026-10-28): your banner, avatar, name and username with
 * Edit profile; then display name, username and email, each with Edit, the email hidden until Reveal. Changing the
 * email sends a code to the new address (API 0.46.0); the server asks for the password again.
 */
export function AccountOverview({ email, onEmailChanged }: { email: string; onEmailChanged: (email: string) => void }) {
  const engine = useEngine();
  const me = useOrbit((s) => s.me);
  const photoRev = useOrbit((s) => (s.me ? s.users[s.me.userId]?.photoRev : null));
  const emailChange = useOrbit((s) => s.server?.features.includes("email-change") ?? false);
  const profilesRev = useOrbit((s) => s.profilesRev);
  const profile = useLoad(() => myProfile(engine), [engine, profilesRev]);
  const look = useUserLook(me?.userId ?? "");
  const [revealed, setRevealed] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);
  const banner = me?.profileBanner ?? null;
  const bannerUrl = usePhoto("profileBanner", me?.userId ?? "", banner?.rev ?? null, banner?.kind === "gif" ? "image/gif" : banner?.kind === "webp" ? "image/webp" : "image/jpeg");
  if (!me) return null;
  const colors = look.profileStyle?.nameColors ?? (look.profileStyle?.accent ? [look.profileStyle.accent] : null);
  const bannerStyle = bannerUrl
    ? { backgroundImage: `url(${bannerUrl})` }
    : { background: colors ? (colors.length > 1 ? `linear-gradient(120deg, ${colors.join(", ")})` : colors[0]) : "var(--brand-gradient)" };
  const displayName = profile.data?.displayName ?? me.displayName;
  return (
    <div className="card account-card">
      <div className="account-card-banner" style={bannerStyle} aria-hidden="true" />
      <div className="account-card-head">
        <span className="account-card-avatar">
          <LookAvatar userId={me.userId} name={me.displayName} colorIndex={me.avatarColor} photoRev={photoRev} size={84} online />
        </span>
        <span className="lines grow">
          <strong className="account-card-name">
            <StyledName name={displayName} style={look.profileStyle} tag={look.tag} className="ellipsis" />
          </strong>
          <small>@{me.username}</small>
        </span>
        <button className="btn btn-primary btn-sm" onClick={() => navigate({ section: "settings", settingsPage: "profile" })}>
          Edit profile
        </button>
      </div>
      <div className="account-rows">
        <Row label="Display name" value={displayName || <span className="faint">You haven't added a display name yet.</span>} onEdit={() => setEditing("displayName")} />
        <Row label="Username" value={me.username} onEdit={() => setEditing("username")} />
        <Row
          label="Email"
          value={
            <span className="row" style={{ gap: 8, alignItems: "center" }}>
              <span className="ellipsis">{revealed ? email : maskEmail(email)}</span>
              <button type="button" className="text-link" onClick={() => setRevealed((r) => !r)} aria-pressed={revealed}>
                {revealed ? <EyeOff size={13} aria-hidden="true" /> : <Eye size={13} aria-hidden="true" />} {revealed ? "Hide" : "Reveal"}
              </button>
            </span>
          }
          onEdit={emailChange ? () => setEditing("email") : undefined}
        />
      </div>
      {editing === "displayName" && (
        <TextEdit
          title="Change your display name"
          label="Display name"
          initial={displayName}
          max={64}
          hint="What people see. It doesn't have to be unique."
          onSave={(v) => updateMyProfile(engine, { displayName: v })}
          onClose={() => setEditing(null)}
        />
      )}
      {editing === "username" && (
        <TextEdit
          title="Change your username"
          label="Username"
          initial={me.username}
          max={32}
          hint="Letters, digits, dots and underscores. You can change it once an hour; your old one is free for others again."
          onSave={(v) => updateMyProfile(engine, { username: v.replace(/^@/, "") })}
          onClose={() => setEditing(null)}
        />
      )}
      {editing === "email" && <EmailChangeDialog current={email} onClose={() => setEditing(null)} onChanged={onEmailChanged} />}
    </div>
  );
}

function Row({ label, value, onEdit }: { label: string; value: React.ReactNode; onEdit?: () => void }) {
  return (
    <div className="account-row">
      <span className="lines grow">
        <small className="account-row-label">{label}</small>
        <span className="account-row-value">{value}</span>
      </span>
      {onEdit && (
        <button className="btn btn-secondary btn-sm" onClick={onEdit} aria-label={`Edit ${label.toLowerCase()}`}>
          <Pencil size={13} aria-hidden="true" /> Edit
        </button>
      )}
    </div>
  );
}

function TextEdit(p: { title: string; label: string; initial: string; max: number; hint: string; onSave: (v: string) => Promise<unknown>; onClose: () => void }) {
  const [value, setValue] = useState(p.initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    if (!v || v === p.initial) return p.onClose();
    setBusy(true);
    setError(null);
    p.onSave(v)
      .then(p.onClose)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Couldn't save. Try again."))
      .finally(() => setBusy(false));
  };
  return (
    <Dialog title={p.title} onClose={p.onClose}>
      <form className="dialog-body" onSubmit={submit} noValidate>
        <label className="field">
          <span>{p.label}</span>
          <input className="input" value={value} maxLength={p.max} onChange={(e) => setValue(e.target.value)} disabled={busy} data-autofocus />
        </label>
        <small className="faint">{p.hint}</small>
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={p.onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/** Changing the email: the password and the new address, then the code sent there. */
function EmailChangeDialog({ current, onClose, onChanged }: { current: string; onClose: () => void; onChanged: (email: string) => void }) {
  const engine = useEngine();
  const api = new AccountSafetyApi(engine.api);
  const [step, setStep] = useState<{ k: "ask" } | { k: "code"; masked: string }>({ k: "ask" });
  const [password, setPassword] = useState("");
  const [next, setNext] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    fn()
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "That didn't work. Try again."))
      .finally(() => setBusy(false));
  };
  const start = (e: FormEvent) => {
    e.preventDefault();
    if (!password || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.trim())) return setError("Enter your password and the new address.");
    run(async () => {
      const r = await api.emailChangeStart(password, next.trim());
      setStep({ k: "code", masked: r.email });
    });
  };
  const confirm = (e: FormEvent) => {
    e.preventDefault();
    if (code.replace(/\D/g, "").length !== 6) return setError("Enter the 6-digit code.");
    run(async () => {
      const r = await api.emailChangeConfirm(code);
      onChanged(r.email);
      engine.notice("info", "Your email address was changed.");
      onClose();
    });
  };
  return (
    <Dialog title="Change your email" onClose={onClose}>
      {step.k === "ask" ? (
        <form className="dialog-body" onSubmit={start} noValidate>
          <p className="muted" style={{ margin: 0 }}>
            Now {maskEmail(current)}. We'll send a code to the new address; your account changes over once you enter it, and we tell the old address.
          </p>
          <label className="field">
            <span>New email</span>
            <input className="input" type="email" autoComplete="email" value={next} onChange={(e) => setNext(e.target.value)} disabled={busy} data-autofocus />
          </label>
          <label className="field">
            <span>Current password</span>
            <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} />
          </label>
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
              {busy ? "Sending…" : "Send code"}
            </button>
          </div>
        </form>
      ) : (
        <form className="dialog-body" onSubmit={confirm} noValidate>
          <p className="muted" style={{ margin: 0 }}>
            If {step.masked} can be used, a 6-digit code is on its way there. It works for 30 minutes.
          </p>
          <label className="field">
            <span>Code</span>
            <input className="input mono" inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} disabled={busy} data-autofocus />
          </label>
          {error && (
            <div className="banner danger" role="alert">
              {error}
            </div>
          )}
          <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setStep({ k: "ask" })}>
              Back
            </button>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? "Changing…" : "Change email"}
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
