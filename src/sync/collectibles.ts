import { z } from "zod";
import { apiBase } from "../application/config";
import { zProfileStyle, type ProfileStyle } from "../api/profileSchemas";
import { zCollectionPage, zCollectionInventory, type Collectible, type CollectionCategory } from "../api/collectibleSchemas";
import type { Engine } from "./engine";
import type { ProfileStyleChange } from "./account";
export const zCustomization = z.object({ profileStyle: zProfileStyle, styleRevision: z.string() });
export type Customization = z.infer<typeof zCustomization>;
export const collectionAsset = (id: string, variant: "full" | "poster" | "thumbnail" = "poster") => `${apiBase()}/v2/profile-collectibles/assets/${encodeURIComponent(id)}/${variant}.webp`;
export const collectionPage = (engine: Engine, category: CollectionCategory, q: string, after: string | null, filter = "all") =>
  engine.api.json("GET", `/v2/profile-collectibles?${new URLSearchParams({ category, q, filter, limit: "24", ...(after ? { after } : {}) })}`, zCollectionPage);
export const collectionInventory = (engine: Engine) => engine.api.json("GET", "/v2/users/me/profile-collectibles", zCollectionInventory);
export const customization = (engine: Engine) => engine.api.json("GET", "/v2/users/me/profile-customization", zCustomization);
export const claimCollectible = (engine: Engine, id: string) => engine.api.json("POST", `/v2/users/me/profile-collectibles/${encodeURIComponent(id)}/claim`, zCollectionInventory);
export const favoriteCollectible = (engine: Engine, id: string, on: boolean) => engine.api.call(on ? "PUT" : "DELETE", `/v2/users/me/profile-collectibles/${encodeURIComponent(id)}/favorite`);
export async function equipCollection(engine: Engine, revision: string, slots: Partial<Record<CollectionCategory, string | null>>) {
  const result = await engine.api.json("PATCH", "/v2/users/me/profile-customization", zCustomization, { body: { baseStyleRevision: revision, slots } });
  await engine.refreshAll();
  return result;
}
/** Local preview only. The server repeats selection and ownership checks on apply. */
export function previewCollectible(style: ProfileStyle, item: Collectible | null, category: CollectionCategory): ProfileStyle {
  const next = { ...style };
  const r = item?.recipe;
  if (category === "avatar-frame") next.decoration = r?.frame ?? null;
  if (category === "profile-theme") {
    next.themeColors = r?.colors ?? null;
    next.accent = r?.colors[0] ?? null;
  }
  if (category === "name-effect") {
    next.nameColors = r?.colors ?? null;
    next.nameEffect = r?.nameEffect ?? null;
  }
  if (category === "particles") next.effect = r?.effect ?? null;
  next.collectibles = [...(style.collectibles ?? []).filter((x) => x.category !== category), ...(item ? [item] : [])];
  return next;
}

/** Match the server's overlap rules while previewing edits in the existing style controls. */
export function previewLegacyStyle(style: ProfileStyle, change: ProfileStyleChange): ProfileStyle {
  const clear = new Set<CollectionCategory>();
  if (change.decoration !== undefined) clear.add("avatar-frame");
  if (change.effect !== undefined) clear.add("particles");
  if (change.accent !== undefined || change.themeColors !== undefined) clear.add("profile-theme");
  if (change.nameColors !== undefined || change.nameEffect !== undefined) clear.add("name-effect");
  return zProfileStyle.parse({ ...style, ...change, ...(style.collectibles ? { collectibles: style.collectibles.filter((x) => !clear.has(x.category)) } : {}) }) ?? style;
}
