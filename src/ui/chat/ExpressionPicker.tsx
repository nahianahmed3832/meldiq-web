import { MotionImage } from "../components/MotionImage";
import { Search, Smile, Upload, X } from "lucide-react";
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
import { useFocusTrap } from "../components/Overlay";
import { ExpressionLibrary } from "./ExpressionLibrary";
import { EmojiPicker } from "./EmojiPicker";
import { StickerArt } from "./StickerView";

/** Permissions still distinguish media types; the interface uses one searchable collection. */
export type PickerTab = "emoji" | "gifs" | "stickers";
interface ExpressionPickerProps {
  anchor: HTMLElement;
  tab: PickerTab;
  onTab: (tab: PickerTab) => void;
  onClose: () => void;
  onEmoji: (emoji: string) => void;
  canSend: boolean;
  allowedTabs?: readonly PickerTab[];
  library?: { currentOrgId: string | null; externalAllowed: boolean };
  community?: { list: ExpressionList; onEmoji: (e: Expression) => void; onSticker: (e: Expression) => void };
  onSticker: (pack: string, id: string) => void;
  onAnimoji: (emoji: string) => void;
  onGif: (gif: GifResult, provider: "tenor" | "giphy") => void;
}

export function ExpressionPicker(p: ExpressionPickerProps) {
  const engine = useEngine();
  const orgs = useOrbit((state) => state.orgs);
  const expressionsOn = useOrbit((state) => state.server?.features.includes("community-expressions") ?? false);
  const sources =
    expressionsOn && p.library
      ? orgs.filter((org) => p.library!.externalAllowed || org.id === p.library!.currentOrgId).sort((a, b) => Number(b.id === p.library!.currentOrgId) - Number(a.id === p.library!.currentOrgId))
      : [];
  const [query, setQuery] = useState("");
  const [uploadOptions, setUploadOptions] = useState(false);
  const [target, setTarget] = useState(p.library?.currentOrgId ?? "");
  const source = sources.find((org) => org.id === target) ?? sources[0] ?? null;
  const [kind, setKind] = useState<"emoji" | "sticker">("emoji");
  const [revision, setRevision] = useState(0);
  const access = useCommunityAccess(source?.id ?? null);
  const canManage = !!source && !!access && (access.isOwner || access.effective.includes("expressions.manage"));
  const stickers = p.canSend && (!p.allowedTabs || p.allowedTabs.includes("stickers"));
  const gifs = p.canSend && (!p.allowedTabs || p.allowedTabs.includes("gifs"));
  const [uploading, setUploading] = useState<{ file: File; kind: "emoji" | "sticker"; orgId: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; height: number } | null>(null);
  useFocusTrap(ref, !uploading);
  useLayoutEffect(() => {
    const place = () => {
      const viewport = visibleViewport();
      const anchor = p.anchor.getBoundingClientRect();
      const width = ref.current?.offsetWidth ?? 420;
      const phone = window.matchMedia(PHONE_LAYOUT).matches;
      const height = Math.min(600, Math.max(0, phone ? viewport.height - 16 : Math.min(viewport.height - 16, anchor.top - viewport.top - 16)));
      setPos({
        left: Math.max(viewport.left + 8, Math.min(anchor.right - width, viewport.right - width - 8)),
        top: Math.max(viewport.top + 8, (phone ? viewport.bottom : anchor.top) - height - 8),
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
    const key = (event: KeyboardEvent) => {
      if (uploading || event.key !== "Escape") return;
      event.preventDefault();
      p.onClose();
      p.anchor.focus();
    };
    const down = (event: MouseEvent) => {
      if (!uploading && !ref.current?.contains(event.target as Node) && !p.anchor.contains(event.target as Node)) p.onClose();
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
  const matches = (text: string) =>
    query
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .every((word) => text.toLowerCase().includes(word));
  return createPortal(
    <>
      <div
        ref={ref}
        className="expression-picker unified"
        role="dialog"
        aria-label="Expressions"
        inert={!!uploading}
        style={{ ...(pos ? { left: pos.left, top: pos.top, height: pos.height } : { visibility: "hidden" as const }), ...(uploading ? { zIndex: 49 } : {}) }}
      >
        <header className="xp-unified-search">
          <label>
            <Search size={17} aria-hidden="true" />
            <input type="search" aria-label="Search emoji and expressions" placeholder="Find the perfect emoji" value={query} maxLength={60} onChange={(event) => setQuery(event.target.value)} />
          </label>
          {!!sources.length && (
            <button className="icon-btn" aria-label="Upload expressions" aria-expanded={uploadOptions} title="Upload an expression" onClick={() => setUploadOptions((value) => !value)}>
              <Upload size={18} />
            </button>
          )}
          <button className="icon-btn" aria-label="Close expression picker" onClick={p.onClose}>
            <X size={18} />
          </button>
        </header>
        {uploadOptions && (
          <div className="xp-upload-options">
            <label>
              Upload to
              <select className="input" aria-label="Upload community" value={source?.id ?? ""} onChange={(event) => setTarget(event.target.value)}>
                {sources.map((org) => (
                  <option value={org.id} key={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Use as
              <select className="input" aria-label="Upload expression type" value={kind} onChange={(event) => setKind(event.target.value as "emoji" | "sticker")}>
                <option value="emoji">Emoji</option>
                <option value="sticker">Sticker</option>
              </select>
            </label>
            <button className="btn btn-secondary btn-sm" disabled={!canManage} onClick={() => fileInput.current?.click()}>
              Choose image
            </button>
            {!canManage && <small className="hint">You need Manage expressions permission to upload to this community.</small>}
          </div>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file && source && canManage) setUploading({ file, kind, orgId: source.id });
            event.target.value = "";
          }}
        />
        <div className="xp-unified-content">
          {p.library && expressionsOn && p.community && (
            <ExpressionLibrary
              orgIds={sources.map((org) => org.id)}
              stickers={stickers}
              query={query}
              revision={revision}
              onPick={(expression) => (expression.kind === "sticker" ? p.community?.onSticker(expression) : p.community?.onEmoji(expression))}
            />
          )}
          <EmojiPicker embedded query={query} onPick={p.onEmoji} community={!p.library ? p.community : undefined} />
          {stickers &&
            STICKER_PACKS.map((pack) => {
              const items = pack.stickers.filter((item) => matches([pack.name, item.caption, ...item.keywords].join(" ")));
              return (
                items.length > 0 && (
                  <section key={pack.id} className="xp-expression-group" aria-label={pack.name}>
                    <h3 className="xp-group-heading">{pack.name}</h3>
                    <div className="xp-expression-grid">
                      {items.map((item) => (
                        <button className="xp-builtin" key={item.id} type="button" aria-label={`Send sticker: ${item.caption}`} title={item.caption} onClick={() => p.onSticker(pack.id, item.id)}>
                          <StickerArt spec={item} size={36} still />
                        </button>
                      ))}
                    </div>
                  </section>
                )
              );
            })}
          {stickers && !query && (
            <section className="xp-expression-group" aria-label="Animated emoji">
              <h3 className="xp-group-heading">Animated emoji</h3>
              <div className="xp-expression-grid">
                {ANIMOJI.map(([emoji]) => (
                  <button className="xp-builtin" key={emoji} aria-label={`Send animated ${emoji}`} onClick={() => p.onAnimoji(emoji)}>
                    {emoji}
                  </button>
                ))}
              </div>
            </section>
          )}
          {gifs && <GifPicker query={query} onGif={p.onGif} />}
        </div>
        <footer className="xp-unified-foot">Community expressions · right-click or hold to favorite</footer>
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
            setRevision((value) => value + 1);
          }}
        />
      )}
    </>,
    document.body,
  );
}

export const PICKER_BUTTONS: { tab: PickerTab; label: string; icon: React.ReactNode }[] = [{ tab: "emoji", label: "Emoji", icon: <Smile size={18} /> }];

const SEARCH_DELAY_MS = 350;

function GifPicker({ onGif, query: sharedQuery }: { onGif: (g: GifResult, provider: "tenor" | "giphy") => void; query: string }) {
  const engine = useEngine();
  const [status, setStatus] = useState<GifStatus | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GifResult[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

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
    const t = setTimeout(() => setQuery(sharedQuery.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(t);
  }, [sharedQuery]);
  useEffect(() => {
    if (!status?.configured || !query) return;
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

  const more = () => {
    if (!next) return;
    void gifPage(engine, query, next)
      .then((page) => {
        setResults((r) => [...(r ?? []), ...page.results]);
        setNext(page.next);
      })
      .catch(() => setNext(null));
  };

  if (!sharedQuery.trim() || !status?.configured) return null;
  return (
    <div className="gif-picker">
      <h3 className="xp-group-heading">GIFs</h3>
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
      {next && (
        <button className="btn btn-ghost btn-sm" onClick={more}>
          More GIFs
        </button>
      )}
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
