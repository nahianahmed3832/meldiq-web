import type { CSSProperties } from "react";
import type { ProfileStyle } from "../../api/profileSchemas";
import type { CollectibleLook } from "../../api/collectibleSchemas";
import { collectionAsset } from "../../sync/collectibles";
import { useReducedMotion } from "./ProfileStyle";
export const collectibleOf = (style: ProfileStyle | null | undefined, category: CollectibleLook["category"]) => style?.collectibles?.find((x) => x.category === category);
export function recipeBackground(item: CollectibleLook): CSSProperties {
  const [a, b] = item.recipe.colors;
  const base = `linear-gradient(135deg, ${a}, ${b})`;
  const patterns = {
    solid: base,
    orbit: `radial-gradient(ellipse at 75% 20%, ${a} 0%, transparent 60%), linear-gradient(150deg, #0b1224, ${b})`,
    grid: `repeating-linear-gradient(0deg, transparent, transparent 19px, ${a}33 20px), repeating-linear-gradient(90deg, transparent, transparent 19px, ${a}33 20px), linear-gradient(135deg, #0b1224, ${b})`,
    prism: `conic-gradient(from 35deg at 70% 20%, #0b1224, ${a}, ${b}, #0b1224)`,
  };
  return { background: patterns[item.recipe.pattern] };
}
export function collectibleCardVars(style: ProfileStyle | null | undefined, animate = false): CSSProperties {
  const background = collectibleOf(style, "background");
  const theme = collectibleOf(style, "profile-theme");
  return {
    ...(background
      ? {
          backgroundImage: `linear-gradient(#0b1224d9, #0b1224e8), ${background.recipe.assetId ? `url("${collectionAsset(background.recipe.assetId, animate ? "full" : "poster")}")` : recipeBackground(background).background}`,
          backgroundSize: "cover",
        }
      : {}),
    ...(theme ? { borderColor: theme.recipe.colors[0], boxShadow: `0 0 28px ${theme.recipe.colors[1]}25` } : {}),
  };
}
export function CollectibleBanner({ style }: { style: ProfileStyle | null | undefined }) {
  const item = collectibleOf(style, "banner");
  const reduced = useReducedMotion();
  if (!item) return null;
  return (
    <span className="collectible-banner" style={recipeBackground(item)} aria-hidden="true">
      {item.recipe.assetId && <img src={collectionAsset(item.recipe.assetId, reduced ? "poster" : "full")} alt="" decoding="async" />}
    </span>
  );
}
export function CollectibleBadge({ style }: { style: ProfileStyle | null | undefined }) {
  const item = collectibleOf(style, "badge");
  if (!item) return null;
  return (
    <span className="collectible-badge" title={`Collectible: ${item.name}`} style={{ color: item.recipe.colors[0] }}>
      <span aria-hidden="true">✦</span> {item.name}
    </span>
  );
}
