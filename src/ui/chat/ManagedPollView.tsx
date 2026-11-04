import { useCallback, useEffect, useRef, useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { text as t } from "../../i18n";
import type { RichContent, StoredMessage } from "../../model/types";
import { closeManagedPoll, getManagedPoll, voteManagedPoll, type ManagedPollState } from "../../sync/managedPolls";
import { ApiError } from "../../api/client";
import { PollView } from "./PollView";
export function ManagedPollView({ m, myUserId, canPost }: { m: StoredMessage; myUserId: string; canPost: boolean }) {
  const engine = useEngine(),
    revision = useOrbit((s) => s.pollsRev);
  const scope = JSON.stringify([engine.device.userId, m.id]);
  const current = useRef(scope),
    generation = useRef(0),
    snapshot = useRef<ManagedPollState | null>(null);
  const [loaded, setLoaded] = useState<{ scope: string; value: ManagedPollState } | null>(null),
    [error, setError] = useState<string | null>(null);
  const accept = useCallback(
    (value: ManagedPollState) => {
      if (current.current !== scope) return;
      setLoaded((prior) => (prior?.scope === scope && prior.value.rev > value.rev ? prior : { scope, value }));
      snapshot.current = value;
      setError(null);
      void Promise.all(value.voters.flatMap((v) => (v.userId ? [engine.ensureUser(v.userId).catch(() => undefined)] : [])));
    },
    [engine, scope],
  );
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    try {
      const value = await getManagedPoll(engine, m.id);
      if (generation.current === request) accept(value);
    } catch (error) {
      if (generation.current === request && current.current === scope) {
        setError(error instanceof Error ? error.message : String(error));
        if (error instanceof ApiError && error.code === "not_found") setLoaded(null);
      }
    }
  }, [engine, m.id, accept, scope]);
  const pending = m.outgoing && (m.status === "SENDING" || m.status === "FAILED" || m.status === "HELD");
  useEffect(() => {
    current.current = scope;
    if (!pending) void refresh();
    return () => {
      current.current = "";
    };
  }, [scope, pending, revision, refresh]);
  useEffect(() => {
    if (pending) return;
    const onFocus = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && !snapshot.current?.closed) void refresh();
    }, 15000);
    window.addEventListener("online", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh, pending]);
  const value = loaded?.scope === scope ? loaded.value : null;
  if (!value && (m.status === "FAILED" || m.status === "HELD"))
    return (
      <div className="poll">
        <strong>{m.rich?.managedPoll?.question}</strong>
      </div>
    );
  if (!value)
    return (
      <div className="poll">
        <strong>{m.rich?.managedPoll?.question}</strong>
        <p role={error ? "alert" : "status"}>{error ?? t("common.status.loading")}</p>
        {error && (
          <button className="btn btn-secondary btn-sm" onClick={() => void refresh()}>
            {t("common.actions.retry")}
          </button>
        )}
      </div>
    );
  const votes: Record<string, string[]> = {},
    privacy: Record<string, boolean> = {};
  value.voters.forEach((v, i) => {
    const key = v.userId ?? `anonymous-${i}`;
    votes[key] = v.choices;
    if (!v.userId) privacy[key] = true;
  });
  const rich: RichContent = { poll: value.poll, votes, votePrivacy: privacy, pollClosed: value.closed };
  return (
    <>
      {error && (
        <p className="poll-error" role="alert">
          {error}
          <button className="btn btn-ghost btn-sm" onClick={() => void refresh()}>
            {t("common.actions.retry")}
          </button>
        </p>
      )}
      <PollView
        m={{ ...m, rich }}
        myUserId={myUserId}
        canPost={canPost}
        managed={{
          state: value,
          vote: async (choices, anonymous) => {
            try {
              accept(await voteManagedPoll(engine, m.id, choices, anonymous));
            } catch (error) {
              void refresh();
              throw error;
            }
          },
          close: async () => accept(await closeManagedPoll(engine, m.id)),
        }}
      />
    </>
  );
}
