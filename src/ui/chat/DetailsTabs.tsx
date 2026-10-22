import { ExternalLink, MessageSquareText, Search } from "lucide-react";
import { useState } from "react";
import { useEngine, useOrbit } from "../../app/orbit";
import { isInlineImage } from "../../sync/attachments";
import { dayLabel, shortWhen } from "../format";
import { FileAttachment, ImageAttachment, MediaAttachment } from "./Attachments";
import { filterFiles, type Gallery, type GalleryItem, type LinkItem } from "./gallery";
import { jumpTo } from "./jump";
import { usePinned } from "./PinnedPanel";
import { SafeLink } from "./SafeLink";

/** The details page of a direct message or group (batch B14, android ConversationDetails): its tabs. */
export type DetailsTab = "about" | "members" | "media" | "pins" | "links" | "files";

const TAB_LABEL: Record<DetailsTab, string> = { about: "About", members: "Members", media: "Media", pins: "Pins", links: "Links", files: "Files" };
export const DETAILS_TABS = Object.keys(TAB_LABEL) as DetailsTab[];

/** Photos are decrypted as they're shown: a page at a time keeps a long history from downloading everything at once. */
const PAGE = 18;

interface TabBarProps {
  tab: DetailsTab;
  onTab: (t: DetailsTab) => void;
  counts: Partial<Record<DetailsTab, number>>;
}

export function DetailsTabBar({ tab, onTab, counts }: TabBarProps) {
  return (
    <div className="details-tabs" role="tablist" aria-label="Details">
      {DETAILS_TABS.map((t) => (
        <button key={t} role="tab" aria-selected={tab === t} onClick={() => onTab(t)}>
          {TAB_LABEL[t]}
          {counts[t] ? <span className="details-tab-count">{counts[t]}</span> : null}
        </button>
      ))}
    </div>
  );
}

const Empty = ({ text }: { text: string }) => (
  <p className="faint" style={{ margin: 0, padding: "8px 4px" }}>
    {text}
  </p>
);

/** "Show in chat": opens the message in the conversation, loading older messages if needed. */
function ShowInChat({ conversationId, messageId, onMissing }: { conversationId: string; messageId: string; onMissing: () => void }) {
  const engine = useEngine();
  return (
    <button className="icon-btn" aria-label="Show in chat" title="Show in chat" onClick={() => void jumpTo(engine, conversationId, messageId).then((ok) => ok || onMissing())}>
      <MessageSquareText size={16} />
    </button>
  );
}

const Missing = () => (
  <p className="banner warn" role="status">
    That message isn't loaded in this conversation any more.
  </p>
);

export function MediaTab({ gallery, nameOf }: { gallery: Gallery; nameOf: (i: GalleryItem) => string }) {
  const [shown, setShown] = useState(PAGE);
  if (gallery.media.length === 0) return <Empty text="No photos or videos in this conversation on this browser yet." />;
  return (
    <>
      <div className="gallery-grid details-grid" role="tabpanel" aria-label="Photos and videos">
        {gallery.media.slice(0, shown).map((i) => (
          <figure key={i.ref.id} className="gallery-cell">
            {isInlineImage(i.ref) ? <ImageAttachment r={i.ref} /> : <MediaAttachment r={i.ref} />}
            <figcaption className="ellipsis">
              {nameOf(i)} · {dayLabel(i.at)}
            </figcaption>
          </figure>
        ))}
      </div>
      {gallery.media.length > shown && (
        <button className="btn btn-secondary btn-sm" style={{ justifySelf: "center" }} onClick={() => setShown((n) => n + PAGE)}>
          Show more ({gallery.media.length - shown})
        </button>
      )}
    </>
  );
}

export function FilesTab({ gallery, nameOf }: { gallery: Gallery; nameOf: (i: GalleryItem) => string }) {
  const [q, setQ] = useState("");
  if (gallery.files.length === 0) return <Empty text="No files in this conversation on this browser yet." />;
  const items = filterFiles(gallery.files, q);
  return (
    <div role="tabpanel" aria-label="Files" style={{ display: "grid", gap: 8 }}>
      <label className="forum-search">
        <Search size={15} aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search files" aria-label="Search files" />
      </label>
      {items.length === 0 ? (
        <Empty text="No files match." />
      ) : (
        <div className="gallery-files">
          {items.map((i) => (
            <div key={i.ref.id} className="gallery-file">
              <FileAttachment r={i.ref} />
              <small className="faint">
                {nameOf(i)} · {dayLabel(i.at)}
              </small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PinsTab({ conversationId }: { conversationId: string }) {
  const engine = useEngine();
  const pinned = usePinned(conversationId);
  const users = useOrbit((s) => s.users);
  const [missing, setMissing] = useState(false);
  if (pinned.length === 0) return <Empty text="Nothing is pinned here. Pin a message from its menu so everyone in the conversation can find it." />;
  return (
    <ul className="search-results" role="tabpanel" aria-label="Pinned messages">
      {missing && <Missing />}
      {pinned.map((m) => (
        <li key={m.id} className="pinned-row">
          <button className="list-row" onClick={() => void jumpTo(engine, conversationId, m.id).then((ok) => setMissing(!ok))}>
            <span className="lines">
              <small>
                {m.outgoing ? "You" : (users[m.senderUserId]?.displayName ?? "Someone")} · {shortWhen(m.sortTs)}
              </small>
              <span className="clamp-2">{m.text || (m.attachments.length ? "Attachment" : "Message")}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function LinksTab({ conversationId, links, nameOf }: { conversationId: string; links: LinkItem[]; nameOf: (l: LinkItem) => string }) {
  const [missing, setMissing] = useState(false);
  if (links.length === 0) return <Empty text="No links in this conversation on this browser yet." />;
  return (
    <ul className="search-results" role="tabpanel" aria-label="Links">
      {missing && <Missing />}
      {links.map((l) => (
        <li key={l.url} className="pinned-row details-link">
          <span className="circle" aria-hidden>
            <ExternalLink size={14} />
          </span>
          <span className="lines grow">
            <SafeLink href={l.url} className="ellipsis">
              {l.url}
            </SafeLink>
            <small className="ellipsis">
              {l.domain} · {nameOf(l)} · {shortWhen(l.at)}
            </small>
          </span>
          <ShowInChat conversationId={conversationId} messageId={l.messageId} onMissing={() => setMissing(true)} />
        </li>
      ))}
    </ul>
  );
}
