import { formatUiNumber } from "../../i18n/format";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { ExternalLink, MessageSquareText, Search } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { isInlineImage } from "../../sync/attachments";
import { dayLabel, shortWhen } from "../format";
import { FileAttachment, ImageAttachment, MediaAttachment } from "./Attachments";
import type { DetailsTab } from "./detailsRules";
import { filterFiles, galleryOf, type Gallery, type GalleryItem, type LinkItem } from "./gallery";
import { jumpTo } from "./jump";
import { CollectionControls, useMessageCollection } from "./useMessageCollection";
import { SafeLink } from "./SafeLink";
import { GalleryMediaViewer } from "./GalleryMediaViewer";
import { MediaGalleryDialog } from "./MediaGalleryDialog";
const TAB_LABEL: Record<DetailsTab, string> = {
  get members() {
    return uiText("workspace.members");
  },
  get media() {
    return uiText("messaging.interface.media_d357175");
  },
  get pins() {
    return uiText("files.interface.pins_64baafa");
  },
  get threads() {
    return uiText("messaging.interface.threads_3e42e38");
  },
  get links() {
    return uiText("messaging.interface.links_9024c19");
  },
  get files() {
    return uiText("files.files");
  },
};
/** Photos are decrypted as they're shown: a page at a time keeps a long history from downloading everything at once. */
const PAGE = 18;
interface TabBarProps {
  tabs: DetailsTab[];
  tab: DetailsTab;
  onTab: (t: DetailsTab) => void;
  counts: Partial<Record<DetailsTab, number>>;
}
export function DetailsTabBar({ tabs, tab, onTab, counts }: TabBarProps) {
  useLocaleRender();
  return (
    <div className="details-tabs" role="tablist" aria-label={uiText("organization.interface.details_45989de")}>
      {tabs.map((t) => (
        <button key={t} role="tab" aria-selected={tab === t} onClick={() => onTab(t)}>
          {TAB_LABEL[t]}
          {counts[t] ? <span className="details-tab-count">{formatUiNumber(counts[t])}</span> : null}
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
  useLocaleRender();
  const engine = useEngine();
  return (
    <button
      className="icon-btn"
      aria-label={uiText("messaging.interface.show_in_chat_dbda69f")}
      title={uiText("messaging.interface.show_in_chat_dbda69f")}
      onClick={() => void jumpTo(engine, conversationId, messageId).then((ok) => ok || onMissing())}
    >
      <MessageSquareText size={16} />
    </button>
  );
}
const Missing = () => (
  <p className="banner warn" role="status">
    <Localized k="messaging.interface.that_message_isn_t_loaded_in_this_conversation_any_more_d58914f" />
  </p>
);
interface ItemsTabProps {
  conversationId: string;
  gallery: Gallery;
  nameOf: (i: GalleryItem) => string;
}
/** "Save several…": the gallery with bulk save to a folder (android round 7), for more than one item. */
function SaveSeveral({ gallery, nameOf }: { gallery: Gallery; nameOf: (i: GalleryItem) => string }) {
  useLocaleRender();
  const [open, setOpen] = useState(false);
  if (gallery.media.length + gallery.files.length < 2) return null;
  return (
    <>
      <button className="btn btn-ghost btn-sm" style={{ justifySelf: "start" }} onClick={() => setOpen(true)}>
        <Localized k="messaging.interface.save_several_5afddbe" />
      </button>
      {open && <MediaGalleryDialog gallery={gallery} nameOf={nameOf} onClose={() => setOpen(false)} />}
    </>
  );
}
export function MediaTab({ conversationId, gallery: cached, nameOf }: ItemsTabProps) {
  useLocaleRender();
  const collection = useMessageCollection(conversationId, "media");
  const gallery = collection.supported ? galleryOf(collection.page?.messages ?? []) : cached;
  const [shown, setShown] = useState(PAGE);
  const [missing, setMissing] = useState(false);
  const [kind, setKind] = useState<"all" | "photos" | "videos">("all");
  const [query, setQuery] = useState("");
  const items = filterFiles(gallery.media, query).filter((i) => kind === "all" || (kind === "photos" ? isInlineImage(i.ref) : !isInlineImage(i.ref)));
  return (
    <GalleryMediaViewer items={gallery.media} nameOf={nameOf}>
      <CollectionControls collection={collection} />
      <div className="segmented" role="tablist" aria-label={uiText("messaging.interface.media_type_080d691")}>
        {(["all", "photos", "videos"] as const).map((value) => (
          <button
            key={value}
            role="tab"
            aria-selected={kind === value}
            onClick={() => {
              setKind(value);
              setShown(PAGE);
            }}
          >
            {value === "all" ? uiText("messaging.interface.all_media_682cd88") : value === "photos" ? uiText("messaging.interface.photos_5e3147a") : uiText("messaging.interface.videos_c9a9639")}
          </button>
        ))}
      </div>
      <label className="forum-search">
        <Search size={15} aria-hidden="true" />
        <input
          aria-label={uiText("messaging.interface.search_media_on_this_page_669ddd8")}
          placeholder={uiText("messaging.interface.filter_this_page_0640b1e")}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShown(PAGE);
          }}
        />
      </label>
      {!collection.loading && !collection.error && items.length === 0 && <Empty text={uiText("messaging.interface.no_photos_or_videos_on_this_page_4642c1f")} />}
      {missing && <Missing />}
      <div className="gallery-grid details-grid" role="tabpanel" aria-label={uiText("messaging.interface.photos_and_videos_85f401e")}>
        {items.slice(0, shown).map((i) => (
          <figure key={i.ref.id} className="gallery-cell">
            {isInlineImage(i.ref) ? <ImageAttachment r={i.ref} /> : <MediaAttachment r={i.ref} />}
            <figcaption className="details-caption">
              <span className="ellipsis">
                {nameOf(i)} · {dayLabel(i.at)}
              </span>
              <ShowInChat conversationId={conversationId} messageId={i.messageId} onMissing={() => setMissing(true)} />
            </figcaption>
          </figure>
        ))}
      </div>
      {items.length > shown && (
        <button className="btn btn-secondary btn-sm" style={{ justifySelf: "center" }} onClick={() => setShown((n) => n + PAGE)}>
          <Localized k="messaging.interface.show_more_2ff0ae2" slots={[items.length - shown]} />
        </button>
      )}
      <SaveSeveral gallery={gallery} nameOf={nameOf} />
    </GalleryMediaViewer>
  );
}
export function FilesTab({ conversationId, gallery: cached, nameOf }: ItemsTabProps) {
  useLocaleRender();
  const l10n = useLocalization();
  const collection = useMessageCollection(conversationId, "files");
  const gallery = collection.supported ? galleryOf(collection.page?.messages ?? []) : cached;
  const [q, setQ] = useState("");
  const [missing, setMissing] = useState(false);
  const items = filterFiles(gallery.files, q);
  return (
    <div role="tabpanel" aria-label={l10n("files.files")} style={{ display: "grid", gap: 8 }}>
      <CollectionControls collection={collection} />
      <label className="forum-search">
        <Search size={15} aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={uiText("messaging.interface.filter_this_page_0640b1e")} aria-label={uiText("messaging.interface.search_files_179fed8")} />
      </label>
      {missing && <Missing />}
      {items.length === 0 ? (
        !collection.loading && !collection.error && <Empty text={q ? uiText("messaging.interface.no_files_match_on_this_page_7ff382d") : uiText("messaging.interface.no_files_on_this_page_fa4ecb7")} />
      ) : (
        <div className="gallery-files">
          {items.map((i) => (
            <div key={i.ref.id} className="gallery-file">
              <FileAttachment r={i.ref} />
              <span className="details-caption">
                <small className="faint ellipsis">
                  {nameOf(i)} · {dayLabel(i.at)}
                </small>
                <ShowInChat conversationId={conversationId} messageId={i.messageId} onMissing={() => setMissing(true)} />
              </span>
            </div>
          ))}
        </div>
      )}
      <SaveSeveral gallery={gallery} nameOf={nameOf} />
    </div>
  );
}
export function PinsTab({ conversationId }: { conversationId: string }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const collection = useMessageCollection(conversationId, "pins");
  const pinned = (collection.page?.messages ?? [])
    .filter((m) => !m.deleted && m.pinned)
    .slice()
    .reverse();
  const users = useOrbit((s) => s.users);
  const [missing, setMissing] = useState(false);
  return (
    <>
      <CollectionControls collection={collection} />
      {collection.page && pinned.length === 0 && <Empty text={uiText("messaging.interface.nothing_is_pinned_on_this_page_pin_a_message_from_its_menu_so_eve_68a9047")} />}
      {missing && <Missing />}
      <ul className="search-results" role="tabpanel" aria-label={l10n("messaging.conv_pins")}>
        {pinned.map((m) => (
          <li key={m.id} className="pinned-row">
            <button className="list-row" onClick={() => void jumpTo(engine, conversationId, m.id).then((ok) => setMissing(!ok))}>
              <span className="lines">
                <small>
                  {m.outgoing ? l10n("workspace.nav_you") : (users[m.senderUserId]?.displayName ?? l10n("messaging.react_someone"))} · {shortWhen(m.sortTs)}
                </small>
                <span className="clamp-2">{m.text || (m.attachments.length ? uiText("messaging.interface.attachment_040d2b3") : l10n("messaging.message"))}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
export function LinksTab({ conversationId, links, nameOf }: { conversationId: string; links: LinkItem[]; nameOf: (l: LinkItem) => string }) {
  useLocaleRender();
  const [missing, setMissing] = useState(false);
  if (links.length === 0) return <Empty text={uiText("messaging.interface.no_links_in_the_messages_loaded_on_this_browser_97de5dc")} />;
  return (
    <>
      {missing && <Missing />}
      <ul className="search-results" role="tabpanel" aria-label={uiText("messaging.interface.links_9024c19")}>
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
    </>
  );
}
/** The top of the page: the photo, the name, then @username or the member count, and presence (android DetailsHeader). */
export function DetailsHero({ avatar, title, sub, presence }: { avatar: ReactNode; title: ReactNode; sub: string | null; presence: string | null }) {
  useLocaleRender();
  return (
    <div className="details-hero">
      {avatar}
      <h3>{title}</h3>
      {sub && <small className="faint">{sub}</small>}
      {presence && <small className="details-presence">{presence}</small>}
    </div>
  );
}
export interface DetailsAction {
  key: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  active?: boolean;
}
/** Round actions with their labels under them: Search · Mute · Profile or Add · Security (android DetailsActionsRow). */
export function DetailsActions({ actions }: { actions: DetailsAction[] }) {
  useLocaleRender();
  return (
    <div className="details-actions" role="group" aria-label={uiText("messaging.interface.actions_ff8059d")}>
      {actions.map((a) => (
        <button key={a.key} className={`details-action${a.active ? " active" : ""}`} onClick={a.onClick} aria-pressed={a.active}>
          <span className="details-action-circle" aria-hidden>
            {a.icon}
          </span>
          <span className="ellipsis">{a.label}</span>
        </button>
      ))}
    </div>
  );
}
