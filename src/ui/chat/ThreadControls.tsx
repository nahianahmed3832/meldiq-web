import { useCallback, useEffect, useRef, useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { text as t } from "../../i18n";
import { changeThread, deleteThread, getThreadState, type ThreadState } from "../../sync/threadLifecycle";
import { confirmAction } from "../components/ConfirmationDialog";
export function useThreadLifecycle(conversationId: string, rootId: string) {
  const engine = useEngine(),
    revision = useOrbit((s) => s.threadRev),
    c = useOrbit((s) => s.conversations[conversationId]);
  const supported = useOrbit((s) => s.server?.features.includes("thread-lifecycle")) && c?.type === "CHANNEL" && !!c.orgId;
  const scope = JSON.stringify([engine.device.userId, conversationId, rootId]);
  const active = useRef(scope),
    generation = useRef(0);
  const [loaded, setLoaded] = useState<{ scope: string; value: ThreadState } | null>(null),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const accept = useCallback(
    (value: ThreadState) => {
      if (active.current !== scope) return;
      setLoaded((prior) => (prior?.scope === scope && prior.value.rev > value.rev ? prior : { scope, value }));
      setError(null);
    },
    [scope],
  );
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    try {
      const value = await getThreadState(engine, rootId);
      if (generation.current === request) accept(value);
    } catch (e) {
      if (generation.current === request && active.current === scope) {
        setLoaded(null);
        setError(e instanceof Error ? e.message : String(e));
      }
    }
  }, [engine, rootId, scope, accept]);
  useEffect(() => {
    active.current = scope;
    if (supported) void refresh();
    return () => {
      active.current = "";
    };
  }, [scope, supported, revision, refresh]);
  const value = loaded?.scope === scope ? loaded.value : null;
  useEffect(() => {
    if (!supported) return;
    const resume = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = setInterval(resume, value?.deleting ? 1500 : 15000);
    window.addEventListener("online", resume);
    window.addEventListener("focus", resume);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", resume);
      window.removeEventListener("focus", resume);
    };
  }, [refresh, supported, value?.deleting]);
  const run = async (fn: () => Promise<ThreadState | void>) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await fn();
      if (result) accept(result);
      else await refresh();
    } catch (e) {
      if (active.current === scope) {
        const message = e instanceof Error ? e.message : String(e);
        await refresh();
        if (active.current === scope) setError(message);
      }
    } finally {
      if (active.current === scope) setBusy(false);
    }
  };
  return { supported: !!supported, value, error, busy, refresh, run, canReply: !supported || (!!value?.canReply && !error) };
}
export function ThreadControls({ rootId, control, autoFollowing }: { rootId: string; control: ReturnType<typeof useThreadLifecycle>; autoFollowing: boolean }) {
  const engine = useEngine(),
    { supported, value, error, busy, refresh, run } = control;
  if (!supported) return null;
  if (!value)
    return (
      <div className="padded">
        <p role={error ? "alert" : "status"}>{error ?? t("common.status.loading")}</p>
        {error && (
          <button className="btn btn-secondary btn-sm" onClick={() => void refresh()}>
            {t("common.actions.retry")}
          </button>
        )}
      </div>
    );
  const following = value.following ?? autoFollowing;
  return (
    <div className="padded stack" aria-label={t("messaging.thread")}>
      {error && (
        <p role="alert">
          {error}
          <button className="btn btn-secondary btn-sm" onClick={() => void refresh()}>
            {t("common.actions.retry")}
          </button>
        </p>
      )}
      {(value.deleted || value.deleting || value.locked || value.closed) && (
        <p role="status">
          {t(
            value.deleted
              ? "workspace.part3.threadDeleted"
              : value.deletionError
                ? "workspace.part3.threadInterrupted"
                : value.deleting
                  ? "workspace.part3.threadDeleting"
                  : value.locked
                    ? "workspace.part3.threadLocked"
                    : "workspace.part3.threadClosed",
          )}
        </p>
      )}
      <div className="row wrap gap-sm">
        {!value.deleting && !value.deleted && (
          <button
            className="btn btn-secondary btn-sm"
            aria-pressed={following}
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await engine.setFollowed(rootId, !following);
              })
            }
          >
            {t(following ? "messaging.interface.following_344b427" : "messaging.interface.follow_641d1ef")}
          </button>
        )}
        {value.canClose && (
          <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void run(() => changeThread(engine, rootId, value.rev, { closed: !value.closed }))}>
            {t(value.closed ? "workspace.part3.threadReopen" : "workspace.part3.threadClose")}
          </button>
        )}
        {value.canLock && (
          <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void run(() => changeThread(engine, rootId, value.rev, { locked: !value.locked }))}>
            {t(value.locked ? "workspace.part3.threadUnlock" : "workspace.part3.threadLock")}
          </button>
        )}
        {value.canDelete && (!value.deleting || value.deletionError) && (
          <button
            className="btn btn-danger btn-sm"
            disabled={busy}
            onClick={async () => {
              if (await confirmAction(t(value.deletesParent ? "workspace.part3.threadDeletePost" : "workspace.part3.threadDeleteReplies")))
                void run(() => deleteThread(engine, rootId, value.rev, value.deletesParent));
            }}
          >
            {t(value.deletionError ? "workspace.part3.threadResume" : "workspace.part3.threadDelete")}
          </button>
        )}
      </div>
    </div>
  );
}
