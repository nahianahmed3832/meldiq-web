import { MotionImage } from "../components/MotionImage";
import { Search, Smile, Sticker as StickerIcon, Upload, X } from "lucide-react";
import { PHONE_LAYOUT, visibleViewport } from "../../application/viewport";
import { ROUTE_EVENT } from "../../application/router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ApiError } from "../../api/client";
import { useEngine, useOrbit } from "../../application/orbit";
import { ANIMOJI } from "../../sync/animoji";
import { suggestName, uploadExpression, type Expression, type ExpressionList } from "../../sync/expressions";
import { type GifResult, type GifStatus, gifObjectUrl, gifPage, gifStatus } from "../../sync/gifs";
import { STICKER_PACKS } from "../../sync/stickers";
import { UploadDialog } from "../workspace/ExpressionsPage";
import { useCommunityAccess } from "../community/useCommunityAccess";
import { CustomEmojiImage, useExpressions } from "../community/CustomEmoji";
import { useFocusTrap } from "../components/Overlay";
import { ExpressionLibrary } from "./ExpressionLibrary";
import { EmojiPicker } from "./EmojiPicker";
import { StickerArt } from "./StickerView";

/**
 * The composer's picker (continuation brief v3 §11): one popover with three tabs in this order, Emoji → GIFs →
 * Stickers, opened on the tab of the toolbar button pressed. Emoji go in at the caret; a GIF or sticker is sent as its
 * own message. Escape or a click outside closes it; the draft and caret are kept.
 */
export type PickerTab = "emoji" | "gifs" | "stickers";
const TABS: { id: PickerTab; label: string }[] = [
  { id: "emoji", label: "Emoji" },
  { id: "gifs", label: "GIFs" },
  { id: "stickers", label: "Stickers" },
];

interface ExpressionPickerProps {
  anchor: HTMLElement;
  tab: PickerTab;
  onTab: (t: PickerTab) => void;
  onClose: () => void;
  onEmoji: (emoji: string) => void;
  /** Sending is allowed here (stickers and GIFs are messages of their own). */
  canSend: boolean;
  /** Community parity A1: the tabs this channel allows (text only and no-GIF channels); all when left out. */
  allowedTabs?: readonly PickerTab[];
  library?: { currentOrgId: string | null; externalAllowed: boolean };
  community?: { list: ExpressionList; onEmoji: (e: Expression) => void; onSticker: (e: Expression) => void };
  onSticker: (pack: string, id: string) => void;
  onAnimoji: (emoji: string) => void;
  onGif: (g: GifResult, provider: "tenor" | "giphy") => void;
}

