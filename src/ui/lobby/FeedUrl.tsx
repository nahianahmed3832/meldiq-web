import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
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
  useLocaleRender();
  const l10n = useLocalization();
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
    <section className="lobby-feed-url" aria-label={uiText("workspace.interface.feed_url_b623f8b")}>
      <h3 className="ws-subhead">
        <Localized k="workspace.interface.feed_url_793ae31" slots={[<Rss size={14} aria-hidden="true" />]} />
      </h3>
      {shown && <SecretBox title={uiText("workspace.interface.feed_url_b623f8b")} secret={shown} onDone={() => setShown(null)} />}
      {!shown && feed && (
        <p className="muted">
          <Localized
            k="workspace.interface.made_bdcb8fa"
            slots={[
              relative(feed.createdAt).toLowerCase(),
              feed.lastPostAt ? uiText("workspace.interface.last_post_value0_8ebddfb", { value0: relative(feed.lastPostAt).toLowerCase() }) : uiText("workspace.interface.no_posts_yet_9cf0b4e"),
            ]}
          />
        </p>
      )}
      {!shown && !feed && (
        <p className="muted">
          <Localized k="workspace.interface.give_your_apps_bots_or_a_site_a_url_to_post_to_their_posts_show_o_36d314a" />
        </p>
      )}
      {act.error && (
        <p className="danger-text" role="alert">
          {act.error}
        </p>
      )}
      {confirm ? (
        <div className="lobby-confirm" role="alert">
          <span className="grow">
            {confirm === "rotate"
              ? uiText("workspace.interface.the_current_url_stops_working_at_once_f29f10a")
              : uiText("workspace.interface.apps_can_t_post_any_more_posts_already_in_the_lobby_stay_3e245f3")}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => setConfirm(null)}>
            <Localized k="workspace.interface.keep_it_fdce5da" />
          </button>
          <button className={`btn btn-sm ${confirm === "rotate" ? "btn-primary" : "btn-danger"}`} disabled={act.busy} onClick={confirm === "rotate" ? create : remove}>
            {confirm === "rotate" ? uiText("organization.interface.make_a_new_url_69bbf24") : l10n("common.actions.delete")}
          </button>
        </div>
      ) : feed ? (
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-secondary btn-sm" disabled={act.busy} onClick={() => setConfirm("rotate")}>
            <Localized k="organization.interface.new_url_6289e14" slots={[<RefreshCw size={14} aria-hidden="true" />]} />
          </button>
          <button className="btn btn-ghost btn-sm" disabled={act.busy} onClick={() => setConfirm("delete")}>
            <Trash2 size={14} aria-hidden="true" /> {l10n("common.actions.delete")}
          </button>
        </div>
      ) : (
        <button className="btn btn-secondary btn-sm" disabled={act.busy} onClick={create}>
          <Localized k="workspace.interface.make_a_feed_url_5500cce" />
        </button>
      )}
      <details className="lobby-feed-help">
        <summary>
          <Localized k="workspace.interface.what_to_send_bceb988" />
        </summary>
        <p className="muted">
          <Localized k="workspace.interface.json_with_a_title_text_link_or_picture_at_least_one_links_must_be_b2eaea9" />
        </p>
        <pre className="lobby-code">{EXAMPLE}</pre>
      </details>
    </section>
  );
}
