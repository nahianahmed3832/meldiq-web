import { Search, Smile, Sticker as StickerIcon } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ApiError } from "../../api/client";
import { useEngine } from "../../application/orbit";
import { ANIMOJI } from "../../sync/animoji";
import type { Expression, ExpressionList } from "../../sync/expressions";
import { type GifResult, type GifStatus, gifObjectUrl, gifPage, gifStatus } from "../../sync/gifs";
import { STICKER_PACKS } from "../../sync/stickers";
import { CustomEmojiImage } from "../community/CustomEmoji";
import { useFocusTrap } from "../components/Overlay";
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
  community?: { list: ExpressionList; onEmoji: (e: Expression) => void; onSticker: (e: Expression) => void };
  onSticker: (pack: string, id: string) => void;
  onAnimoji: (emoji: string) => void;
  onGif: (g: GifResult, provider: "tenor" | "giphy") => void;
}

export function ExpressionPicker(p: ExpressionPickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; bottom: number } | null>(null);
  useFocusTrap(ref, true);
  useLayoutEffect(() => {
    const r = p.anchor.getBoundingClientRect();
    const w = ref.current?.offsetWidth ?? 380;
    setPos({ left: Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8)), bottom: Math.max(8, window.innerHeight - r.top + 8) });
  }, [p.anchor]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      p.onClose();
      p.anchor.focus();
    };
    const down = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node) && !p.anchor.contains(e.target as Node)) p.onClose();
    };
    document.addEventListener("keydown", key);
    document.addEventListener("mousedown", down);
    window.addEventListener("resize", p.onClose);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("mousedown", down);
      window.removeEventListener("resize", p.onClose);
    };
  }, [p]);
  const tabs = TABS.filter((t) => t.id === "emoji" || p.canSend);
  return createPortal(
    <div ref={ref} className="expression-picker" role="dialog" aria-label="Emoji, GIFs and stickers" style={pos ? { left: pos.left, bottom: pos.bottom } : { visibility: "hidden" }}>
      <div className="xp-tabs" role="tablist" aria-label="Pick from">
        {tabs.map((t) => (
          <button key={t.id} role="tab" id={`xp-tab-${t.id}`} aria-selected={p.tab === t.id} aria-controls={`xp-panel-${t.id}`} onClick={() => p.onTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="xp-panel" role="tabpanel" id={`xp-panel-${p.tab}`} aria-labelledby={`xp-tab-${p.tab}`}>
        {p.tab === "emoji" && <EmojiPicker onPick={p.onEmoji} community={p.community ? { list: p.community.list, onEmoji: p.community.onEmoji } : undefined} />}
        {p.tab === "gifs" && <GifPicker onGif={p.onGif} />}
        {p.tab === "stickers" && <StickerPicker community={p.community} onSticker={p.onSticker} onAnimoji={p.onAnimoji} />}
      </div>
    </div>,
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
      {url ? <img src={url} alt="" draggable={false} /> : <span className="skeleton" />}
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
