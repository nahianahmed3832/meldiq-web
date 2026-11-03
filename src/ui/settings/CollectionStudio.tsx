import { Localized } from "../../i18n/Localized";
import { formatCurrency } from "../../i18n/format";
import { useT as useLocalization } from "../../i18n";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { PurchaseCollectible } from "../operations/PlatformInbox";
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
  useLocaleRender();
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
          <strong>
            <Localized k="settings.interface.your_profile_your_universe_df6faaf" />
          </strong>
          <small>
            <Localized k="settings.interface.explore_the_nightwave_collection_frames_themes_more_bbffd2e" />
          </small>
        </span>
        <ArrowRight size={20} />
      </button>
      {open && <Studio onClose={() => setOpen(false)} />}
    </>
  );
}
function Studio({ onClose }: { onClose: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
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
      setError(e instanceof Error ? e.message : uiText("settings.interface.couldn_t_save_this_change_7bec452"));
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
      title={uiText("settings.interface.profile_collection_9660e1c")}
      onClose={onClose}
      width="min(1180px, 97vw)"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            {l10n("common.actions.close")}
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
                setNotice(uiText("settings.interface.latest_look_loaded_a5e8e2e"));
              })
            }
          >
            <Localized k="settings.interface.reload_saved_look_7d75aa0" />
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
                setNotice(uiText("settings.interface.your_look_is_saved_across_your_devices_b9e2e32"));
              })
            }
          >
            {busy ? l10n("common.common_saving") : uiText("settings.interface.apply_look_5ed04ba")}
          </button>
        </>
      }
    >
      <div className="dialog-body collection-studio">
        <div className="collection-hero">
          <span className="collection-eyebrow">
            <Localized k="settings.interface.the_nightwave_collection_86e0408" />
          </span>
          <h2>
            <Localized k="settings.interface.a_little_more_you_23be67e" />
          </h2>
          <p>
            <Localized k="settings.interface.find_your_signature_collect_something_unexpected_60489d6" />
          </p>
          <span>
            <Localized k="settings.interface.original_meldiq_designs_one_look_everywhere_986cd81" />
          </span>
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
          <section className="collection-browser" aria-label={uiText("settings.interface.decoration_marketplace_403e6c9")}>
            <div className="collection-categories" aria-label={uiText("settings.interface.decoration_categories_c6d2676")}>
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
              <input
                maxLength={80}
                aria-label={uiText("settings.interface.search_decorations_2f59222")}
                placeholder={uiText("settings.interface.find_your_next_favorite_ccd0a32")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <select
                aria-label={uiText("settings.interface.filter_decorations_5521343")}
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setCursor(null);
                  setHistory([]);
                }}
              >
                <option value="all">
                  <Localized k="settings.interface.marketplace_c608981" />
                </option>
                <option value="owned">
                  <Localized k="settings.interface.my_inventory_bd18c24" />
                </option>
                <option value="unowned">
                  <Localized k="settings.interface.not_collected_f6b1360" />
                </option>
                <option value="favorites">
                  <Localized k="settings.interface.favorites_7a1f2a8" />
                </option>
                <option value="recent">
                  <Localized k="settings.interface.recently_acquired_aff5bf7" />
                </option>
              </select>
            </div>
            <p className="faint">{CATEGORY_LABELS[category]}</p>
            {loading ? (
              <p role="status">
                <Localized k="settings.interface.loading_collection_1514df6" />
              </p>
            ) : (
              <div className="collection-grid">
                <button className="collection-item collection-none" aria-pressed={slots[category] === null} onClick={() => choose(null)}>
                  <span className="collection-art">
                    <RotateCcw size={26} />
                  </span>
                  <strong>{l10n("settings.ap_default")}</strong>
                  <small>
                    <Localized k="settings.interface.unequip_this_category_1c6d7e6" />
                  </small>
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
                        {item.rarity} {item.isFeatured ? uiText("settings.interface.featured_226bd9d") : ""}
                      </small>
                      <span className="collection-ownership">
                        {own(item.id) ? (
                          <>
                            <Localized k="settings.interface.owned_86314b9" slots={[<Check size={12} />]} />
                          </>
                        ) : item.acquisitionType === "free" ? (
                          uiText("settings.interface.free_to_collect_36d7058")
                        ) : (
                          <>
                            <Lock size={12} />
                            {item.acquisitionType === "purchase"
                              ? item.currency === "EMBERS"
                                ? uiText("workspace.interface.value0_embers_f4866b3", { value0: item.price })
                                : formatCurrency(item.price / 100, "USD")
                              : item.acquisitionType === "premium"
                                ? uiText("settings.interface.premium_grant_91cbf56")
                                : uiText("settings.interface.event_reward_5fac2b5")}
                          </>
                        )}
                      </span>
                    </button>
                    <button
                      className="collection-star"
                      aria-label={uiText("auth.interface.value0_value1_54ef3bb", {
                        value0: own(item.id)?.is_favorite ? uiText("messaging.interface.unfavorite_de9bba0") : uiText("settings.interface.favorite_ea713ec"),
                        value1: item.name,
                      })}
                      aria-pressed={!!own(item.id)?.is_favorite}
                      disabled={busy || !own(item.id)}
                      title={own(item.id) ? uiText("settings.interface.favorite_ea713ec") : uiText("settings.interface.collect_to_favorite_61cff99")}
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
            {!loading && !visible.length && (
              <p role="status">
                <Localized k="settings.interface.no_matching_decorations_try_another_filter_592c23e" />
              </p>
            )}
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
                {l10n("common.actions.previous")}
              </button>
              <button
                className="btn btn-secondary"
                disabled={!next || loading}
                onClick={() => {
                  setHistory((h) => [...h, cursor]);
                  setCursor(next);
                }}
              >
                {l10n("common.actions.next")}
                <ArrowRight size={14} />
              </button>
            </div>
          </section>
          <aside className="collection-preview" aria-label={uiText("settings.interface.live_profile_preview_03d4b29")}>
            <span className="collection-eyebrow">
              <Localized k="settings.interface.live_preview_9da051d" />
            </span>
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
                <p>{profile.data?.aboutMe || uiText("settings.interface.good_conversations_start_with_a_little_personality_f7e1813")}</p>
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
                  <small>
                    {selected.supportedPlatforms
                      .map(
                        (p) =>
                          ({
                            web: uiText("settings.interface.web_2975104"),
                            android: "Android",
                            windows: "Windows",
                            macos: "macOS",
                          })[p],
                      )
                      .join(" · ")}
                  </small>
                  {!own(selected.id) &&
                    (selected.acquisitionType === "free" ? (
                      <button
                        className="btn btn-primary"
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            setInventory((await claimCollectible(engine, selected.id)).inventory);
                            setNotice(uiText("settings.interface.added_to_your_inventory_apply_your_look_when_ready_b492207"));
                          })
                        }
                      >
                        <Localized k="settings.interface.collect_for_free_26be29e" />
                      </button>
                    ) : selected.acquisitionType === "purchase" && selected.currency === "USD" && selected.price > 0 ? (
                      <PurchaseCollectible
                        key={selected.id}
                        itemId={selected.id}
                        price={selected.price}
                        onOwned={() =>
                          void run(async () => {
                            setInventory((await collectionInventory(engine)).inventory);
                            setNotice(uiText("settings.interface.purchase_verified_apply_your_look_when_ready_dbdfa0e"));
                          })
                        }
                      />
                    ) : (
                      <p className="faint">
                        <Lock size={13} />{" "}
                        {selected.acquisitionType === "premium"
                          ? uiText("settings.interface.requires_an_authorized_premium_grant_297200e")
                          : selected.acquisitionType === "event"
                            ? uiText("settings.interface.awarded_through_a_meldiq_event_b7fef92")
                            : uiText("settings.interface.purchases_are_not_available_for_this_item_yet_ceef159")}
                      </p>
                    ))}
                </>
              ) : (
                <p>
                  <Localized k="settings.interface.select_a_decoration_to_try_it_on_db63683" />
                </p>
              )}
              {missing && (
                <p className="faint">
                  <Localized k="settings.interface.collect_every_selected_item_before_applying_2878922" />
                </p>
              )}
              {dirty && (
                <small role="status">
                  <Localized k="settings.interface.unsaved_preview_a55446a" />
                </small>
              )}
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
              <Localized k="settings.interface.reset_to_default_bc5b45a" />
            </button>
          </aside>
        </div>
      </div>
    </Dialog>
  );
}
