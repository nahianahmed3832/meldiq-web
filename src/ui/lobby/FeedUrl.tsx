import { RefreshCw, Rss, Trash2 } from "lucide-react";
import { useState } from "react";
import { useEngine } from "../../application/orbit";
import { createLobbyFeed, deleteLobbyFeed } from "../../sync/lobby";
import { SecretBox } from "../components/CopyButton";
import { relative } from "../format";
import { useAction } from "../workspace/useLoad";
import { useLobby } from "./lobbyContext";
import type { LobbyEditor } from "./useLobbyEditor";

const EXAMPLE = `POST <feed URL>
Content-Type: application/json

{ "title": "New video is up",
  "text": "Part two of the build",
  "url": "https://example.com/watch",
  "image": "https://i.imgur.com/abc.png" }`;

/**
 * The lobby's feed URL: apps post to it and the Feed card shows the newest posts. The URL is shown once when it's made
 * (Meldiq keeps only a hash); making a new one stops the old one at once.
 */
export function FeedUrl({ editor }: { editor: LobbyEditor }) {
  const engine = useEngine();
  const { orgId, reload } = useLobby();
  const feed = editor.saved.feed;
  const [shown, setShown] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"rotate" | "delete" | null>(null);
  const act = useAction();

  const create = () =>
    void act.act(async () => {
      const made = await createLobbyFeed(engine, orgId);
      editor.setFeed(made.feed);
      setShown(made.url);
      setConfirm(null);
    });
  const remove = () =>
    void act.act(async () => {
      await deleteLobbyFeed(engine, orgId);
      editor.setFeed(null);
      setConfirm(null);
      reload();
    });

  return (
    <section className="lobby-feed-url" aria-label="Feed URL">
      <h3 className="ws-subhead">
        <Rss size={14} aria-hidden="true" /> Feed URL
      </h3>
      {shown && <SecretBox title="Feed URL" secret={shown} onDone={() => setShown(null)} />}
      {!shown && feed && (
        <p className="muted">
          Made {relative(feed.createdAt).toLowerCase()} · {feed.lastPostAt ? `last post ${relative(feed.lastPostAt).toLowerCase()}` : "no posts yet"}
        </p>
      )}
      {!shown && !feed && <p className="muted">Give your apps, bots or a site a URL to post to; their posts show on the Feed card.</p>}
      {act.error && (
        <p className="danger-text" role="alert">
          {act.error}
        </p>
      )}
      {confirm ? (
        <div className="lobby-confirm" role="alert">
          <span className="grow">{confirm === "rotate" ? "The current URL stops working at once." : "Apps can't post any more. Posts already in the lobby stay."}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setConfirm(null)}>
            Keep it
          </button>
          <button className={`btn btn-sm ${confirm === "rotate" ? "btn-primary" : "btn-danger"}`} disabled={act.busy} onClick={confirm === "rotate" ? create : remove}>
            {confirm === "rotate" ? "Make a new URL" : "Delete"}
          </button>
        </div>
      ) : feed ? (
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-secondary btn-sm" disabled={act.busy} onClick={() => setConfirm("rotate")}>
            <RefreshCw size={14} aria-hidden="true" /> New URL
          </button>
          <button className="btn btn-ghost btn-sm" disabled={act.busy} onClick={() => setConfirm("delete")}>
            <Trash2 size={14} aria-hidden="true" /> Delete
          </button>
        </div>
      ) : (
        <button className="btn btn-secondary btn-sm" disabled={act.busy} onClick={create}>
          Make a feed URL
        </button>
      )}
      <details className="lobby-feed-help">
        <summary>What to send</summary>
        <p className="muted">
          JSON with a title, text, link or picture (at least one). Links must be https; pictures from YouTube, Twitch or Imgur. A Discord-style webhook body works too (its first embed is used). Up to
          30 posts a minute; the newest 20 are kept.
        </p>
        <pre className="lobby-code">{EXAMPLE}</pre>
      </details>
    </section>
  );
}
