import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { interfaceLocale } from "../../i18n/format";
import { useT as useLocalization } from "../../i18n";
import { BadgeCheck, ImageUp } from "lucide-react";
import { type FormEvent, useRef, useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import {
  applyForVerification,
  CREATOR_PLATFORMS,
  type CreatorApplication,
  type CreatorPlatform,
  type CreatorVerification,
  creatorVerification,
  PLATFORM_LABEL,
  proofProblem,
  type ReviewStatus,
  verificationFormProblem,
  type VerificationForm,
} from "../../sync/creators";
import { CopyButton } from "../components/CopyButton";
import { relative } from "../format";
import { useAction, useLoad } from "../workspace/useLoad";
export const STATUS_LABEL: Record<ReviewStatus, string> = {
  get pending() {
    return uiText("settings.interface.waiting_for_review_a61935d");
  },
  get approved() {
    return uiText("workspace.interface.approved_87b42e4");
  },
  get rejected() {
    return uiText("settings.interface.turned_down_8110ac9");
  },
  get unknown() {
    return uiText("messaging.interface.unknown_b764cdc");
  },
};
const EMPTY: VerificationForm = { platform: "youtube", channelName: "", link: "", notes: "", bioLineConfirmed: false };
/**
 * Settings › My Account › Creator verification (API 0.65.0 batch B): prove you run a channel elsewhere by putting a code
 * line in its bio and sending a screenshot that shows the follower count. Meldiq's staff check it; once approved you get
 * the Creator badge, which you keep while your username still matches the channel.
 */
export function CreatorVerificationCard() {
  useLocaleRender();
  const engine = useEngine();
  const offered = useOrbit((s) => s.server?.features.includes("creator-verification") ?? false);
  const [version, setVersion] = useState(0);
  const data = useLoad(() => (offered ? creatorVerification(engine) : Promise.resolve(null)), [engine, offered, version]);
  if (!offered) return null;
  const v = data.data;
  const open = v?.applications.some((a) => a.status === "pending") ?? false;
  return (
    <div className="card setting-card creator-card" aria-label={uiText("settings.interface.creator_verification_fa3b713")}>
      <div className="setting-card-head">
        <span className="lines grow">
          <strong>
            <Localized k="settings.interface.creator_verification_9a1b2b7" slots={[<BadgeCheck size={16} style={{ verticalAlign: "-3px" }} />]} />
          </strong>
          <small>
            <Localized k="settings.interface.run_a_channel_on_another_platform_show_us_it_s_yours_and_get_the_6f111a4" />
          </small>
        </span>
        {v?.verified && (
          <span className="status-badge status-active">
            <Localized k="settings.interface.verified_creator_dfaa20a" />
          </span>
        )}
      </div>
      {data.error && !v && (
        <div className="banner danger" role="alert">
          {data.error}
        </div>
      )}
      {!v && !data.error && <div className="skeleton" style={{ height: 80 }} aria-busy="true" />}
      {v && <Rules v={v} />}
      {v && !v.verified && !open && <ApplyForm v={v} onSent={() => setVersion((n) => n + 1)} />}
      {v && open && (
        <small className="faint">
          <Localized k="settings.interface.your_application_is_waiting_for_review_you_can_apply_again_only_a_f78fc27" />
        </small>
      )}
      {v && v.applications.length > 0 && <Applications list={v.applications} />}
    </div>
  );
}
/** The code line with Copy, and what staff check, in Meldiq's words. */
function Rules({ v }: { v: CreatorVerification }) {
  useLocaleRender();
  const r = v.rules;
  const names = r.nameMatches.includes("displayName") ? uiText("settings.interface.your_username_or_display_name_e1bcb1d") : uiText("settings.interface.your_username_4b11447");
  return (
    <>
      <div className="creator-code">
        <span className="lines grow">
          <small className="faint">
            <Localized k="settings.interface.put_this_line_in_your_channel_s_bio_while_we_check_0313922" />
          </small>
          {v.codeLine ? (
            <code>{v.codeLine}</code>
          ) : (
            <span className="faint">
              <Localized k="settings.interface.pick_a_username_in_my_profile_first_95ecf26" />
            </span>
          )}
        </span>
        {v.codeLine && <CopyButton text={v.codeLine} label={uiText("settings.interface.copy_the_code_line_100347d")} />}
      </div>
      <ul className="creator-rules">
        <li>
          <Localized k="settings.interface.at_least_followers_or_subscribers_4da1257" slots={[r.minFollowers.toLocaleString(interfaceLocale())]} />
        </li>
        <li>
          <Localized k="settings.interface.the_channel_s_name_matches_capitals_spaces_dots_and_underscores_d_01bb6b1" slots={[names]} />
        </li>
        <li>
          <Localized k="settings.interface.a_screenshot_of_the_channel_that_shows_the_follower_count_as_png_49ddf59" slots={[Math.round(r.proofMaxBytes / (1024 * 1024))]} />
        </li>
        <li>
          <Localized k="settings.interface.one_application_at_a_time_if_it_s_turned_down_you_ll_see_why_and_c61f4bd" />
        </li>
      </ul>
    </>
  );
}
function ApplyForm({ v, onSent }: { v: CreatorVerification; onSent: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const [form, setForm] = useState<VerificationForm>(EMPTY);
  const [proof, setProof] = useState<File | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const send = useAction();
  const platforms = v.rules.platforms.filter((p): p is CreatorPlatform => (CREATOR_PLATFORMS as readonly string[]).includes(p));
  const set = (change: Partial<VerificationForm>) => setForm((f) => ({ ...f, ...change }));
  const pick = (f: File | undefined) => {
    if (!f) return;
    const bad = proofProblem(f, v.rules);
    setProblem(bad);
    setProof(bad ? null : f);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const bad = verificationFormProblem(form, v.rules.notesMax) ?? (proof ? null : uiText("settings.interface.add_a_screenshot_of_your_channel_a610396"));
    setProblem(bad);
    if (bad || !proof) return;
    void send.act(async () => {
      await applyForVerification(engine, form, new Uint8Array(await proof.arrayBuffer()));
      setForm(EMPTY);
      setProof(null);
      onSent();
    });
  };
  return (
    <form className="ws-form" onSubmit={submit} noValidate aria-label={uiText("settings.interface.apply_for_creator_verification_3a463cf")}>
      <label className="field">
        <span>
          <Localized k="workspace.interface.platform_c78ffe1" />
        </span>
        <select className="input" value={form.platform} onChange={(e) => set({ platform: e.target.value as CreatorPlatform })}>
          {platforms.map((p) => (
            <option key={p} value={p}>
              {PLATFORM_LABEL[p]}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>
          <Localized k="settings.interface.channel_name_2fe4a2e" />
        </span>
        <input className="input" maxLength={100} value={form.channelName} onChange={(e) => set({ channelName: e.target.value })} />
      </label>
      <label className="field ws-wide">
        <span>
          <Localized k="settings.interface.link_to_the_channel_b5259ca" />
        </span>
        <input className="input" type="url" inputMode="url" placeholder="https://" maxLength={300} value={form.link} onChange={(e) => set({ link: e.target.value })} />
      </label>
      <label className="field ws-wide">
        <span>
          <Localized k="settings.interface.notes_optional_6239b93" />
        </span>
        <textarea className="input" rows={2} maxLength={v.rules.notesMax} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
      </label>
      <div className="ws-wide row" style={{ gap: 10 }}>
        <input
          ref={file}
          type="file"
          hidden
          accept={v.rules.proofTypes.join(",")}
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => file.current?.click()}>
          <ImageUp size={14} /> {proof ? uiText("settings.interface.change_screenshot_bb4cc18") : uiText("settings.interface.add_screenshot_ef61c03")}
        </button>
        <small className="faint ellipsis">{proof ? proof.name : uiText("settings.interface.shows_the_channel_and_its_follower_count_00109a1")}</small>
      </div>
      <label className="ws-wide row" style={{ gap: 8 }}>
        <input type="checkbox" checked={form.bioLineConfirmed} onChange={(e) => set({ bioLineConfirmed: e.target.checked })} />
        <span>
          <Localized k="settings.interface.the_code_line_is_in_my_channel_s_bio_ff3e05e" />
        </span>
      </label>
      {(problem || send.error) && (
        <div className="banner danger ws-wide" role="alert">
          {problem ?? send.error}
        </div>
      )}
      <div className="ws-form-actions">
        <button className="btn btn-primary btn-sm" disabled={send.busy || !v.codeLine}>
          {send.busy ? l10n("common.common_sending") : uiText("workspace.interface.apply_31e392d")}
        </button>
      </div>
    </form>
  );
}
function Applications({ list }: { list: CreatorApplication[] }) {
  useLocaleRender();
  return (
    <ul className="ws-list" aria-label={uiText("settings.interface.your_applications_e7bc4ab")}>
      {list.map((a) => (
        <li key={a.id} className="ws-row">
          <span className="lines grow">
            <span className="ellipsis">
              {a.platform === "unknown" ? uiText("settings.interface.channel_ce4683e") : PLATFORM_LABEL[a.platform]} · {a.channelName}
            </span>
            <small>
              <Localized
                k="workspace.interface.sent_a160050"
                slots={[relative(a.createdAt), a.status === "rejected" && a.reason ? uiText("calls.interface.value0_9402340", { value0: a.reason }) : ""]}
              />
            </small>
          </span>
          <span className={`status-badge status-${a.status === "approved" ? "active" : a.status === "rejected" ? "revoked" : "pending"}`}>{STATUS_LABEL[a.status]}</span>
        </li>
      ))}
    </ul>
  );
}
