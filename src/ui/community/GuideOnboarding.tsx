import { BookOpen, CheckCircle2, Circle, HelpCircle, X } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError } from "../../api/client";
import { useEngine, useOrbit } from "../../application/orbit";
import { navigate } from "../../application/router";
import { answerOnboarding, guideDone, guideHidden, guideProgress, guideSignature, hideGuide, missingAnswer, onboarding, type Onboarding, toggleAnswer } from "../../sync/guide";
import { Dialog } from "../components/Overlay";

/** Fired when a guide task may have been done (a channel was opened): the card reloads. */
export const GUIDE_EVENT = "meldiq:guide-changed";

/**
 * The community guide on the community's home (batch B8b, android GuideCard): the welcome line, "Get started · n of m"
 * tasks (each opens a channel and is ticked once opened, on this browser) and resources; × hides it until it changes.
 */
export function GuideCard({ orgId }: { orgId: string }) {
  const engine = useEngine();
  const guide = useOrbit((s) => s.orgs.find((o) => o.id === orgId)?.guide ?? null);
  const [done, setDone] = useState<string[]>([]);
  const [hidden, setHidden] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => {
      void guideDone(engine.store).then((d) => alive && setDone(d[orgId] ?? []));
      void guideHidden(engine.store).then((h) => alive && setHidden(!!guide && h[orgId] === guideSignature(guide)));
    };
    load();
    window.addEventListener(GUIDE_EVENT, load);
    return () => {
      alive = false;
      window.removeEventListener(GUIDE_EVENT, load);
    };
  }, [engine, orgId, guide]);
  if (!guide || hidden !== false || (!guide.welcome && guide.tasks.length === 0 && guide.resources.length === 0)) return null;
  const [n, m] = guideProgress(guide, done);
  const open = (channelId: string | null) => channelId && navigate({ section: "home", conversationId: channelId });
  return (
    <section className="card guide-card" aria-label="Community guide">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 className="row" style={{ gap: 8, margin: 0 }}>
          <BookOpen size={18} aria-hidden /> Community guide
        </h2>
        <button className="icon-btn" aria-label="Hide the guide for now" onClick={() => void hideGuide(engine.store, orgId, guide).then(() => setHidden(true))}>
          <X size={16} />
        </button>
      </div>
      {guide.welcome && <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{guide.welcome}</p>}
      {guide.tasks.length > 0 && (
        <>
          <h3 className="ws-subhead">
            Get started · {n} of {m}
          </h3>
          <div style={{ display: "grid", gap: 2 }}>
            {guide.tasks.map((t, i) => {
              const ok = !!t.id && done.includes(t.id);
              return (
                <button key={t.id ?? i} className="list-row" onClick={() => open(t.channelId)}>
                  {ok ? <CheckCircle2 size={18} className="ok-text" aria-label="Done" /> : <Circle size={18} className="faint" aria-label="Not done yet" />}
                  <span className="lines">
                    <span style={ok ? { textDecoration: "line-through" } : undefined}>{t.title}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
      {guide.resources.length > 0 && (
        <>
          <h3 className="ws-subhead">Resources</h3>
          <div className="chips">
            {guide.resources.map((r, i) => (
              <button key={r.id ?? i} className="chip" onClick={() => open(r.channelId)}>
                {r.title}
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/** "This community asks a few questions…" for members who haven't answered (batch B8b). */
export function OnboardingBanner({ orgId }: { orgId: string }) {
  const engine = useEngine();
  const org = useOrbit((s) => s.orgs.find((o) => o.id === orgId) ?? null);
  const [data, setData] = useState<Onboarding | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!org?.onboarding || org.myRole === "GUEST") return setData(null);
    let alive = true;
    onboarding(engine, orgId)
      .then((d) => alive && setData(d))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [engine, orgId, org?.onboarding, org?.myRole]);
  if (!data?.enabled || data.prompts.length === 0 || data.answered) return null;
  return (
    <>
      <div className="banner info" role="status">
        <HelpCircle size={16} aria-hidden />
        <span className="grow">This community asks a few questions to set things up for you.</span>
        <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}>
          Answer
        </button>
      </div>
      {open && <OnboardingDialog orgId={orgId} data={data} onClose={() => setOpen(false)} onDone={(d) => setData(d)} />}
    </>
  );
}

/** Answering (or changing) onboarding answers: one card per question; choose one or several; * required. */
export function OnboardingDialog({ orgId, data, onClose, onDone }: { orgId: string; data: Onboarding; onClose: () => void; onDone?: (d: Onboarding) => void }) {
  const engine = useEngine();
  const [chosen, setChosen] = useState<Set<string>>(new Set(data.answered ?? []));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = () => {
    const missing = missingAnswer(data.prompts, chosen);
    if (missing) return setError(`Answer "${missing.title}"`);
    setBusy(true);
    setError(null);
    answerOnboarding(engine, orgId, [...chosen])
      .then(() => {
        onDone?.({ ...data, answered: [...chosen] });
        onClose();
      })
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Couldn't save your answers."))
      .finally(() => setBusy(false));
  };
  return (
    <Dialog title="A few questions" onClose={onClose} wide>
      <div className="dialog-body">
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        {data.prompts.map((p) => (
          <section key={p.id} className="card" style={{ padding: 12, display: "grid", gap: 8 }} aria-label={p.title}>
            <strong>
              {p.title}
              {p.required ? " *" : ""}
            </strong>
            <small className="faint">{p.single ? "Choose one" : "Choose any"}</small>
            <div className="chips" role={p.single ? "radiogroup" : "group"}>
              {p.options.map((o) => (
                <button
                  key={o.id}
                  className="chip"
                  role={p.single ? "radio" : undefined}
                  aria-checked={p.single ? chosen.has(o.id) : undefined}
                  aria-pressed={chosen.has(o.id)}
                  onClick={() => setChosen(toggleAnswer(chosen, p, o.id))}
                >
                  {o.emoji ? `${o.emoji} ` : ""}
                  {o.title}
                </button>
              ))}
            </div>
          </section>
        ))}
        <p className="faint" style={{ margin: 0, fontSize: 12.5 }}>
          Your answers may give you roles and open channels. You can change them later in Community settings.
        </p>
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Later
          </button>
          <button className="btn btn-primary" disabled={busy} onClick={send}>
            Done
          </button>
        </div>
      </div>
    </Dialog>
  );
}
