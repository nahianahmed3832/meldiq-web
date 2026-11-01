import { userProfile } from "../../sync/account";
import { useLoad } from "../workspace/useLoad";
import { usePhoto } from "../components/photos";
import { useEffect, useState } from "react";
import { Sparkles, Star, Lock, Check, ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import { COLLECTION_CATEGORIES, CATEGORY_LABELS, type CollectionCategory, type Collectible } from "../../api/collectibleSchemas";
import type { ProfileStyle } from "../../api/profileSchemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { claimCollectible, collectionInventory, collectionPage, customization, equipCollection, favoriteCollectible, previewCollectible, type Customization } from "../../sync/collectibles";
import { Dialog } from "../components/Overlay";
import { StyledName } from "../people/NameStyle";
import { StyledAvatar, ProfileEffect, useReducedMotion } from "../people/ProfileStyle";
import { CollectibleBadge, CollectibleBanner, collectibleCardVars, recipeBackground } from "../people/CollectibleLayers";
import { NO_STYLE } from "./noStyle";
import { collectionAsset } from "../../sync/collectibles";
type Inventory = Awaited<ReturnType<typeof collectionInventory>>["inventory"];
export function CollectionStudio() {
  const [open, setOpen] = useState(false);
  const enabled = useOrbit((s) => s.server?.features.includes("profile-collectibles") ?? false);
  if (!enabled) return null;
  return (
    <>
      <button className="collection-launch" onClick={() => setOpen(true)}>
        <span className="collection-launch-mark">
          <Sparkles size={25} />
        </span>
        <span className="lines grow">
          <strong>Your profile. Your universe.</strong>
          <small>Explore the Nightwave collection · frames, themes & more</small>
        </span>
        <ArrowRight size={20} />
      </button>
      {open && <Studio onClose={() => setOpen(false)} />}
    </>
  );
}
function Studio({ onClose }: { onClose: () => void }) {
  const engine = useEngine();
  const reducedMotion = useReducedMotion();
  const me = useOrbit((s) => s.me);
  const photoRev = useOrbit((s) => (s.me ? (s.users[s.me.userId]?.photoRev ?? null) : null));
  const profilesRev = useOrbit((s) => s.profilesRev);
  const profile = useLoad(() => (me ? userProfile(engine, me.userId) : Promise.resolve(null)), [engine, me?.userId, profilesRev]);
  const bannerKind = profile.data?.profileBanner?.kind;
  const bannerUrl = usePhoto("profileBanner", me?.userId ?? "", profile.data?.profileBanner?.rev, bannerKind === "gif" ? "image/gif" : bannerKind === "webp" ? "image/webp" : "image/jpeg");

  const [category, setCategory] = useState<CollectionCategory>("avatar-frame");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [history, setHistory] = useState<(string | null)[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [items, setItems] = useState<Collectible[]>([]);
  const [inventory, setInventory] = useState<Inventory>([]);
  const [base, setBase] = useState<Customization | null>(null);
  const [draft, setDraft] = useState<ProfileStyle>(NO_STYLE);
  const [slots, setSlots] = useState<Partial<Record<CollectionCategory, string | null>>>({});
  const [selected, setSelected] = useState<Collectible | null>(null);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query);
      setCursor(null);
      setHistory([]);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    let alive = true;
    customization(engine)
      .then((s) => {
        if (alive) {
          setBase(s);
          setDraft(s.profileStyle ?? NO_STYLE);
        }
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [engine]);
  useEffect(() => {
    let alive = true;
    collectionInventory(engine)
      .then((i) => {
        if (alive) setInventory((previous) => (JSON.stringify(previous) === JSON.stringify(i.inventory) ? previous : i.inventory));
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [engine, profilesRev]);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    collectionPage(engine, category, search, cursor, filter)
      .then((p) => {
        if (alive) {
          setItems(p.items);
          setNext(p.next);
        }
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [engine, category, search, cursor, filter, inventory]);
  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save this change.");
    } finally {
      setBusy(false);
    }
  };
  const choose = (item: Collectible | null) => {
    setSelected(item);
    setDraft((s) => previewCollectible(s, item, category));
    setSlots((s) => ({ ...s, [category]: item?.id ?? null }));
  };
  const own = (id: string) => inventory.find((x) => x.decoration_id === id);
  const visible = items;
  const missing = Object.values(slots).some((id) => id && !own(id));
  const dirty = Object.keys(slots).length > 0;
  if (!me) return null;
  return (
    <Dialog
      title="Profile collection"
      onClose={onClose}
      width="min(1180px, 97vw)"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
          <button
            className="btn btn-secondary"
            disabled={busy || !base}
            onClick={() =>
              void run(async () => {
                const s = await customization(engine);
                setInventory((await collectionInventory(engine)).inventory);
                setBase(s);
                setDraft(s.profileStyle ?? NO_STYLE);
                setSlots({});
                setSelected(null);
                setNotice("Latest look loaded.");
              })
            }
          >
            Reload saved look
          </button>
          <button
            className="btn btn-primary"
            disabled={busy || !base || !dirty || missing}
            onClick={() =>
              void run(async () => {
                const s = await equipCollection(engine, base!.styleRevision, slots);
                setBase(s);
                setDraft(s.profileStyle ?? NO_STYLE);
                setSlots({});
                setNotice("Your look is saved across your devices.");
              })
            }
          >
            {busy ? "Saving…" : "Apply look"}
          </button>
        </>
      }
    >
      <div className="dialog-body collection-studio">
        <div className="collection-hero">
          <span className="collection-eyebrow">THE NIGHTWAVE COLLECTION</span>
          <h2>A little more you.</h2>
          <p>Find your signature. Collect something unexpected.</p>
          <span>Original Meldiq designs · One look, everywhere</span>
        </div>
        {error && (
          <p className="banner danger" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="banner" role="status">
            {notice}
          </p>
        )}
        <div className="collection-layout">
          <section className="collection-browser" aria-label="Decoration marketplace">
            <div className="collection-categories" aria-label="Decoration categories">
              {COLLECTION_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  aria-pressed={cat === category}
                  onClick={() => {
                    setCategory(cat);
                    setSelected(null);
                    setCursor(null);
                    setHistory([]);
                  }}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
            <div className="collection-tools">
              <input maxLength={80} aria-label="Search decorations" placeholder="Find your next favorite…" value={query} onChange={(e) => setQuery(e.target.value)} />
              <select
                aria-label="Filter decorations"
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setCursor(null);
                  setHistory([]);
                }}
              >
                <option value="all">Marketplace</option>
                <option value="owned">My inventory</option>
                <option value="unowned">Not collected</option>
                <option value="favorites">Favorites</option>
                <option value="recent">Recently acquired</option>
              </select>
            </div>
            <p className="faint">{CATEGORY_LABELS[category]}</p>
            {loading ? (
              <p role="status">Loading collection…</p>
            ) : (
              <div className="collection-grid">
                <button className="collection-item collection-none" aria-pressed={slots[category] === null} onClick={() => choose(null)}>
                  <span className="collection-art">
                    <RotateCcw size={26} />
                  </span>
                  <strong>Default</strong>
                  <small>Unequip this category</small>
                </button>
                {visible.map((item) => (
                  <div className={`collection-item rarity-${item.rarity}`} key={item.id}>
                    <button className="collection-pick" aria-pressed={draft.collectibles?.some((x) => x.id === item.id) ?? false} onClick={() => choose(item)}>
                      <span className="collection-art" style={recipeBackground(item)}>
                        {item.recipe.assetId ? (
                          <img loading="lazy" src={collectionAsset(item.recipe.assetId, "thumbnail")} alt="" />
                        ) : item.category === "avatar-frame" ? (
                          <span className="collection-avatar-sample">M</span>
                        ) : item.category === "name-effect" ? (
                          <span className="collection-name-sample">Meldiq</span>
                        ) : item.category === "badge" ? (
                          <span className="collection-gem">✦</span>
                        ) : (
                          <span className={`collection-artwork collection-artwork-${item.recipe.pattern}`} />
                        )}
                      </span>
                      <strong>{item.name}</strong>
                      <small>
                        {item.rarity} {item.isFeatured ? "· Featured" : ""}
                      </small>
                      <span className="collection-ownership">
                        {own(item.id) ? (
                          <>
                            <Check size={12} /> Owned
                          </>
                        ) : item.acquisitionType === "free" ? (
                          "Free to collect"
                        ) : (
                          <>
                            <Lock size={12} />
                            {item.acquisitionType === "purchase"
                              ? item.currency === "EMBERS"
                                ? `${item.price} Embers`
                                : `USD ${(item.price / 100).toFixed(2)}`
                              : item.acquisitionType === "premium"
                                ? "Premium grant"
                                : "Event reward"}
                          </>
                        )}
                      </span>
                    </button>
                    <button
                      className="collection-star"
                      aria-label={`${own(item.id)?.is_favorite ? "Unfavorite" : "Favorite"} ${item.name}`}
                      aria-pressed={!!own(item.id)?.is_favorite}
                      disabled={busy || !own(item.id)}
                      title={own(item.id) ? "Favorite" : "Collect to favorite"}
                      onClick={() =>
                        void run(async () => {
                          await favoriteCollectible(engine, item.id, !own(item.id)?.is_favorite);
                          setInventory((await collectionInventory(engine)).inventory);
                        })
                      }
                    >
                      <Star size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {!loading && !visible.length && <p role="status">No matching decorations. Try another filter.</p>}
            <div className="collection-pagination">
              <button
                className="btn btn-secondary"
                disabled={!history.length || loading}
                onClick={() => {
                  setCursor(history.at(-1) ?? null);
                  setHistory((h) => h.slice(0, -1));
                }}
              >
                <ArrowLeft size={14} />
                Previous
              </button>
              <button
                className="btn btn-secondary"
                disabled={!next || loading}
                onClick={() => {
                  setHistory((h) => [...h, cursor]);
                  setCursor(next);
                }}
              >
                Next
                <ArrowRight size={14} />
              </button>
            </div>
          </section>
          <aside className="collection-preview" aria-label="Live profile preview">
            <span className="collection-eyebrow">LIVE PREVIEW</span>
            <div className="collection-profile" style={collectibleCardVars(draft, !reducedMotion)}>
              <div className="collection-profile-banner" style={bannerUrl ? { backgroundImage: `url(${bannerUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
                <CollectibleBanner style={draft} />
                <ProfileEffect effect={draft.effect} />
              </div>
              <div className="collection-profile-body">
                <StyledAvatar
                  userId={me.userId}
                  name={me.displayName}
                  colorIndex={me.avatarColor}
                  photoRev={photoRev}
                  media={profile.data?.avatarMedia ?? null}
                  decoration={draft.decoration}
                  collectibles={draft.collectibles}
                  size={80}
                />
                <h3>
                  <StyledName name={me.displayName} style={draft} />
                </h3>
                <small>@{me.username}</small>
                <p>{profile.data?.aboutMe || "Good conversations start with a little personality."}</p>
                <CollectibleBadge style={draft} />
              </div>
            </div>
            <div className="collection-detail" aria-live="polite">
              {selected ? (
                <>
                  <span className="collection-eyebrow">
                    {selected.rarity.toUpperCase()} · {CATEGORY_LABELS[selected.category]}
                  </span>
                  <h3>{selected.name}</h3>
                  <p>{selected.description}</p>
                  <small>{selected.supportedPlatforms.map((p) => ({ web: "Web", android: "Android", windows: "Windows", macos: "macOS" })[p]).join(" · ")}</small>
                  {!own(selected.id) &&
                    (selected.acquisitionType === "free" ? (
                      <button
                        className="btn btn-primary"
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            setInventory((await claimCollectible(engine, selected.id)).inventory);
                            setNotice("Added to your inventory. Apply your look when ready.");
                          })
                        }
                      >
                        Collect for free
                      </button>
                    ) : (
                      <p className="faint">
                        <Lock size={13} />{" "}
                        {selected.acquisitionType === "premium"
                          ? "Requires an authorized premium grant."
                          : selected.acquisitionType === "event"
                            ? "Awarded through a Meldiq event."
                            : "Purchases are not available for this item yet."}
                      </p>
                    ))}
                </>
              ) : (
                <p>Select a decoration to try it on.</p>
              )}
              {missing && <p className="faint">Collect every selected item before applying.</p>}
              {dirty && <small role="status">Unsaved preview</small>}
            </div>
            <button
              className="btn btn-ghost"
              disabled={busy || !base}
              onClick={() => {
                let s: ProfileStyle = base?.profileStyle ?? NO_STYLE;
                const reset: Partial<Record<CollectionCategory, null>> = {};
                for (const cat of COLLECTION_CATEGORIES) {
                  s = previewCollectible(s, null, cat);
                  reset[cat] = null;
                }
                setDraft(s);
                setSlots(reset);
                setSelected(null);
              }}
            >
              Reset to default
            </button>
          </aside>
        </div>
      </div>
    </Dialog>
  );
}