export function ExpressionPicker(p: ExpressionPickerProps) {
  const engine = useEngine();
  const orgs = useOrbit((s) => s.orgs);
  const expressionsOn = useOrbit((s) => s.server?.features.includes("community-expressions") ?? false);
  const [source, setSource] = useState<string | null>(() => p.library?.currentOrgId ?? null);
  const availableSources = expressionsOn && p.library ? orgs.filter((o) => p.library!.externalAllowed || o.id === p.library!.currentOrgId) : [];
  const selectedSource = availableSources.find((o) => o.id === source) ?? null;
  const [revision, setRevision] = useState(0);
  const sourceList = useExpressions(selectedSource?.id ?? null, true, revision);
  const access = useCommunityAccess(selectedSource?.id ?? null);
  const canManage = !!selectedSource && !!access && (access.isOwner || access.effective.includes("expressions.manage"));
  const [uploading, setUploading] = useState<{ file: File; kind: "emoji" | "sticker"; orgId: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const community = p.library ? (selectedSource && sourceList && p.community ? { ...p.community, list: sourceList } : undefined) : p.community;
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; height: number } | null>(null);
  useFocusTrap(ref, !uploading);
  useLayoutEffect(() => {
    const place = () => {
      const v = visibleViewport();
      const r = p.anchor.getBoundingClientRect();
      const w = ref.current?.offsetWidth ?? 380;
      const phone = window.matchMedia(PHONE_LAYOUT).matches;
      const height = Math.min(460, Math.max(0, phone ? v.height - 16 : Math.min(v.height - 16, r.top - v.top - 16)));
      setPos({
        left: Math.max(v.left + 8, Math.min(r.right - w, v.right - w - 8)),
        top: Math.max(v.top + 8, (phone ? v.bottom : r.top) - height - 8),
        height,
      });
    };
    place();
    window.addEventListener("resize", place);
    window.visualViewport?.addEventListener("resize", place);
    window.visualViewport?.addEventListener("scroll", place);
    return () => {
      window.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("scroll", place);
    };
  }, [p.anchor]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (uploading || e.key !== "Escape") return;
      e.preventDefault();
      p.onClose();
      p.anchor.focus();
    };
    const down = (e: MouseEvent) => {
      if (!uploading && !ref.current?.contains(e.target as Node) && !p.anchor.contains(e.target as Node)) p.onClose();
    };
    document.addEventListener("keydown", key);
    document.addEventListener("mousedown", down);
    window.addEventListener("popstate", p.onClose);
    window.addEventListener(ROUTE_EVENT, p.onClose);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("mousedown", down);
      window.removeEventListener("popstate", p.onClose);
      window.removeEventListener(ROUTE_EVENT, p.onClose);
    };
  }, [p, uploading]);
  const tabs = TABS.filter((t) => t.id === "emoji" || (p.canSend && (!p.allowedTabs || p.allowedTabs.includes(t.id))));
  return createPortal(
    <>
      <div
        ref={ref}
        className="expression-picker"
        role="dialog"
        aria-label="Emoji, GIFs and stickers"
        inert={!!uploading}
        style={{ ...(pos ? { left: pos.left, top: pos.top, height: pos.height } : { visibility: "hidden" as const }), ...(uploading ? { zIndex: 49 } : {}) }}
      >
        <div className="xp-tabs" role="tablist" aria-label="Pick from">
          {tabs.map((t) => (
            <button key={t.id} role="tab" id={`xp-tab-${t.id}`} aria-selected={p.tab === t.id} aria-controls={`xp-panel-${t.id}`} onClick={() => p.onTab(t.id)}>
              {t.label}
            </button>
          ))}
          <button className="icon-btn xp-close" aria-label="Close expression picker" onClick={p.onClose}>
            <X size={18} />
          </button>
        </div>
        {p.library && expressionsOn && p.tab !== "gifs" && (
          <div className="xp-source">
            <label>
              <span className="hint">Community expressions</span>
              <select className="input" aria-label="Expression community" value={selectedSource?.id ?? ""} onChange={(e) => setSource(e.target.value || null)}>
                <option value="">All communities & standard</option>
                {availableSources.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
            {canManage && (
              <button className="btn btn-secondary btn-sm" aria-label={p.tab === "stickers" ? "Upload a sticker" : "Upload an emoji"} onClick={() => fileInput.current?.click()}>
                <Upload size={14} />
                <span>Upload</span>
              </button>
            )}
            {selectedSource && !sourceList && <small role="status">Loading community expressions…</small>}
            {p.library.currentOrgId && !p.library.externalAllowed && <small>Only this community's expressions are allowed in this channel.</small>}
          </div>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && selectedSource && canManage) setUploading({ file, kind: p.tab === "stickers" ? "sticker" : "emoji", orgId: selectedSource.id });
            e.target.value = "";
          }}
        />
        {p.library && expressionsOn && p.community && p.tab !== "gifs" && (
          <ExpressionLibrary
            source={selectedSource?.id ?? ""}
            orgIds={availableSources.map((o) => o.id)}
            kind={p.tab === "stickers" ? "sticker" : "emoji"}
            revision={revision}
            onPick={p.tab === "stickers" ? p.community.onSticker : p.community.onEmoji}
          />
        )}
        <div className="xp-panel" role="tabpanel" id={`xp-panel-${p.tab}`} aria-labelledby={`xp-tab-${p.tab}`}>
          {p.tab === "emoji" && <EmojiPicker onPick={p.onEmoji} community={!p.library && community ? { list: community.list, onEmoji: community.onEmoji } : undefined} />}
          {p.tab === "gifs" && <GifPicker onGif={p.onGif} />}
          {p.tab === "stickers" && <StickerPicker community={p.library ? undefined : community} onSticker={p.onSticker} onAnimoji={p.onAnimoji} />}
        </div>
      </div>
      {uploading && (
        <UploadDialog
          file={uploading.file}
          kind={uploading.kind}
          title={uploading.kind === "emoji" ? "Upload an emoji" : "Upload a sticker"}
          initial={suggestName(uploading.file.name)}
          onClose={() => setUploading(null)}
          onSave={async (name, bytes) => {
            await uploadExpression(engine, uploading.orgId, uploading.kind, name, bytes);
            setRevision((r) => r + 1);
          }}
        />
      )}
    </>,
    document.body,
  );
}

/** What the toolbar's three buttons look like, in the picker's order. */
export const PICKER_BUTTONS: { tab: PickerTab; label: string; icon: React.ReactNode }[] = [
  { tab: "emoji", label: "Emoji", icon: <Smile size={18} /> },
  { tab: "gifs", label: "GIFs", icon: <span className="gif-glyph">GIF</span> },
  { tab: "stickers", label: "Stickers", icon: <StickerIcon size={18} /> },
];

const SEARCH_DELAY_MS = 350;

