import { ChevronDown, ExternalLink, Gift, ImageIcon, Link2 } from "lucide-react";
import { SafeLink } from "../chat/SafeLink";
import { relative, untilWhen } from "../format";
import { Markdown } from "./Markdown";
import { useLobby } from "./lobbyContext";

/** The community's About text, in the little Markdown the lobby takes. */
export function AboutCard() {
  const { view } = useLobby();
  return <Markdown text={view.settings.about ?? ""} />;
}

/** Questions newcomers ask, each opening to its answer. */
export function FaqCard() {
  const { view } = useLobby();
  return (
    <div className="lobby-faq">
      {view.settings.faq
        .filter((q) => q.question.trim())
        .map((q) => (
          <details key={q.id} className="lobby-faq-item">
            <summary>
              <span className="grow">{q.question}</span>
              <ChevronDown size={16} aria-hidden="true" className="lobby-faq-chevron" />
            </summary>
            <p>{q.answer}</p>
          </details>
        ))}
    </div>
  );
}

const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/** The community's links (Community settings › Profile). */
export function LinksCard() {
  const { view } = useLobby();
  return (
    <div className="lobby-links">
      {view.links.map((l, i) => (
        <SafeLink key={`${l.url}-${i}`} href={l.url} className="lobby-link">
          <Link2 size={15} aria-hidden="true" />
          <span className="lines grow">
            <span className="ellipsis">{l.label || hostOf(l.url)}</span>
            <small className="ellipsis">{hostOf(l.url)}</small>
          </span>
          <ExternalLink size={14} aria-hidden="true" className="faint" />
        </SafeLink>
      ))}
    </div>
  );
}

/**
 * Posts apps sent to the lobby's feed URL, newest first. Pictures stay links: the app only shows images from its own
 * origin (its Content-Security-Policy), so a post's picture opens in a new tab.
 */
export function FeedCard() {
  const { view } = useLobby();
  return (
    <div className="lobby-feed">
      {view.feed.map((p) => (
        <article key={p.id} className="lobby-post">
          {p.title &&
            (p.url ? (
              <SafeLink href={p.url} className="lobby-post-title">
                {p.title}
              </SafeLink>
            ) : (
              <strong className="lobby-post-title">{p.title}</strong>
            ))}
          {p.text && <p>{p.text}</p>}
          <div className="lobby-post-meta">
            <span>{relative(p.postedAt)}</span>
            {p.url && !p.title && <SafeLink href={p.url}>{hostOf(p.url)}</SafeLink>}
            {p.image && (
              <SafeLink href={p.image} className="lobby-post-pic">
                <ImageIcon size={13} aria-hidden="true" /> Picture
              </SafeLink>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

/** Giveaways running now (filled by a giveaway bot later). */
export function GiveawaysCard() {
  const { view } = useLobby();
  return (
    <div className="lobby-giveaways">
      {view.giveaways.map((g) => (
        <div key={g.id} className="lobby-giveaway">
          <Gift size={18} aria-hidden="true" />
          <span className="lines grow">
            <span className="ellipsis">{g.title}</span>
            <small>
              Ends {untilWhen(g.endsAt)} · {g.entrants} entered
            </small>
          </span>
        </div>
      ))}
    </div>
  );
}
