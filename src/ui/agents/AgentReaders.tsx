import { BookOpenCheck, EyeOff, Eye } from "lucide-react";
import { useEffect, useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { chooseReader, type ConversationReaders, conversationReaders, installReaders, readEverywhere, turnOffReader, turnOnReader } from "../../sync/aiWorkforce";
import { relative } from "../format";
import { Card, ErrorLine } from "../workspace/WorkspaceView";
import { useAction, useLoad } from "../workspace/useLoad";

/**
 * AI agents reading a conversation (server docs/AI_WORKFORCE_2_PLAN.md phase 5, AI_AGENT_CHANNEL_READ_PROPOSAL.md §6.3):
 * the notice, each member's own choice (share their messages with the agent, or keep them out), and the agent's reading
 * settings. Nothing is shared before the person has seen the notice and chosen: the composer waits for the choice, and
 * the send path treats no choice as keep.
 */
export function useReaders(conversationId: string) {
  const engine = useEngine();
  const rev = useOrbit((s) => s.aiPostsRev[conversationId] ?? 0);
  const loaded = useLoad(() => conversationReaders(engine, conversationId, rev > 0), [engine, conversationId, rev]);
  // The answer to this person's own change, until the server's next answer replaces it.
  const [override, setOverride] = useState<ConversationReaders | null>(null);
  useEffect(() => setOverride(null), [loaded.data]);
  const current = override ?? loaded.data;
  const act = useAction();
  const choose = (readerId: string, choice: "share" | "keep") => void act.act(async () => setOverride(await chooseReader(engine, conversationId, readerId, choice)));
  const readers = current?.readingEnabled ? current.readers : [];
  return {
    readers,
    /** A channel reader this person hasn't chosen for yet: the composer waits. */
    pending: readers.filter((r) => r.mode === "channel" && r.myChoice === null),
    direct: readers.find((r) => r.mode === "direct") ?? null,
    /** Agents (install ids) this person shares their messages with here: their "@Agent" goes as a message. */
    sharing: new Set(readers.filter((r) => r.myChoice === "share").map((r) => r.installId)),
    choose,
    busy: act.busy,
    error: act.error,
  };
}

type Readers = ReturnType<typeof useReaders>;

export function ReaderBanner({ r }: { r: Readers }) {
  if (!r.readers.length) return null;
  return (
    <>
      {r.readers.map((x) =>
        x.mode === "direct" ? (
          <div key={x.readerId} className="banner info" role="status">
            <BookOpenCheck size={16} aria-hidden />
            <span className="grow">
              A direct conversation with {x.name} (AI agent). Everything you write here is read by it, so it isn't end-to-end encrypted from Meldiq's servers and the AI provider.
            </span>
          </div>
        ) : (
          <div key={x.readerId} className="banner info" role="status">
            <BookOpenCheck size={16} aria-hidden />
            <span className="grow">
              {x.name} (AI agent) reads new messages here from members who share theirs, since {relative(x.since)} (turned on by {x.turnedOnBy.name}: {x.reason}).{" "}
              {x.myChoice === "share" ? "You share yours." : x.myChoice === "keep" ? "You keep yours out." : ""}
            </span>
            {x.myChoice && (
              <button className="btn btn-secondary" disabled={r.busy} onClick={() => r.choose(x.readerId, x.myChoice === "share" ? "keep" : "share")}>
                {x.myChoice === "share" ? (
                  <>
                    <EyeOff size={14} /> Keep mine out
                  </>
                ) : (
                  <>
                    <Eye size={14} /> Share mine
                  </>
                )}
              </button>
            )}
          </div>
        ),
      )}
      <ErrorLine text={r.error} />
    </>
  );
}

/** In place of the composer until this person chooses for each reader here. */
export function ReaderChoice({ r }: { r: Readers }) {
  const x = r.pending[0];
  if (!x) return null;
  return (
    <div className="composer reader-choice" role="group" aria-label={`Share your messages with ${x.name}?`}>
      <p>
        <strong>{x.name} (AI agent) can read new messages in this channel</strong>, from members who choose to share theirs. Your messages would be readable by Meldiq's servers and the AI provider.
        Earlier messages stay private. You can change this any time.
      </p>
      <ErrorLine text={r.error} />
      <div className="row-actions">
        <button className="btn btn-primary" disabled={r.busy} onClick={() => r.choose(x.readerId, "share")}>
          Share my messages with {x.name}
        </button>
        <button className="btn btn-secondary" disabled={r.busy} onClick={() => r.choose(x.readerId, "keep")}>
          Keep my messages out
        </button>
      </div>
    </div>
  );
}

/** Agent settings: where it reads, switching reading on per channel or everywhere, and off. */
export function ReadingCard({ orgId, installId, channels, manage }: { orgId: string; installId: string; channels: { id: string; name: string }[]; manage: boolean }) {
  const engine = useEngine();
  const list = useLoad(() => installReaders(engine, orgId, installId), [engine, orgId, installId]);
  const act = useAction();
  const [reason, setReason] = useState("");
  const [channel, setChannel] = useState("");
  const ok = reason.trim().length >= 8;
  const reading = new Set((list.data?.readers ?? []).map((r) => r.conversationId));
  const run = (fn: () => Promise<unknown>) => void act.act(async () => (await fn(), list.reload()));
  return (
    <Card
      title="Reading channels"
      sub="An agent that reads a channel can answer @mentions, commands and replies there, and use what was said as context. Each member decides whether their own messages are shared; earlier messages stay private."
    >
      <ErrorLine text={list.error ?? act.error} />
      {list.data && !list.data.readingEnabled && <p className="muted">Reading channels is switched off on this platform.</p>}
      {list.data?.readers.length ? (
        <ul className="ws-list">
          {list.data.readers.map((r) => (
            <li key={r.readerId} className="ws-row">
              <span className="lines grow">
                <span>#{r.conversationName ?? "channel"}</span>
                <small>
                  Since {relative(r.since)}, by {r.turnedOnBy.name}: {r.reason}
                </small>
              </span>
              {manage && (
                <button
                  className="btn btn-secondary"
                  disabled={act.busy || !ok}
                  title={ok ? undefined : "Give a reason first"}
                  onClick={() => run(() => turnOffReader(engine, orgId, installId, r.readerId, reason.trim()))}
                >
                  Stop reading
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">It doesn't read any channel.</p>
      )}
      {manage && list.data?.readingEnabled && (
        <>
          <label className="field">
            <span>Reason (shown to the channel)</span>
            <input value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} placeholder="e.g. answer product questions from the team" />
          </label>
          <div className="row-actions">
            <select aria-label="Channel to read" value={channel} onChange={(e) => setChannel(e.target.value)}>
              <option value="">Choose a channel…</option>
              {channels
                .filter((c) => !reading.has(c.id))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.name}
                  </option>
                ))}
            </select>
            <button className="btn btn-primary" disabled={act.busy || !ok || !channel} onClick={() => run(() => turnOnReader(engine, orgId, installId, channel, reason.trim()))}>
              Let it read this channel
            </button>
            <button className="btn btn-secondary" disabled={act.busy || !ok} onClick={() => run(() => readEverywhere(engine, orgId, installId, "all", reason.trim()))}>
              Read every channel
            </button>
          </div>
          <p className="muted">Every channel it starts reading is told, with your reason. Channels you can't manage are left as they are.</p>
        </>
      )}
    </Card>
  );
}
