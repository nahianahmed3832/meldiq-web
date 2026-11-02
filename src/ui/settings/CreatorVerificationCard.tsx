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

export const STATUS_LABEL: Record<ReviewStatus, string> = { pending: "Waiting for review", approved: "Approved", rejected: "Turned down", unknown: "Unknown" };

const EMPTY: VerificationForm = { platform: "youtube", channelName: "", link: "", notes: "", bioLineConfirmed: false };

/**
 * Settings › My Account › Creator verification (API 0.65.0 batch B): prove you run a channel elsewhere by putting a code
 * line in its bio and sending a screenshot that shows the follower count. Meldiq's staff check it; once approved you get
 * the Creator badge, which you keep while your username still matches the channel.
 */
export function CreatorVerificationCard() {
  const engine = useEngine();
  const offered = useOrbit((s) => s.server?.features.includes("creator-verification") ?? false);
  const [version, setVersion] = useState(0);
  const data = useLoad(() => (offered ? creatorVerification(engine) : Promise.resolve(null)), [engine, offered, version]);
  if (!offered) return null;
  const v = data.data;
  const open = v?.applications.some((a) => a.status === "pending") ?? false;
  return (
    <div className="card setting-card creator-card" aria-label="Creator verification">
      <div className="setting-card-head">
        <span className="lines grow">
          <strong>
            <BadgeCheck size={16} style={{ verticalAlign: "-3px" }} /> Creator verification
          </strong>
          <small>Run a channel on another platform? Show us it's yours and get the Creator badge on your profile.</small>
        </span>
        {v?.verified && <span className="status-badge status-active">Verified creator</span>}
      </div>
      {data.error && !v && (
        <div className="banner danger" role="alert">
          {data.error}
        </div>
      )}
      {!v && !data.error && <div className="skeleton" style={{ height: 80 }} aria-busy="true" />}
      {v && <Rules v={v} />}
      {v && !v.verified && !open && <ApplyForm v={v} onSent={() => setVersion((n) => n + 1)} />}
      {v && open && <small className="faint">Your application is waiting for review. You can apply again only after it's decided.</small>}
      {v && v.applications.length > 0 && <Applications list={v.applications} />}
    </div>
  );
}

/** The code line with Copy, and what staff check, in Meldiq's words. */
function Rules({ v }: { v: CreatorVerification }) {
  const r = v.rules;
  const names = r.nameMatches.includes("displayName") ? "your username or display name" : "your username";
  return (
    <>
      <div className="creator-code">
        <span className="lines grow">
          <small className="faint">Put this line in your channel's bio while we check:</small>
          {v.codeLine ? <code>{v.codeLine}</code> : <span className="faint">Pick a username in My Profile first.</span>}
        </span>
        {v.codeLine && <CopyButton text={v.codeLine} label="Copy the code line" />}
      </div>
      <ul className="creator-rules">
        <li>At least {r.minFollowers.toLocaleString()} followers or subscribers.</li>
        <li>The channel's name matches {names} (capitals, spaces, dots and underscores don't count).</li>
        <li>A screenshot of the channel that shows the follower count, as PNG, JPEG or WebP, up to {Math.round(r.proofMaxBytes / (1024 * 1024))} MB.</li>
        <li>One application at a time. If it's turned down, you'll see why and can apply again.</li>
      </ul>
    </>
  );
}

function ApplyForm({ v, onSent }: { v: CreatorVerification; onSent: () => void }) {
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
    const bad = verificationFormProblem(form, v.rules.notesMax) ?? (proof ? null : "Add a screenshot of your channel.");
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
    <form className="ws-form" onSubmit={submit} noValidate aria-label="Apply for creator verification">
      <label className="field">
        <span>Platform</span>
        <select className="input" value={form.platform} onChange={(e) => set({ platform: e.target.value as CreatorPlatform })}>
          {platforms.map((p) => (
            <option key={p} value={p}>
              {PLATFORM_LABEL[p]}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Channel name</span>
        <input className="input" maxLength={100} value={form.channelName} onChange={(e) => set({ channelName: e.target.value })} />
      </label>
      <label className="field ws-wide">
        <span>Link to the channel</span>
        <input className="input" type="url" inputMode="url" placeholder="https://" maxLength={300} value={form.link} onChange={(e) => set({ link: e.target.value })} />
      </label>
      <label className="field ws-wide">
        <span>Notes (optional)</span>
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
          <ImageUp size={14} /> {proof ? "Change screenshot" : "Add screenshot"}
        </button>
        <small className="faint ellipsis">{proof ? proof.name : "Shows the channel and its follower count"}</small>
      </div>
      <label className="ws-wide row" style={{ gap: 8 }}>
        <input type="checkbox" checked={form.bioLineConfirmed} onChange={(e) => set({ bioLineConfirmed: e.target.checked })} />
        <span>The code line is in my channel's bio</span>
      </label>
      {(problem || send.error) && (
        <div className="banner danger ws-wide" role="alert">
          {problem ?? send.error}
        </div>
      )}
      <div className="ws-form-actions">
        <button className="btn btn-primary btn-sm" disabled={send.busy || !v.codeLine}>
          {send.busy ? "Sending…" : "Apply"}
        </button>
      </div>
    </form>
  );
}

function Applications({ list }: { list: CreatorApplication[] }) {
  return (
    <ul className="ws-list" aria-label="Your applications">
      {list.map((a) => (
        <li key={a.id} className="ws-row">
          <span className="lines grow">
            <span className="ellipsis">
              {a.platform === "unknown" ? "Channel" : PLATFORM_LABEL[a.platform]} · {a.channelName}
            </span>
            <small>
              Sent {relative(a.createdAt)}
              {a.status === "rejected" && a.reason ? ` · ${a.reason}` : ""}
            </small>
          </span>
          <span className={`status-badge status-${a.status === "approved" ? "active" : a.status === "rejected" ? "revoked" : "pending"}`}>{STATUS_LABEL[a.status]}</span>
        </li>
      ))}
    </ul>
  );
}
