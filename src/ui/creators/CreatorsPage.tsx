import { formatUiNumber } from "../../i18n/format";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { interfaceLocale } from "../../i18n/format";
import { useT as useLocalization } from "../../i18n";
import { Check, Circle, Send } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { navigate } from "../../application/router";
import { applyToProgram, CREATOR_PLATFORMS, type CreatorPlatform, type CreatorPost, type CreatorProgram, creatorProgram, parseViews, PLATFORM_LABEL, sendCreatorPost } from "../../sync/creators";
import { relative } from "../format";
import { STATUS_LABEL } from "../settings/CreatorVerificationCard";
import { useAction, useLoad } from "../workspace/useLoad";
/**
 * Settings › Creators (API 0.65.0 batch B, the reference's three steps): a verified channel, then an application, then a
 * dashboard where approved creators send links to what they made about Meldiq and see what staff counted. Rewards are
 * whatever staff write in the note; nothing here pays by itself.
 */
export function CreatorsPage() {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const offered = useOrbit((s) => s.server?.features.includes("creator-program") ?? false);
  const [version, setVersion] = useState(0);
  const data = useLoad(() => (offered ? creatorProgram(engine) : Promise.resolve(null)), [engine, offered, version]);
  const apply = useAction();
  const reload = () => setVersion((v) => v + 1);
  if (!offered) {
    return (
      <>
        <h1>{l10n("settings.settings_creators")}</h1>
        <p className="muted">
          <Localized k="workspace.interface.this_server_doesn_t_have_the_creator_programme_yet_82cff67" />
        </p>
      </>
    );
  }
  const p = data.data;
  return (
    <>
      <h1>{l10n("settings.settings_creators")}</h1>
      <p className="muted">
        <Localized k="workspace.interface.make_videos_or_posts_about_meldiq_join_the_creator_programme_send_5894716" />
      </p>
      {data.error && !p && (
        <div className="banner danger" role="alert">
          {data.error}
        </div>
      )}
      {!p && !data.error && <div className="skeleton" style={{ height: 120 }} aria-busy="true" />}
      {p && <Steps p={p} />}
      {p && !p.steps.verified && (
        <div className="card setting">
          <div className="lines">
            <strong>
              <Localized k="workspace.interface.first_verify_your_channel_9eb7655" />
            </strong>
            <small>
              <Localized k="workspace.interface.creator_verification_is_in_my_account_once_it_s_approved_come_bac_f6d7d49" />
            </small>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate({ section: "settings", settingsPage: "account" })}>
            <Localized k="workspace.interface.go_to_my_account_c5d3cd4" />
          </button>
        </div>
      )}
      {p && p.steps.verified && !p.steps.approved && (
        <div className="card setting-card">
          {p.application && (
            <span className="lines">
              <strong>
                <Localized k="workspace.interface.your_application_46b8910" slots={[STATUS_LABEL[p.application.status]]} />
              </strong>
              <small>
                <Localized
                  k="workspace.interface.sent_a160050"
                  slots={[
                    relative(p.application.createdAt),
                    p.application.status === "rejected" && p.application.reason ? uiText("calls.interface.value0_9402340", { value0: p.application.reason }) : "",
                  ]}
                />
              </small>
            </span>
          )}
          {p.application?.status !== "pending" && (
            <div>
              <button className="btn btn-primary btn-sm" disabled={apply.busy} onClick={() => void apply.act(() => applyToProgram(engine).then(reload))}>
                {apply.busy
                  ? uiText("workspace.interface.applying_3329a9b")
                  : p.application
                    ? uiText("workspace.interface.apply_again_7cb2127")
                    : uiText("workspace.interface.apply_to_the_programme_4478c00")}
              </button>
            </div>
          )}
          {apply.error && (
            <div className="banner danger" role="alert">
              {apply.error}
            </div>
          )}
        </div>
      )}
      {p && p.steps.approved && <Dashboard posts={p.posts} onSent={reload} />}
    </>
  );
}
function Steps({ p }: { p: CreatorProgram }) {
  useLocaleRender();
  const steps = [
    {
      done: p.steps.verified,
      get title() {
        return uiText("workspace.interface.verified_channel_3956f6c");
      },
      get sub() {
        return uiText("workspace.interface.your_channel_is_verified_and_you_hold_the_creator_badge_617759a");
      },
    },
    {
      done: p.steps.applied,
      get title() {
        return uiText("workspace.interface.apply_31e392d");
      },
      get sub() {
        return uiText("workspace.interface.ask_to_join_the_programme_dce0626");
      },
    },
    {
      done: p.steps.approved,
      get title() {
        return uiText("workspace.interface.approved_87b42e4");
      },
      get sub() {
        return uiText("workspace.interface.send_links_to_what_you_make_cca1b08");
      },
    },
  ];
  return (
    <ol className="creator-steps" aria-label={uiText("workspace.interface.steps_1de3df7")}>
      {steps.map((s, i) => (
        <li key={s.title} className={s.done ? "done" : ""}>
          <span className="creator-step-mark" aria-hidden="true">
            {s.done ? <Check size={14} /> : <Circle size={14} />}
          </span>
          <span className="lines">
            <strong>
              {formatUiNumber(i + 1)}. {s.title}
            </strong>
            <small>{s.sub}</small>
          </span>
          <span className="sr-only">{s.done ? uiText("workspace.interface.done_a4c3ed0") : uiText("workspace.interface.not_yet_3b82aae")}</span>
        </li>
      ))}
    </ol>
  );
}
/** The approved creator's dashboard: send a link, then follow what staff counted and noted. */
function Dashboard({ posts, onSent }: { posts: CreatorPost[]; onSent: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const [url, setUrl] = useState("");
  const [platform, setPlatform] = useState<CreatorPlatform>("youtube");
  const [views, setViews] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const send = useAction();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = parseViews(views);
    const bad = !/^https:\/\/\S+$/i.test(url.trim())
      ? uiText("workspace.interface.the_link_starts_with_https_32a68e5")
      : v === null
        ? uiText("workspace.interface.views_are_a_whole_number_or_leave_it_empty_0369bd5")
        : null;
    setProblem(bad);
    if (bad) return;
    void send.act(async () => {
      await sendCreatorPost(engine, { url: url.trim(), platform, ...(typeof v === "number" ? { views: v } : {}) });
      setUrl("");
      setViews("");
      onSent();
    });
  };
  return (
    <>
      <h2 className="settings-group">
        <Localized k="workspace.interface.send_a_link_468da68" />
      </h2>
      <form className="card ws-form" style={{ padding: 20 }} onSubmit={submit} noValidate aria-label={uiText("workspace.interface.send_a_link_468da68")}>
        <label className="field ws-wide">
          <span>
            <Localized k="workspace.interface.link_to_your_post_or_video_a5a4f88" />
          </span>
          <input className="input" type="url" inputMode="url" placeholder="https://" maxLength={300} value={url} onChange={(e) => setUrl(e.target.value)} />
        </label>
        <label className="field">
          <span>
            <Localized k="workspace.interface.platform_c78ffe1" />
          </span>
          <select className="input" value={platform} onChange={(e) => setPlatform(e.target.value as CreatorPlatform)}>
            {CREATOR_PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {PLATFORM_LABEL[p]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>
            <Localized k="workspace.interface.views_optional_32e389e" />
          </span>
          <input className="input" inputMode="numeric" value={views} onChange={(e) => setViews(e.target.value)} />
        </label>
        {(problem || send.error) && (
          <div className="banner danger ws-wide" role="alert">
            {problem ?? send.error}
          </div>
        )}
        <div className="ws-form-actions">
          <button className="btn btn-primary btn-sm" disabled={send.busy || !url.trim()}>
            <Send size={14} /> {send.busy ? l10n("common.common_sending") : l10n("messaging.send")}
          </button>
        </div>
      </form>
      <h2 className="settings-group">
        <Localized k="workspace.interface.your_links_219ee7d" />
      </h2>
      <div className="card" style={{ padding: 16 }}>
        {posts.length === 0 ? (
          <small className="faint">
            <Localized k="workspace.interface.nothing_sent_yet_a5ff063" />
          </small>
        ) : (
          <ul className="ws-list" aria-label={uiText("workspace.interface.your_links_219ee7d")}>
            {posts.map((p) => (
              <li key={p.id} className="ws-row">
                <span className="lines grow">
                  <a className="ellipsis" href={p.url} target="_blank" rel="noopener noreferrer">
                    {p.url}
                  </a>
                  <small>
                    <Localized
                      k="workspace.interface.sent_9da6cd0"
                      slots={[
                        p.platform === "unknown" ? "" : uiText("workspace.interface.value0_3122394", { value0: PLATFORM_LABEL[p.platform] }),
                        p.views !== null ? uiText("workspace.interface.value0_views_30aa5c3", { value0: p.views.toLocaleString(interfaceLocale()) }) : "",
                        relative(p.createdAt),
                        p.rewardNote ? uiText("calls.interface.value0_9402340", { value0: p.rewardNote }) : "",
                      ]}
                    />
                  </small>
                </span>
                <span className={`status-badge status-${p.counted ? "active" : "pending"}`}>
                  {p.counted ? uiText("workspace.interface.counted_c037c15") : uiText("workspace.interface.not_counted_yet_65a3ca0")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
