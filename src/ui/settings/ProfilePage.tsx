import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
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
  useLocaleRender();
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
  useLocaleRender();
  const l10n = useLocalization();
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
  const field = (k: keyof typeof form) => ({
    value: form[k],
    onChange: (e: {
      target: {
        value: string;
      };
    }) => setForm((f) => ({ ...f, [k]: e.target.value })),
  });
  const badLink = links.find((l) => l.label.trim() === "" || !/^https:\/\/\S+\.\S+/.test(l.url.trim()));
  const problem = !form.displayName.trim()
    ? uiText("settings.interface.your_display_name_can_t_be_empty_9a76167")
    : (birthdayProblem(form.birthday) ?? phoneProblem(form.phone) ?? (badLink ? uiText("settings.interface.each_link_needs_a_name_and_an_address_starting_with_https_b660cf1") : null));
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
    <section className="profile-photo-controls" aria-label={uiText("settings.interface.profile_picture_a7acc4e")}>
      <h3 className="settings-label">
        <Localized k="settings.interface.profile_picture_a7acc4e" />
      </h3>
      <div className="row" style={{ gap: 16, flexWrap: "wrap" }}>
        <UserAvatar userId={me.userId} name={form.displayName || me.displayName} colorIndex={me.avatarColor} photoRev={photoRev} size={64} decorative />
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
        <button className="btn btn-secondary btn-sm" disabled={photo.busy} onClick={() => file.current?.click()}>
          <Camera size={14} /> {photoRev ? uiText("settings.interface.change_photo_c5fbcb8") : uiText("settings.interface.add_photo_c0660be")}
        </button>
        {photoRev && (
          <button className="btn btn-ghost btn-sm" disabled={photo.busy} onClick={() => void photo.act(() => removeMyPhoto(engine))}>
            {l10n("common.actions.remove")}
          </button>
        )}
      </div>
      {photo.error && (
        <div className="banner danger" role="alert">
          {photo.error}
        </div>
      )}
      <small className="faint">
        <Localized k="settings.interface.upload_a_jpg_png_or_webp_your_picture_updates_immediately_a3f837c" />
      </small>
    </section>
  );
  return (
    <>
      <header className="settings-page-heading">
        <span className="settings-eyebrow">
          <Localized k="settings.interface.make_it_yours_53dab2e" />
        </span>
        <h1>{l10n("settings.settings_profile")}</h1>
        <p>
          <Localized k="settings.interface.a_little_more_you_everywhere_you_show_up_a48feff" />
        </p>
      </header>
      <div className="profile-columns">
        <div className="profile-main">
          {profileMedia ? <ProfileStyleCard nameStyles={nameStyles} pictureControls={photoControls} /> : photoControls}
          {address.data && <NetworkAddress address={address.data} />}
          <section className="card profile-details" aria-label={uiText("settings.interface.profile_details_73949bb")}>
            <div>
              <h2>
                <Localized k="settings.interface.about_you_428f4d0" />
              </h2>
              <p className="muted">
                <Localized k="settings.interface.the_name_details_and_story_people_see_on_your_profile_7e78ec9" />
              </p>
            </div>
            <p className="hint" style={{ margin: 0 }}>
              <Localized k="settings.interface.profile_details_update_your_global_profile_when_you_choose_save_c_7f28923" />
            </p>
            <form onSubmit={submit} className="ws-form" noValidate>
              <label className="field">
                <span>
                  <Localized k="settings.interface.display_name_2b7f6a8" />
                </span>
                <input className="input" maxLength={80} {...field("displayName")} />
              </label>
              <label className="field">
                <span>{l10n("auth.username")}</span>
                <input className="input" maxLength={24} autoComplete="off" spellCheck={false} {...field("username")} />
              </label>
              <label className="field">
                <span>
                  <Localized k="settings.interface.first_name_702ef92" />
                </span>
                <input className="input" maxLength={40} autoComplete="given-name" {...field("firstName")} />
              </label>
              <label className="field">
                <span>
                  <Localized k="settings.interface.last_name_7b48880" />
                </span>
                <input className="input" maxLength={40} autoComplete="family-name" {...field("lastName")} />
              </label>
              {pronounsOffered && (
                <label className="field">
                  <span>
                    <Localized k="settings.interface.pronouns_optional_49de8c3" />
                  </span>
                  <input className="input" maxLength={40} placeholder={uiText("settings.interface.e_g_she_her_b3a2c25")} {...field("pronouns")} />
                </label>
              )}
              <label className="field ws-wide">
                <span>
                  <Localized k="settings.interface.bio_3933b18" />
                </span>
                <input className="input" maxLength={140} placeholder={uiText("settings.interface.what_are_you_up_to_c1d70b5")} {...field("statusText")} />
              </label>
              {linksOffered && (
                <label className="field ws-wide">
                  <span>
                    <Localized k="files.interface.about_me_1359ec8" />
                  </span>
                  <textarea
                    aria-label={uiText("files.interface.about_me_1359ec8")}
                    className="input"
                    rows={4}
                    maxLength={300}
                    placeholder={uiText("settings.interface.say_something_about_yourself_132dca6")}
                    {...field("aboutMe")}
                  />
                  <small className="faint" style={{ justifySelf: "end" }}>
                    <Localized k="settings.interface.left_084472e" slots={[300 - form.aboutMe.length]} />
                  </small>
                </label>
              )}
              {linksOffered && (
                <div className="field ws-wide">
                  <span>
                    <Localized k="messaging.interface.links_9024c19" />
                  </span>
                  {links.map((l, i) => (
                    <div key={i} className="row link-row" style={{ gap: 8 }}>
                      <input
                        className="input"
                        style={{ maxWidth: 160 }}
                        maxLength={40}
                        placeholder={uiText("messaging.interface.name_dcd1d52")}
                        aria-label={uiText("settings.interface.link_value0_name_0bf81ea", { value0: i + 1 })}
                        value={l.label}
                        onChange={(e) => setLinks((all) => all.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                      />
                      <input
                        className="input grow"
                        maxLength={300}
                        placeholder="https://"
                        aria-label={uiText("settings.interface.link_value0_address_d32166e", { value0: i + 1 })}
                        value={l.url}
                        onChange={(e) => setLinks((all) => all.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
                      />
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={uiText("settings.interface.remove_link_value0_b78eb82", { value0: i + 1 })}
                        onClick={() => setLinks((all) => all.filter((_, j) => j !== i))}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                  {links.length < 5 && (
                    <button type="button" className="btn btn-ghost btn-sm" style={{ justifySelf: "start" }} onClick={() => setLinks((all) => [...all, { label: "", url: "https://" }])}>
                      <Localized k="settings.interface.add_link_fa1df0f" />
                    </button>
                  )}
                </div>
              )}
              <label className="field">
                <span>
                  <Localized k="settings.interface.birthday_c6138ab" />
                </span>
                <input className="input" placeholder={uiText("settings.interface.yyyy_mm_dd_or_mm_dd_19c2c9b")} {...field("birthday")} />
              </label>
              <label className="field">
                <span>
                  <Localized k="workspace.interface.phone_63dceb8" />
                </span>
                <input className="input" type="tel" autoComplete="tel" placeholder="+8801712345678" {...field("phone")} />
              </label>
              <p className="faint ws-wide" style={{ margin: 0, fontSize: 12.5 }}>
                <Localized
                  k="settings.interface.who_sees_each_field_is_set_under_privacy_security_41a75b6"
                  slots={[
                    usernameHolds
                      ? uiText("settings.interface.when_you_change_your_username_the_old_one_stays_yours_for_7_days_57244fc")
                      : uiText("settings.interface.changing_your_username_frees_the_old_one_links_mentions_and_addre_f7ded0b"),
                  ]}
                />
              </p>
              {(save.error || (problem && form.displayName)) && (
                <div className="banner danger ws-wide" role="alert">
                  {save.error ?? problem}
                </div>
              )}
              {conflict && (
                <div className="banner warn ws-wide" role="alert">
                  <Localized k="settings.interface.your_profile_changed_on_another_device_your_draft_is_kept_reload_15a0c23" />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      shown.current = null;
                      profile.reload();
                      setConflict(false);
                    }}
                  >
                    <Localized k="settings.interface.reload_latest_profile_6abac77" />
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
                  <Localized k="settings.interface.reset_unsaved_changes_6131e1e" />
                </button>
                <button className="btn btn-primary" disabled={!p || !!problem || save.busy || conflict}>
                  {saved ? uiText("settings.interface.saved_b5c120b") : save.busy ? l10n("common.common_saving") : uiText("settings.interface.save_changes_dd0ae7a")}
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
  useLocaleRender();
  const l10n = useLocalization();
  const [copied, setCopied] = useState(false);
  return (
    <div className="card setting">
      <div className="lines">
        <strong className="row" style={{ gap: 6 }}>
          <AtSign size={15} /> {address}
        </strong>
        <small>
          <Localized k="settings.interface.your_address_on_the_meldiq_network_share_it_so_people_on_other_se_2a5ef1a" />
        </small>
      </div>
      <button className="btn btn-secondary btn-sm" onClick={() => void navigator.clipboard?.writeText(address).then(() => setCopied(true))}>
        {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? l10n("common.common_copied") : l10n("common.actions.copy")}
      </button>
    </div>
  );
}
