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
  const engine = useEngine();
  const offered = useOrbit((s) => s.server?.features.includes("creator-program") ?? false);
  const [version, setVersion] = useState(0);
  const data = useLoad(() => (offered ? creatorProgram(engine) : Promise.resolve(null)), [engine, offered, version]);
  const apply = useAction();
  const reload = () => setVersion((v) => v + 1);

  if (!offered) {
    return (
      <>
        <h1>Creators</h1>
        <p className="muted">This server doesn't have the creator programme yet.</p>
      </>
    );
  }
  const p = data.data;
  return (
    <>
      <h1>Creators</h1>
      <p className="muted">Make videos or posts about Meldiq? Join the creator programme, send us links to what you made, and we'll look at each one.</p>
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
            <strong>First, verify your channel</strong>
            <small>Creator verification is in My Account. Once it's approved, come back here to apply.</small>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate({ section: "settings", settingsPage: "account" })}>
            Go to My Account
          </button>
        </div>
      )}
      {p && p.steps.verified && !p.steps.approved && (
        <div className="card setting-card">
          {p.application && (
            <span className="lines">
              <strong>Your application: {STATUS_LABEL[p.application.status]}</strong>
              <small>
                Sent {relative(p.application.createdAt)}
                {p.application.status === "rejected" && p.application.reason ? ` · ${p.application.reason}` : ""}
              </small>
            </span>
          )}
          {p.application?.status !== "pending" && (
            <div>
              <button className="btn btn-primary btn-sm" disabled={apply.busy} onClick={() => void apply.act(() => applyToProgram(engine).then(reload))}>
                {apply.busy ? "Applying…" : p.application ? "Apply again" : "Apply to the programme"}
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
  const steps = [
    { done: p.steps.verified, title: "Verified channel", sub: "Your channel is verified and you hold the Creator badge." },
    { done: p.steps.applied, title: "Apply", sub: "Ask to join the programme." },
    { done: p.steps.approved, title: "Approved", sub: "Send links to what you make." },
  ];
  return (
    <ol className="creator-steps" aria-label="Steps">
      {steps.map((s, i) => (
        <li key={s.title} className={s.done ? "done" : ""}>
          <span className="creator-step-mark" aria-hidden="true">
            {s.done ? <Check size={14} /> : <Circle size={14} />}
          </span>
          <span className="lines">
            <strong>
              {i + 1}. {s.title}
            </strong>
            <small>{s.sub}</small>
          </span>
          <span className="sr-only">{s.done ? "done" : "not yet"}</span>
        </li>
      ))}
    </ol>
  );
}

/** The approved creator's dashboard: send a link, then follow what staff counted and noted. */
function Dashboard({ posts, onSent }: { posts: CreatorPost[]; onSent: () => void }) {
  const engine = useEngine();
  const [url, setUrl] = useState("");
  const [platform, setPlatform] = useState<CreatorPlatform>("youtube");
  const [views, setViews] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const send = useAction();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = parseViews(views);
    const bad = !/^https:\/\/\S+$/i.test(url.trim()) ? "The link starts with https://." : v === null ? "Views are a whole number, or leave it empty." : null;
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
      <h2 className="settings-group">Send a link</h2>
      <form className="card ws-form" style={{ padding: 20 }} onSubmit={submit} noValidate aria-label="Send a link">
        <label className="field ws-wide">
          <span>Link to your post or video</span>
          <input className="input" type="url" inputMode="url" placeholder="https://" maxLength={300} value={url} onChange={(e) => setUrl(e.target.value)} />
        </label>
        <label className="field">
          <span>Platform</span>
          <select className="input" value={platform} onChange={(e) => setPlatform(e.target.value as CreatorPlatform)}>
            {CREATOR_PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {PLATFORM_LABEL[p]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Views (optional)</span>
          <input className="input" inputMode="numeric" value={views} onChange={(e) => setViews(e.target.value)} />
        </label>
        {(problem || send.error) && (
          <div className="banner danger ws-wide" role="alert">
            {problem ?? send.error}
          </div>
        )}
        <div className="ws-form-actions">
          <button className="btn btn-primary btn-sm" disabled={send.busy || !url.trim()}>
            <Send size={14} /> {send.busy ? "Sending…" : "Send"}
          </button>
        </div>
      </form>
      <h2 className="settings-group">Your links</h2>
      <div className="card" style={{ padding: 16 }}>
        {posts.length === 0 ? (
          <small className="faint">Nothing sent yet.</small>
        ) : (
          <ul className="ws-list" aria-label="Your links">
            {posts.map((p) => (
              <li key={p.id} className="ws-row">
                <span className="lines grow">
                  <a className="ellipsis" href={p.url} target="_blank" rel="noopener noreferrer">
                    {p.url}
                  </a>
                  <small>
                    {p.platform === "unknown" ? "" : `${PLATFORM_LABEL[p.platform]} · `}
                    {p.views !== null ? `${p.views.toLocaleString()} views · ` : ""}
                    sent {relative(p.createdAt)}
                    {p.rewardNote ? ` · ${p.rewardNote}` : ""}
                  </small>
                </span>
                <span className={`status-badge status-${p.counted ? "active" : "pending"}`}>{p.counted ? "Counted" : "Not counted yet"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
