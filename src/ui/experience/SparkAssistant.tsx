import { useEffect, useRef, useState } from "react";
import { ApiError } from "../../api/client";
import { useEngine, useOrbit } from "../../application/orbit";
import { useLanguage, useT, type MessageKey } from "../../i18n";
import { formatDate } from "../../i18n/format";
import { PERSONAL } from "../../sync/navPrefs";
import { sparkCreate, sparkDelete, sparkInfo, sparkOpen, sparkRename, streamSpark, type SparkThread } from "../../sync/sparkAssistant";
import { Markdown } from "../chat/Markdown";
import { Dialog } from "../components/Overlay";
import { useAction, useLoad } from "../workspace/useLoad";

export function SparkAssistant({ onClose }: { onClose: () => void }) {
  const t = useT();
  const locale = useLanguage();
  const { api } = useEngine();
  const supported = useOrbit((s) => s.server?.features.includes("spark-assistant") ?? false);
  const hasSaved = useOrbit((s) => !!s.nav[PERSONAL]?.saved?.length);
  const inCommunity = useOrbit((s) => s.orgs.length > 0);
  const loaded = useLoad(() => (supported ? sparkInfo(api) : Promise.resolve(null)), [api, supported]);
  const action = useAction();
  const [selected, setSelected] = useState<SparkThread | null>(null);
  const [opening, setOpening] = useState(false);
  const [draft, setDraft] = useState("");
  const [consent, setConsent] = useState(false);
  const [partial, setPartial] = useState("");
  const [pending, setPending] = useState<{ requestId: string; prompt: string } | null>(null);
  const [failed, setFailed] = useState<MessageKey | null>(null);
  const [rename, setRename] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const request = useRef<AbortController | null>(null);
  const retry = useRef<{ requestId: string; threadId: string; prompt: string } | null>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const tail = useRef<HTMLDivElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (follow.current) tail.current?.scrollIntoView({ block: "nearest" });
  }, [partial, selected?.turns.length, pending]);
  const available = loaded.data?.configured === true;
  const busy = opening || !!pending || action.busy;
  const prompts = [
    hasSaved ? "workspace.experience.promptSaved" : "workspace.experience.promptFind",
    inCommunity ? "workspace.experience.promptChannels" : "workspace.experience.promptCommunity",
    "workspace.experience.promptVoice",
  ] as const;

  const open = (id: string) => {
    if (busy) return;
    const controller = new AbortController();
    request.current = controller;
    setOpening(true);
    setFailed(null);
    void sparkOpen(api, id, controller.signal)
      .then((thread) => {
        if (!controller.signal.aborted) {
          retry.current = null;
          setSelected(thread);
          setDraft("");
          setRename(null);
          setDeleting(false);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed("workspace.experience.sparkLoadError");
      })
      .finally(() => {
        if (!controller.signal.aborted) setOpening(false);
      });
  };

  const send = async () => {
    if (!available || busy || !consent || !draft.trim()) return;
    let thread = selected;
    const prompt = draft.trim();
    const previous = retry.current;
    const attempt = previous?.prompt === prompt && (!thread || thread.id === previous.threadId) ? previous : { prompt, threadId: thread?.id ?? crypto.randomUUID(), requestId: crypto.randomUUID() };
    retry.current = attempt;
    const turn = { requestId: attempt.requestId, prompt };
    const controller = new AbortController();
    request.current = controller;
    setPending(turn);
    setFailed(null);
    setPartial("");
    follow.current = true;
    try {
      if (!thread) {
        thread = await sparkCreate(api, attempt.threadId, t("workspace.experience.sparkNewTitle"));
        if (controller.signal.aborted) return;
        setSelected(thread);
        loaded.reload();
      }
      await streamSpark(api, thread.id, { ...turn, consent: true, locale }, controller.signal, setPartial);
      if (controller.signal.aborted) return;
      retry.current = null;
      setDraft("");
      setSelected(await sparkOpen(api, thread.id, controller.signal));
      loaded.reload();
    } catch (error) {
      if (controller.signal.aborted) return;
      if (thread) {
        // A reply may already have been saved if the connection broke before its final frame.
        const latest = await sparkOpen(api, thread.id, controller.signal).catch(() => null);
        if (controller.signal.aborted) return;
        if (latest) setSelected(latest);
        if (latest?.turns.some((item) => item.requestId === turn.requestId)) {
          retry.current = null;
          setDraft("");
          loaded.reload();
          return;
        }
      }
      setFailed(
        error instanceof ApiError && error.status === 429
          ? "workspace.experience.sparkRateLimit"
          : error instanceof ApiError && error.code === "limit_reached"
            ? "workspace.experience.sparkLimit"
            : "workspace.experience.sparkReplyError",
      );
    } finally {
      if (request.current === controller) {
        request.current = null;
        setPending(null);
        setPartial("");
      }
    }
  };

  return (
    <Dialog title={t("workspace.experience.spark")} subtitle={t("workspace.experience.sparkSubtitle")} onClose={onClose} wide>
      <div className="dialog-body spark-layout">
        <section className="spark-history" aria-label={t("workspace.experience.sparkHistory")} aria-busy={loaded.loading}>
          <button
            className="btn btn-secondary btn-sm"
            disabled={busy || !available}
            onClick={() => {
              retry.current = null;
              setSelected(null);
              setDraft("");
              setFailed(null);
              setRename(null);
              setDeleting(false);
            }}
          >
            {t("workspace.experience.sparkNew")}
          </button>
          <label className="field">
            {t("workspace.experience.sparkHistory")}
            <select
              className="input input-sm"
              disabled={busy || !loaded.data?.threads.length}
              value={selected?.id ?? ""}
              onChange={(e) => {
                if (e.target.value) open(e.target.value);
              }}
            >
              <option value="" disabled>
                {t("workspace.experience.sparkChoose")}
              </option>
              {loaded.data?.threads.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.title} · {formatDate(row.updatedAt, { dateStyle: "short", timeStyle: "short" })}
                </option>
              ))}
            </select>
          </label>
          {selected && (
            <div className="experience-controls">
              <button
                className="btn btn-ghost btn-sm"
                disabled={busy}
                onClick={() => {
                  action.clear();
                  setRename(selected.title);
                  setDeleting(false);
                }}
              >
                {t("workspace.experience.sparkRename")}
              </button>
              <button
                className="btn btn-danger-quiet btn-sm"
                disabled={busy}
                onClick={() => {
                  action.clear();
                  setDeleting(true);
                  setRename(null);
                }}
              >
                {t("workspace.experience.sparkDelete")}
              </button>
            </div>
          )}
          {rename !== null && selected && (
            <form
              className="experience-controls"
              onSubmit={(event) => {
                event.preventDefault();
                if (!rename.trim() || busy) return;
                void action.act(async () => {
                  setSelected(await sparkRename(api, selected.id, rename.trim()));
                  setRename(null);
                  loaded.reload();
                });
              }}
            >
              <label>
                {t("workspace.experience.sparkTitle")}
                <input className="input input-sm" value={rename} maxLength={100} onChange={(event) => setRename(event.target.value)} required />
              </label>
              <button className="btn btn-secondary btn-sm" disabled={busy || !rename.trim()}>
                {t("common.actions.save")}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRename(null)}>
                {t("common.actions.cancel")}
              </button>
            </form>
          )}
          {deleting && selected && (
            <div className="experience-panel" style={{ padding: 0 }}>
              <p>{t("workspace.experience.sparkDeleteHelp")}</p>
              <div className="experience-controls">
                <button
                  className="btn btn-danger btn-sm"
                  disabled={busy}
                  onClick={() =>
                    void action.act(async () => {
                      await sparkDelete(api, selected.id);
                      retry.current = null;
                      setSelected(null);
                      setDraft("");
                      setDeleting(false);
                      loaded.reload();
                    })
                  }
                >
                  {t("workspace.experience.sparkDelete")}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setDeleting(false)}>
                  {t("common.actions.cancel")}
                </button>
              </div>
            </div>
          )}
          {action.error && (
            <p className="banner danger" role="alert">
              {action.error}
            </p>
          )}
        </section>
        <section className="spark-conversation" aria-label={t("workspace.experience.spark")}>
          {((loaded.loading && !loaded.data) || opening) && <div className="experience-skeleton" role="status" aria-label={t("workspace.experience.loading")} />}
          {loaded.error && (
            <p className="banner danger" role="alert">
              {loaded.error}{" "}
              <button className="btn btn-ghost btn-sm" onClick={loaded.reload}>
                {t("workspace.experience.retry")}
              </button>
            </p>
          )}
          {!available && !loaded.loading && !loaded.error && (
            <p className="banner" role="status">
              {t("workspace.experience.sparkUnavailable")}
            </p>
          )}
          <div
            className="spark-messages scroll"
            ref={scroll}
            onScroll={() => {
              const el = scroll.current;
              if (el) follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
            }}
          >
            {!selected?.turns.length && !pending && !opening && available && (
              <div className="experience-panel">
                <h3>{t("workspace.experience.sparkStart")}</h3>
                <div className="experience-controls">
                  {prompts.map((key) => (
                    <button
                      className="btn btn-secondary btn-sm experience-break"
                      key={key}
                      onClick={() => {
                        setDraft(t(key));
                        composer.current?.focus();
                      }}
                    >
                      {t(key)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {selected?.turns.map((turn) => (
              <div className="spark-turn" key={turn.requestId}>
                <p className="spark-user experience-break">{turn.user}</p>
                <div className="card experience-panel experience-break">
                  <strong>{t("workspace.experience.sparkSuggestion")}</strong>
                  <Markdown text={turn.assistant} />
                </div>
              </div>
            ))}
            {pending && (
              <div className="spark-turn">
                <p className="spark-user experience-break">{pending.prompt}</p>
                <div className="card experience-panel experience-break" aria-busy="true">
                  <strong>{t("workspace.experience.sparkSuggestion")}</strong>
                  {partial ? <Markdown text={partial} /> : <div className="experience-skeleton" />}
                </div>
              </div>
            )}
            <div ref={tail} />
          </div>
          {failed && (
            <p className="banner danger" role="alert">
              {t(failed)}
            </p>
          )}
          {available && (
            <form
              className="spark-composer"
              onSubmit={(event) => {
                event.preventDefault();
                void send();
              }}
            >
              <label className="field">
                {t("workspace.experience.sparkPrompt")}
                <textarea
                  ref={composer}
                  className="input"
                  maxLength={4000}
                  rows={3}
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    setFailed(null);
                  }}
                  disabled={busy}
                />
              </label>
              <label className="spark-consent">
                <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} disabled={busy} />
                {t("workspace.experience.sparkConsent")}
              </label>
              <div className="experience-controls">
                <button className="btn btn-primary btn-sm" disabled={busy || !consent || !draft.trim()}>
                  {t(failed && draft ? "workspace.experience.retry" : "workspace.experience.sparkSend")}
                </button>
                {pending && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => request.current?.abort()}>
                    {t("workspace.experience.sparkStop")}
                  </button>
                )}
                {pending && <span role="status">{t("workspace.experience.sparkWorking")}</span>}
              </div>
            </form>
          )}
        </section>
      </div>
    </Dialog>
  );
}
