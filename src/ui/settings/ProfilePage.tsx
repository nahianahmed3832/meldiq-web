import { CommunityProfileCard } from "./CommunityProfileCard";
import { ProfileDraftProvider, useProfileDraft } from "./profileDraft";
import { ProfilePreviewCard } from "./ProfilePreviewCard";
import type { ProfileLink } from "../../sync/profile";
import { AtSign, Camera, Check, Copy, X } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { AccountApi } from "../../auth/accountApi";
import { networkAddress } from "../../sync/account";
import { birthdayProblem, myProfile, phoneProblem, removeMyPhoto, setMyPhoto, updateMyProfile } from "../../sync/profile";
import { UserAvatar } from "../components/OrgAvatar";
import { squareJpeg } from "../workspace/photo";
import { useAction, useLoad } from "../workspace/useLoad";
import { ProfileStyleCard } from "./ProfileStyleCard";
import { ConnectionsCard } from "./ConnectionsCard";

/** My Profile: the editor, with your profile card previewed beside it (the reference's layout, 2026-10-29). */
export function ProfilePage() {
  return (
    <ProfileDraftProvider>
      <ProfileEditor />
    </ProfileDraftProvider>
  );
}

/**
 * The person's profile (docs/PROFILE_AND_PRIVACY.md): photo, names, username, bio, birthday and phone. Who sees each is
 * set under Privacy; the photo isn't end-to-end encrypted (the server stores and serves it to its audience).
 */
