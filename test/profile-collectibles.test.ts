import { describe, expect, it } from "vitest";
import { zCollectible, zCollectibleLook } from "../src/api/collectibleSchemas";
import { zProfileStyle } from "../src/api/profileSchemas";
import { previewCollectible, previewLegacyStyle } from "../src/sync/collectibles";
import { NO_STYLE } from "../src/ui/settings/noStyle";
import { recipeBackground, collectibleCardVars } from "../src/ui/people/CollectibleLayers";
const item = zCollectible.parse({
  id: "ion-halo",
  name: "Ion Halo",
  category: "avatar-frame",
  version: 1,
  recipe: { colors: ["#22d3ee", "#6366f1"], pattern: "orbit", frame: "aurora" },
  description: "Original Meldiq artwork",
  rarity: "common",
  acquisitionType: "free",
  price: 0,
  currency: "USD",
  isActive: true,
  isFeatured: true,
  availableFrom: null,
  availableUntil: null,
  supportedPlatforms: ["web", "android", "windows", "macos"],
});
describe("profile collectible rendering and draft safety", () => {
  it("previews a slot without changing the saved profile or unrelated styles", () => {
    const saved = { ...NO_STYLE, nameFont: "mono" as const, tagOrgId: "community" };
    const next = previewCollectible(saved, item, "avatar-frame");
    expect(saved.decoration).toBeNull();
    expect(next.decoration).toBe("aurora");
    expect(next.nameFont).toBe("mono");
    expect(next.tagOrgId).toBe("community");
    expect(next.collectibles?.map((x) => x.id)).toEqual(["ion-halo"]);
    expect(previewCollectible(next, null, "avatar-frame").collectibles).toEqual([]);
  });
  it("drops malformed public artwork while preserving older profile fields", () => {
    const style = zProfileStyle.parse({ ...NO_STYLE, collectibles: [{ ...item, recipe: { ...item.recipe, colors: ["url(javascript:alert(1))", "#000000"] } }] });
    expect(style?.collectibles).toBeUndefined();
    expect(zCollectibleLook.safeParse({ ...item, recipe: { ...item.recipe, assetId: "https://evil.example/x.svg" } }).success).toBe(false);
    expect(zCollectibleLook.safeParse({ ...item, recipe: { ...item.recipe, pattern: "<script>" } }).success).toBe(false);
  });
  it("uses a static, bounded recipe and asset references supplied by the API", () => {
    expect(recipeBackground(item).background).toContain("radial-gradient");
    const grid = { ...item, category: "background" as const, recipe: { ...item.recipe, pattern: "grid" as const } };
    expect(collectibleCardVars({ ...NO_STYLE, collectibles: [grid] }).backgroundImage).toContain("repeating-linear-gradient");
    const background = { ...item, category: "background" as const, recipe: { ...item.recipe, assetId: "a".repeat(64) } };
    expect(collectibleCardVars({ ...NO_STYLE, collectibles: [background] }).backgroundImage).toContain(`/v2/profile-collectibles/assets/${"a".repeat(64)}/poster`);
  });
});

it("clears overlapping collection layers in the existing style preview without dropping unrelated slots", () => {
  const theme = { ...item, id: "nightwave", category: "profile-theme" as const };
  const background = { ...item, id: "midnight-mesh", category: "background" as const };
  const style = { ...NO_STYLE, collectibles: [theme, background] };
  const next = previewLegacyStyle(style, { accent: "#123456" });
  expect(next.collectibles?.map((x) => x.id)).toEqual(["midnight-mesh"]);
  expect(style.collectibles).toHaveLength(2);
});