function GifPicker({ onGif }: { onGif: (g: GifResult, provider: "tenor" | "giphy") => void }) {
  const engine = useEngine();
  const [status, setStatus] = useState<GifStatus | null>(null);
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GifResult[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const search = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    gifStatus(engine)
      .then((s) => live && setStatus(s))
      .catch(() => live && setStatus({ configured: false, provider: null, attribution: null }));
    return () => {
      live = false;
    };
  }, [engine]);
  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    if (!status?.configured) return;
    let live = true;
    setResults(null);
    setError(null);
    gifPage(engine, query)
      .then((page) => {
        if (!live) return;
        setResults(page.results);
        setNext(page.next);
      })
      .catch((e: unknown) => live && setError(e instanceof ApiError ? e.message : "Couldn't load GIFs."));
    return () => {
      live = false;
    };
  }, [engine, status, query, attempt]);
  useEffect(() => {
    if (status?.configured) search.current?.focus();
  }, [status]);

  const more = () => {
    if (!next) return;
    void gifPage(engine, query, next)
      .then((page) => {
        setResults((r) => [...(r ?? []), ...page.results]);
        setNext(page.next);
      })
      .catch(() => setNext(null));
  };

  if (!status) return <div className="skeleton" style={{ height: 240 }} aria-busy="true" />;
  if (!status.configured)
    return (
      <div className="xp-empty" role="status">
        <strong>GIFs aren&apos;t set up on this server yet.</strong>
        <span className="faint">Its administrator can turn them on by adding a GIF provider (Tenor or GIPHY).</span>
      </div>
    );
  return (
    <div className="gif-picker">
      <label className="xp-search">
        <Search size={15} aria-hidden="true" />
        <input ref={search} type="search" value={q} maxLength={80} onChange={(e) => setQ(e.target.value)} placeholder="Search GIFs" aria-label="Search GIFs" />
      </label>
      {error && (
        <div className="banner danger" role="alert">
          <span className="grow">{error}</span>
          <button className="btn btn-secondary btn-sm" onClick={() => setAttempt((n) => n + 1)}>
            Retry
          </button>
        </div>
      )}
      {!results && !error && <div className="skeleton" style={{ height: 200 }} aria-busy="true" />}
      {results && results.length === 0 && <p className="faint xp-empty">No GIFs found{query ? ` for "${query}"` : ""}.</p>}
      {results && results.length > 0 && (
        <div
          className="gif-grid"
          onScroll={(e) => {
            const el = e.currentTarget;
            if (el.scrollTop + el.clientHeight > el.scrollHeight - 120) more();
          }}
        >
          {results.map((g) => (
            <GifTile key={g.id} gif={g} onPick={() => onGif(g, status.provider!)} />
          ))}
        </div>
      )}
      {status.attribution && <small className="faint xp-attribution">{status.attribution}</small>}
    </div>
  );
}

/** A preview tile: loaded through the server only when it's about to be seen. */
function GifTile({ gif, onPick }: { gif: GifResult; onPick: () => void }) {
  const engine = useEngine();
  const ref = useRef<HTMLButtonElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let live = true;
    const load = () => void gifObjectUrl(engine, gif.preview.url).then((u) => live && setUrl(u));
    if (typeof IntersectionObserver === "undefined") load();
    else {
      const io = new IntersectionObserver((entries) => {
        if (entries.some((x) => x.isIntersecting)) {
          io.disconnect();
          load();
        }
      });
      io.observe(el);
      return () => {
        live = false;
        io.disconnect();
      };
    }
    return () => {
      live = false;
    };
  }, [engine, gif.preview.url]);
  return (
    <button ref={ref} type="button" className="gif-tile" style={{ aspectRatio: `${gif.preview.width} / ${gif.preview.height}` }} onClick={onPick} aria-label={`Send GIF: ${gif.title || "GIF"}`}>
      {url ? <MotionImage src={url} alt="" /> : <span className="skeleton" />}
    </button>
  );
}

function StickerPicker({
  community,
  onSticker,
  onAnimoji,
}: {
  community?: { list: ExpressionList; onSticker: (e: Expression) => void };
  onSticker: (pack: string, id: string) => void;
  onAnimoji: (emoji: string) => void;
}) {
  const custom = community ? community.list.expressions.filter((e) => e.kind === "sticker") : [];
  return (
    <div className="sticker-tab">
      {custom.length > 0 && (
        <section aria-label="This community's stickers">
          <h3 className="xp-heading">This community</h3>
          <div className="sticker-grid">
            {custom.map((e) => (
              <button key={e.id} type="button" aria-label={`Send sticker :${e.name}:`} title={`:${e.name}:`} onClick={() => community?.onSticker(e)}>
                <CustomEmojiImage id={e.id} name={e.name} sha256={e.sha256} sticker />
              </button>
            ))}
          </div>
        </section>
      )}
      {STICKER_PACKS.map((pack) => (
        <section key={pack.id} aria-label={pack.name}>
          <h3 className="xp-heading">{pack.name}</h3>
          <div className="sticker-picker">
            {pack.stickers.map((s) => (
              <button key={s.id} type="button" aria-label={`Send sticker: ${s.caption}`} title={s.caption} onClick={() => onSticker(pack.id, s.id)}>
                <StickerArt spec={s} size={60} still />
              </button>
            ))}
          </div>
        </section>
      ))}
      <section aria-label="Animated emoji">
        <h3 className="xp-heading">Animated emoji</h3>
        <div className="emoji-grid">
          {ANIMOJI.map(([em]) => (
            <button key={em} type="button" aria-label={`Send animated ${em}`} onClick={() => onAnimoji(em)}>
              {em}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
