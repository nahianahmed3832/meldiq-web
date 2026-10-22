import { Ban, Check, Minus, Plus, Shield, UserCheck, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { OrgAdminDetail } from "../../api/workspaceSchemas";
import { useEngine, useOrbit } from "../../app/orbit";
import { answerApplication, applications, bans, setJoinQuestions, setSecurity, unban, updateCommunityAccess } from "../../sync/community";
import { PAUSE_CHOICES, running } from "../../sync/reports";
import { Toggle } from "../components/Toggle";
import { shortWhen, untilWhen } from "../format";
import { useAction, useLoad } from "./useLoad";
import { Card, ErrorLine } from "./WorkspaceView";

const MAX_QUESTIONS = 5;

/**
 * Who can find and join the community, and its rules (COM-03, COM-08): listed in Discover or not, open or invite-only.
 * People who can edit the community change them; everyone sees them.
 */
export function AccessCard({ detail }: { detail: OrgAdminDetail }) {
  const engine = useEngine();
  const org = useOrbit((s) => s.orgs.find((o) => o.id === detail.org.id)) ?? detail.org;
  const can = detail.permissions.canManageOrg;
  const [rules, setRules] = useState(org.rules ?? "");
  useEffect(() => setRules(org.rules ?? ""), [org.rules]);
  const save = useAction();
  const change = (c: Parameters<typeof updateCommunityAccess>[2]) => void save.act(() => updateCommunityAccess(engine, org.id, c));
  return (
    <Card title="Access and rules" sub={can ? "Who can find this community, how they join, and the rules shown before joining." : "Only people who can edit the community change these."}>
      <ErrorLine text={save.error} />
      <div className="field">
        <span className="label">Who can find it</span>
        <div className="segmented" role="radiogroup" aria-label="Who can find it">
          {(["private", "public"] as const).map((v) => (
            <button
              key={v}
              role="radio"
              aria-checked={org.visibility === v}
              aria-pressed={org.visibility === v}
              disabled={!can || save.busy}
              onClick={() => change({ visibility: v, ...(v === "private" ? { joinPolicy: "invite" } : {}) })}
            >
              {v === "private" ? "Only people with an invitation" : "Listed in Discover"}
            </button>
          ))}
        </div>
      </div>
      {org.visibility === "public" && (
        <div className="field">
          <span className="label">Who can join</span>
          <div className="segmented" role="radiogroup" aria-label="Who can join">
            {(["invite", "open"] as const).map((v) => (
              <button key={v} role="radio" aria-checked={org.joinPolicy === v} aria-pressed={org.joinPolicy === v} disabled={!can || save.busy} onClick={() => change({ joinPolicy: v })}>
                {v === "invite" ? "With an invitation" : "Anyone, from Discover"}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="field">
        <label htmlFor="ac-rules">Rules</label>
        <textarea id="ac-rules" className="textarea" rows={4} maxLength={2000} value={rules} disabled={!can} onChange={(e) => setRules(e.target.value)} placeholder="Be kind. No spam." />
        <span className="hint">Shown before someone joins, and on the community's home. Not end-to-end encrypted.</span>
      </div>
      {can && (
        <div>
          <button className="btn btn-primary btn-sm" disabled={save.busy || rules.trim() === (org.rules ?? "")} onClick={() => change({ rules: rules.trim() || null })}>
            Save rules
          </button>
        </div>
      )}
    </Card>
  );
}

/** Join questions (batch B4b): up to five questions people answer to apply; public communities only. */
export function JoinQuestionsCard({ detail }: { detail: OrgAdminDetail }) {
  const engine = useEngine();
  const org = useOrbit((s) => s.orgs.find((o) => o.id === detail.org.id)) ?? detail.org;
  const [qs, setQs] = useState<string[]>(org.joinQuestions ?? [""]);
  useEffect(() => setQs(org.joinQuestions ?? [""]), [org.joinQuestions]);
  const save = useAction();
  const clean = qs.map((q) => q.trim()).filter(Boolean);
  if (org.visibility !== "public") return null;
  return (
    <Card title="Join questions" sub={org.joinQuestions ? `On · ${org.joinQuestions.length} ${org.joinQuestions.length === 1 ? "question" : "questions"}` : "Off · people join the usual way"}>
      <p className="muted" style={{ margin: 0 }}>
        Ask up to five questions. People answer them to apply, and moderators let them in or decline.
      </p>
      <ErrorLine text={save.error} />
      {qs.map((q, i) => (
        <div key={i} className="row" style={{ gap: 6 }}>
          <input
            className="input"
            aria-label={`Question ${i + 1}`}
            value={q}
            maxLength={200}
            placeholder={`Question ${i + 1}`}
            onChange={(e) => setQs(qs.map((x, j) => (j === i ? e.target.value : x)))}
          />
          <button className="icon-btn" aria-label={`Remove question ${i + 1}`} onClick={() => setQs(qs.length > 1 ? qs.filter((_, j) => j !== i) : [""])}>
            <Minus size={16} />
          </button>
        </div>
      ))}
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        {qs.length < MAX_QUESTIONS && (
          <button className="btn btn-secondary btn-sm" onClick={() => setQs([...qs, ""])}>
            <Plus size={14} /> Add a question
          </button>
        )}
        <button className="btn btn-primary btn-sm" disabled={save.busy || clean.length === 0} onClick={() => void save.act(() => setJoinQuestions(engine, org.id, clean))}>
          Save
        </button>
        {org.joinQuestions && (
          <button className="btn btn-ghost btn-sm" disabled={save.busy} onClick={() => void save.act(() => setJoinQuestions(engine, org.id, null))}>
            Turn off applications
          </button>
        )}
      </div>
    </Card>
  );
}

/** Security actions (batch B4, MOD-13; B4b activity alerts): pause joining or new DMs between members for a while. */
export function SecurityPage({ detail }: { detail: OrgAdminDetail }) {
  const engine = useEngine();
  const org = useOrbit((s) => s.orgs.find((o) => o.id === detail.org.id)) ?? detail.org;
  const alerts = useOrbit((s) => s.server?.features.includes("activity-alerts") ?? false);
  const act = useAction();
  const row = (key: "invitesPausedUntil" | "dmsPausedUntil", title: string, sub: string) => {
    const until = org[key];
    return (
      <Card title={title} sub={sub}>
        {running(until) ? (
          <div className="row" style={{ gap: 8, alignItems: "center" }}>
            <span className="tag warn">Paused until {untilWhen(until!)}</span>
            <button className="btn btn-secondary btn-sm" disabled={act.busy} onClick={() => void act.act(() => setSecurity(engine, org.id, { [key]: null }))}>
              Resume
            </button>
          </div>
        ) : (
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
            {PAUSE_CHOICES.map((c) => (
              <button key={c.ms} className="btn btn-secondary btn-sm" disabled={act.busy} onClick={() => void act.act(() => setSecurity(engine, org.id, { [key]: Date.now() + c.ms }))}>
                {c.label}
              </button>
            ))}
          </div>
        )}
      </Card>
    );
  };
  return (
    <div className="ws-page">
      {org.activityAlert && (
        <div className="banner warn" role="status">
          <Shield size={16} /> {org.activityAlert.count} people joined within 10 minutes. Check that it's expected.
        </div>
      )}
      <ErrorLine text={act.error} />
      {row("invitesPausedUntil", "Pause joining", "Nobody can join, by invitation or openly, until the pause ends.")}
      {row("dmsPausedUntil", "Pause new DMs", "Members can't start new direct conversations with each other. Existing ones and moderators aren't affected.")}
      {alerts && (
        <Card title="Activity alerts">
          <div className="setting">
            <span className="lines">
              <strong>Tell moderators when many people join at once</strong>
              <small>10 or more joins within 10 minutes. Nothing is paused automatically.</small>
            </span>
            <Toggle checked={org.activityAlerts} onChange={(on) => void act.act(() => setSecurity(engine, org.id, { activityAlerts: on }))} label="Activity alerts" />
          </div>
        </Card>
      )}
    </div>
  );
}

/** Bans (MOD-05): who can't come back until unbanned. Banning is done from a member's row in Members. */
export function BansPage({ detail }: { detail: OrgAdminDetail }) {
  const engine = useEngine();
  const [rev, setRev] = useState(0);
  const list = useLoad(() => bans(engine, detail.org.id), [engine, detail.org.id, rev]);
  const act = useAction();
  return (
    <div className="ws-page">
      <Card title="Bans" sub="Banned people can't come back by invitation or from Discover until you lift the ban. Ban someone from their row in Members.">
        <ErrorLine text={list.error ?? act.error} />
        <ul className="ws-list" aria-busy={list.loading}>
          {(list.data ?? []).map((b) => (
            <li key={b.userId} className="ws-row">
              <Ban size={16} className="faint" />
              <span className="lines grow">
                <span className="ellipsis">
                  {b.displayName} <span className="faint">@{b.username}</span>
                </span>
                <small className="ellipsis">
                  Banned {shortWhen(b.bannedAt)}
                  {b.bannedByName ? ` by ${b.bannedByName}` : ""}
                  {b.reason ? ` · ${b.reason}` : ""}
                </small>
              </span>
              <button className="btn btn-ghost btn-sm" disabled={act.busy} onClick={() => void act.act(() => unban(engine, detail.org.id, b.userId).then(() => setRev((r) => r + 1)))}>
                Lift ban
              </button>
            </li>
          ))}
          {list.data?.length === 0 && <li className="faint">Nobody is banned.</li>}
        </ul>
      </Card>
    </div>
  );
}

/** Applications (batch B4b): Waiting and Answered; Let in or Decline, each with an optional note for other moderators. */
export function ApplicationsPage({ detail }: { detail: OrgAdminDetail }) {
  const engine = useEngine();
  const rev = useOrbit((s) => s.moderationRev);
  const [tab, setTab] = useState<"pending" | "closed">("pending");
  const [tick, setTick] = useState(0);
  const list = useLoad(() => applications(engine, detail.org.id, tab), [engine, detail.org.id, tab, rev, tick]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const act = useAction();
  const answer = (id: string, status: "approved" | "denied") => void act.act(() => answerApplication(engine, id, status, notes[id] ?? null).then(() => setTick((t) => t + 1)));
  return (
    <div className="ws-page">
      <div className="segmented" role="tablist" aria-label="Applications">
        <button role="tab" aria-selected={tab === "pending"} onClick={() => setTab("pending")}>
          Waiting{list.data && tab === "pending" ? ` (${list.data.pending})` : ""}
        </button>
        <button role="tab" aria-selected={tab === "closed"} onClick={() => setTab("closed")}>
          Answered
        </button>
      </div>
      <ErrorLine text={list.error ?? act.error} />
      {(list.data?.applications ?? []).map((a) => (
        <Card key={a.id} title={a.user.displayName ?? "Someone"} sub={`@${a.user.username ?? "unknown"} · applied ${shortWhen(a.createdAt)}`}>
          <dl className="answers">
            {a.questions.map((q, i) => (
              <div key={i}>
                <dt>{q}</dt>
                <dd>{a.answers[i] ?? ""}</dd>
              </div>
            ))}
          </dl>
          {a.status === "pending" ? (
            <>
              <input
                className="input"
                aria-label="Note for the other moderators"
                placeholder="Note for the other moderators (optional)"
                maxLength={300}
                value={notes[a.id] ?? ""}
                onChange={(e) => setNotes({ ...notes, [a.id]: e.target.value })}
              />
              <div className="row" style={{ gap: 8 }}>
                <button className="btn btn-primary btn-sm" disabled={act.busy} onClick={() => answer(a.id, "approved")}>
                  <UserCheck size={14} /> Let in
                </button>
                <button className="btn btn-secondary btn-sm" disabled={act.busy} onClick={() => answer(a.id, "denied")}>
                  <X size={14} /> Decline
                </button>
              </div>
            </>
          ) : (
            <p className="faint" style={{ margin: 0 }}>
              {a.status === "approved" ? <Check size={13} /> : null}{" "}
              {a.status === "approved" ? `Let in by ${a.handledByName ?? "a moderator"}` : a.status === "denied" ? `Declined by ${a.handledByName ?? "a moderator"}` : "Withdrawn"}
              {a.note ? ` · ${a.note}` : ""}
            </p>
          )}
        </Card>
      ))}
      {list.data?.applications.length === 0 && <p className="faint">{tab === "pending" ? "No one is waiting." : "Nothing answered yet."}</p>}
    </div>
  );
}