function ProfileEditor() {
  const engine = useEngine();
  const me = useOrbit((s) => s.me);
  const photoRev = useOrbit((s) => (s.me ? (s.users[s.me.userId]?.photoRev ?? null) : null));
  const [version, setVersion] = useState(0);
  // Changed on another device (API 0.28 user.updated): loaded again; what's being edited here is kept (below).
  const profilesRev = useOrbit((s) => s.profilesRev);
  const profile = useLoad(() => myProfile(engine), [engine, version, profilesRev]);
  const address = useLoad(() => networkAddress(engine), [engine]);
  const [form, setForm] = useState({ displayName: "", firstName: "", lastName: "", username: "", statusText: "", birthday: "", phone: "", pronouns: "", aboutMe: "" });
  // API 0.46.0: up to 5 links (https only), edited as rows.
  const [links, setLinks] = useState<ProfileLink[]>([]);
  const linksOffered = useOrbit((s) => s.server?.features.includes("profile-links") ?? false);
  const pronounsOffered = useOrbit((s) => s.server?.features.includes("pronouns") ?? false);
  const profileMedia = useOrbit((s) => s.server?.features.includes("profile-media") ?? false);
  const nameStyles = useOrbit((s) => s.server?.features.includes("name-styles") ?? false);
  // API 0.65.0: an old username stays yours for 7 days; a name someone else holds is refused (409, said below).
  const usernameHolds = useOrbit((s) => s.server?.features.includes("username-holds") ?? false);
  const [saved, setSaved] = useState(false);
  const save = useAction();
  const photo = useAction();
  const file = useRef<HTMLInputElement>(null);
  const p = profile.data;

  // The values last loaded: a newer load replaces the form only while it still shows them (nothing edited here).
  const shown = useRef<typeof form | null>(null);
  const shownLinks = useRef<ProfileLink[]>([]);
  const baseRevision = useRef<string | undefined>(undefined);
  const [conflict, setConflict] = useState(false);
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
      aboutMe: p.aboutMe ?? "",
    };
    const edited = shown.current !== null && (JSON.stringify(form) !== JSON.stringify(shown.current) || JSON.stringify(links) !== JSON.stringify(shownLinks.current));
    if (edited && baseRevision.current && p.profileRevision !== baseRevision.current) setConflict(true);
    if (!edited) {
      shown.current = next;
      shownLinks.current = p.links;
      baseRevision.current = p.profileRevision;
      setConflict(false);
      setForm(next);
      setLinks(p.links);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the form as it is when a newer profile arrives
  }, [p]);

  const updateDraft = useProfileDraft()?.update;
  useEffect(
    () => updateDraft?.({ displayName: form.displayName, username: form.username, pronouns: form.pronouns, aboutMe: form.aboutMe }),
    [form.displayName, form.username, form.pronouns, form.aboutMe, updateDraft],
  );

  if (!me) return null;
  const field = (k: keyof typeof form) => ({ value: form[k], onChange: (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value })) });
  const badLink = links.find((l) => l.label.trim() === "" || !/^https:\/\/\S+\.\S+/.test(l.url.trim()));
  const problem = !form.displayName.trim()
    ? "Your display name can't be empty."
    : (birthdayProblem(form.birthday) ?? phoneProblem(form.phone) ?? (badLink ? "Each link needs a name and an address starting with https://" : null));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (problem || !p) return;
    void save.act(async () => {
      const change = {
        baseProfileRevision: baseRevision.current,
        statusText: form.statusText.trim() || null,
        firstName: form.firstName.trim() || null,
        lastName: form.lastName.trim() || null,
        birthday: form.birthday.trim() || null,
        phone: form.phone.trim() || null,
        ...(pronounsOffered ? { pronouns: form.pronouns.trim() || null } : {}),
        ...(linksOffered ? { aboutMe: form.aboutMe.trim() || null, links: links.map((l) => ({ label: l.label.trim(), url: l.url.trim() })) } : {}),
        ...(form.username.trim() !== p.username ? { username: form.username.trim() } : {}),
      };
      const name = form.displayName.trim();
      const updated = await updateMyProfile(engine, { ...change, ...(name !== p.displayName ? { displayName: name } : {}) });
      baseRevision.current = updated.profileRevision;
      shown.current = { ...form };
      shownLinks.current = [...links];
      setConflict(false);
      // Keep the login account's name aligned with the saved public profile.
      if (name !== p.displayName && engine.device.account) await new AccountApi(engine.api).rename(name);
      setVersion((v) => v + 1);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  };

  const pick = (f: File | undefined) => {
    if (!f) return;
    void photo.act(async () => setMyPhoto(engine, await squareJpeg(f)));
  };

  const photoControls = (
    <section className="profile-photo-controls" aria-label="Profile picture">
      <h3 className="settings-label">Profile picture</h3>
      <div className="row" style={{ gap: 16, flexWrap: "wrap" }}>
        <UserAvatar userId={me.userId} name={form.displayName || me.displayName} colorIndex={me.avatarColor} photoRev={photoRev} size={64} decorative />
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
      <small className="faint">Upload a JPG, PNG or WebP. Your picture updates immediately.</small>
    </section>
  );

  return (
    <>
      <header className="settings-page-heading">
        <span className="settings-eyebrow">MAKE IT YOURS</span>
        <h1>My Profile</h1>
        <p>A little more you, everywhere you show up.</p>
      </header>
      <div className="profile-columns">
        <div className="profile-main">
          {profileMedia ? <ProfileStyleCard nameStyles={nameStyles} pictureControls={photoControls} /> : photoControls}
          {address.data && <NetworkAddress address={address.data} />}
          <section className="card profile-details" aria-label="Profile details">
            <div>
              <h2>About you</h2>
              <p className="muted">The name, details and story people see on your profile.</p>
            </div>
            <p className="hint" style={{ margin: 0 }}>
              Profile details update your global profile when you choose Save changes. Photo changes save immediately.
            </p>
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
              {linksOffered && (
                <label className="field ws-wide">
                  <span>About me</span>
                  <textarea aria-label="About me" className="input" rows={4} maxLength={300} placeholder="Say something about yourself." {...field("aboutMe")} />
                  <small className="faint" style={{ justifySelf: "end" }}>
                    {300 - form.aboutMe.length} left
                  </small>
                </label>
              )}
              {linksOffered && (
                <div className="field ws-wide">
                  <span>Links</span>
                  {links.map((l, i) => (
                    <div key={i} className="row link-row" style={{ gap: 8 }}>
                      <input
                        className="input"
                        style={{ maxWidth: 160 }}
                        maxLength={40}
                        placeholder="Name"
                        aria-label={`Link ${i + 1} name`}
                        value={l.label}
                        onChange={(e) => setLinks((all) => all.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                      />
                      <input
                        className="input grow"
                        maxLength={300}
                        placeholder="https://"
                        aria-label={`Link ${i + 1} address`}
                        value={l.url}
                        onChange={(e) => setLinks((all) => all.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
                      />
                      <button type="button" className="icon-btn" aria-label={`Remove link ${i + 1}`} onClick={() => setLinks((all) => all.filter((_, j) => j !== i))}>
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                  {links.length < 5 && (
                    <button type="button" className="btn btn-ghost btn-sm" style={{ justifySelf: "start" }} onClick={() => setLinks((all) => [...all, { label: "", url: "https://" }])}>
                      + Add link
                    </button>
                  )}
                </div>
              )}
              <label className="field">
                <span>Birthday</span>
                <input className="input" placeholder="YYYY-MM-DD or --MM-DD" {...field("birthday")} />
              </label>
              <label className="field">
                <span>Phone</span>
                <input className="input" type="tel" autoComplete="tel" placeholder="+8801712345678" {...field("phone")} />
              </label>
              <p className="faint ws-wide" style={{ margin: 0, fontSize: 12.5 }}>
                {usernameHolds
                  ? "When you change your username, the old one stays yours for 7 days, so you can take it back; then anyone can have it. You can change it once an hour."
                  : "Changing your username frees the old one: links, mentions and addresses that used it stop working. You can change it once an hour."}{" "}
                Who sees each field is set under Privacy & security.
              </p>
              {(save.error || (problem && form.displayName)) && (
                <div className="banner danger ws-wide" role="alert">
                  {save.error ?? problem}
                </div>
              )}
              {conflict && (
                <div className="banner warn ws-wide" role="alert">
                  Your profile changed on another device. Your draft is kept. Reload the latest profile before applying it.
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      shown.current = null;
                      profile.reload();
                      setConflict(false);
                    }}
                  >
                    Reload latest profile
                  </button>
                </div>
              )}
              {profile.error && <div className="banner danger ws-wide">{profile.error}</div>}
              <div className="ws-form-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={!p || !shown.current || save.busy}
                  onClick={() => {
                    if (!shown.current || !p) return;
                    shown.current = null;
                    setForm({
                      displayName: p.displayName,
                      firstName: p.firstName ?? "",
                      lastName: p.lastName ?? "",
                      username: p.username,
                      statusText: p.statusText ?? "",
                      birthday: p.birthday ?? "",
                      phone: p.phone ?? "",
                      pronouns: p.pronouns ?? "",
                      aboutMe: p.aboutMe ?? "",
                    });
                    setLinks(p.links);
                    baseRevision.current = p.profileRevision;
                    shownLinks.current = p.links;
                    setConflict(false);
                    profile.reload();
                    setSaved(false);
                  }}
                >
                  Reset unsaved changes
                </button>
                <button className="btn btn-primary" disabled={!p || !!problem || save.busy || conflict}>
                  {saved ? "Saved" : save.busy ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          </section>
          <CommunityProfileCard aboutMe={form.aboutMe} pronouns={form.pronouns} />
          <ConnectionsCard />
        </div>
        <ProfilePreviewCard />
      </div>
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
