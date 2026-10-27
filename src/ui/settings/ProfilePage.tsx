import { NameStyleCard } from "./NameStyleCard";
import { AtSign, Camera, Check, Copy } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { AccountApi } from "../../auth/accountApi";
import { networkAddress } from "../../sync/account";
import { birthdayProblem, myProfile, phoneProblem, removeMyPhoto, setMyPhoto, updateMyProfile } from "../../sync/profile";
import { UserAvatar } from "../components/OrgAvatar";
import { squareJpeg } from "../workspace/photo";
import { useAction, useLoad } from "../workspace/useLoad";
import { ProfileStyleCard } from "./ProfileStyleCard";

/**
 * The person's profile (docs/PROFILE_AND_PRIVACY.md): photo, names, username, bio, birthday and phone. Who sees each is
 * set under Privacy; the photo isn't end-to-end encrypted (the server stores and serves it to its audience).
 */
export function ProfilePage() {
  const engine = useEngine();
  const me = useOrbit((s) => s.me);
  const photoRev = useOrbit((s) => (s.me ? (s.users[s.me.userId]?.photoRev ?? null) : null));
  const [version, setVersion] = useState(0);
  // Changed on another device (API 0.28 user.updated): loaded again; what's being edited here is kept (below).
  const profilesRev = useOrbit((s) => s.profilesRev);
  const profile = useLoad(() => myProfile(engine), [engine, version, profilesRev]);
  const address = useLoad(() => networkAddress(engine), [engine]);
  const [form, setForm] = useState({ displayName: "", firstName: "", lastName: "", username: "", statusText: "", birthday: "", phone: "", pronouns: "" });
  const pronounsOffered = useOrbit((s) => s.server?.features.includes("pronouns") ?? false);
  const profileMedia = useOrbit((s) => s.server?.features.includes("profile-media") ?? false);
  const nameStyles = useOrbit((s) => s.server?.features.includes("name-styles") ?? false);
  const [saved, setSaved] = useState(false);
  const save = useAction();
  const photo = useAction();
  const file = useRef<HTMLInputElement>(null);
  const p = profile.data;

  // The values last loaded: a newer load replaces the form only while it still shows them (nothing edited here).
  const shown = useRef<typeof form | null>(null);
  useEffect(() => {
    if (!p) return;
    const next = {
      displayName: p.displayName,
      firstName: p.firstName ?? "",
      lastName: p.lastName ?? "",
      username: p.username,
      statusText: p.statusText ?? "",
      birthday: p.birthday ?? "",
      phone: p.phone ?? "",
      pronouns: p.pronouns ?? "",
    };
    const edited = shown.current !== null && JSON.stringify(form) !== JSON.stringify(shown.current);
    shown.current = next;
    if (!edited) setForm(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the form as it is when a newer profile arrives
  }, [p]);

  if (!me) return null;
  const field = (k: keyof typeof form) => ({ value: form[k], onChange: (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value })) });
  const problem = !form.displayName.trim() ? "Your display name can't be empty." : (birthdayProblem(form.birthday) ?? phoneProblem(form.phone));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (problem || !p) return;
    void save.act(async () => {
      const change = {
        statusText: form.statusText.trim() || null,
        firstName: form.firstName.trim() || null,
        lastName: form.lastName.trim() || null,
        birthday: form.birthday.trim() || null,
        phone: form.phone.trim() || null,
        ...(pronounsOffered ? { pronouns: form.pronouns.trim() || null } : {}),
        ...(form.username.trim() !== p.username ? { username: form.username.trim() } : {}),
      };
      // An Orbit 2.0 account keeps its name and the encryption identity's display name together (PATCH /v2/account).
      if (form.displayName.trim() !== p.displayName) {
        if (engine.device.account) await new AccountApi(engine.api).rename(form.displayName.trim());
        else await updateMyProfile(engine, { displayName: form.displayName.trim() });
      }
      await updateMyProfile(engine, change);
      setVersion((v) => v + 1);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  };

  const pick = (f: File | undefined) => {
    if (!f) return;
    void photo.act(async () => setMyPhoto(engine, await squareJpeg(f)));
  };

  return (
    <>
      <h1>Profile</h1>
      {address.data && <NetworkAddress address={address.data} />}
      <div className="card" style={{ padding: 20, display: "grid", gap: 18 }}>
        <div className="row" style={{ gap: 16, flexWrap: "wrap" }}>
          <UserAvatar userId={me.userId} name={form.displayName || me.displayName} colorIndex={me.avatarColor} photoRev={photoRev} size={64} decorative />
          <div className="grow">
            <div style={{ fontWeight: 700, fontSize: 16 }}>{form.displayName || me.displayName}</div>
            <div className="faint">@{me.username}</div>
          </div>
          <input ref={file} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
          <button className="btn btn-secondary btn-sm" disabled={photo.busy} onClick={() => file.current?.click()}>
            <Camera size={14} /> {photoRev ? "Change photo" : "Add photo"}
          </button>
          {photoRev && (
            <button className="btn btn-ghost btn-sm" disabled={photo.busy} onClick={() => void photo.act(() => removeMyPhoto(engine))}>
              Remove
            </button>
          )}
        </div>
        {photo.error && (
          <div className="banner danger" role="alert">
            {photo.error}
          </div>
        )}
        <form onSubmit={submit} className="ws-form" noValidate>
          <label className="field">
            <span>Display name</span>
            <input className="input" maxLength={80} {...field("displayName")} />
          </label>
          <label className="field">
            <span>Username</span>
            <input className="input" maxLength={24} autoComplete="off" spellCheck={false} {...field("username")} />
          </label>
          <label className="field">
            <span>First name</span>
            <input className="input" maxLength={40} autoComplete="given-name" {...field("firstName")} />
          </label>
          <label className="field">
            <span>Last name</span>
            <input className="input" maxLength={40} autoComplete="family-name" {...field("lastName")} />
          </label>
          {pronounsOffered && (
            <label className="field">
              <span>Pronouns (optional)</span>
              <input className="input" maxLength={40} placeholder="e.g. she/her" {...field("pronouns")} />
            </label>
          )}
          <label className="field ws-wide">
            <span>Bio</span>
            <input className="input" maxLength={140} placeholder="What are you up to?" {...field("statusText")} />
          </label>
          <label className="field">
            <span>Birthday</span>
            <input className="input" placeholder="YYYY-MM-DD or --MM-DD" {...field("birthday")} />
          </label>
          <label className="field">
            <span>Phone</span>
            <input className="input" type="tel" autoComplete="tel" placeholder="+8801712345678" {...field("phone")} />
          </label>
          <p className="faint ws-wide" style={{ margin: 0, fontSize: 12.5 }}>
            Changing your username frees the old one: links, mentions and addresses that used it stop working. You can change it once an hour. Who sees each field is set under Privacy & security.
          </p>
          {(save.error || (problem && form.displayName)) && (
            <div className="banner danger ws-wide" role="alert">
              {save.error ?? problem}
            </div>
          )}
          {profile.error && <div className="banner danger ws-wide">{profile.error}</div>}
          <div className="ws-form-actions">
            <button className="btn btn-primary" disabled={!p || !!problem || save.busy}>
              {saved ? "Saved" : save.busy ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
      {profileMedia && <ProfileStyleCard />}
      {nameStyles && <NameStyleCard />}
    </>
  );
}

/** Your address on the Meldiq network (android Settings): people on other servers message you with it. */
function NetworkAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="card setting">
      <div className="lines">
        <strong className="row" style={{ gap: 6 }}>
          <AtSign size={15} /> {address}
        </strong>
        <small>Your address on the Meldiq network. Share it so people on other servers can message you.</small>
      </div>
      <button className="btn btn-secondary btn-sm" onClick={() => void navigator.clipboard?.writeText(address).then(() => setCopied(true))}>
        {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
