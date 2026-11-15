import type { ReactNode } from "react";
import type { ProfileStyle } from "../../api/profileSchemas";
import { CATEGORY_LABELS } from "../../api/collectibleSchemas";
import { useT } from "../../i18n";
import { useEngine } from "../../application/orbit";
import { collectionAsset } from "../../sync/collectibles";
import { decorationCatalog } from "../../sync/decorations";
import { useLoad } from "../workspace/useLoad";
import { recipeBackground } from "./CollectibleLayers";
import { DECORATION_LABEL, DecorationImage, EFFECT_LABEL, ProfileEffect } from "./ProfileStyle";
import { isClassicDecoration } from "../../api/schemas";
import { AvatarFrame } from "./AvatarFrame";

export function ProfileShowcase({ style, banner }: { style: ProfileStyle | null | undefined; banner?: string | null }) {
  const t = useT();
  const engine = useEngine();
  const custom = style?.decoration && !isClassicDecoration(style.decoration) ? style.decoration : null;
  const known = useLoad(() => (custom ? decorationCatalog(engine) : Promise.resolve(null)), [engine, custom]);
  const items: { id: string; name: string; type?: string; thumbnail: ReactNode }[] = (style?.collectibles ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    type: CATEGORY_LABELS[item.category],
    thumbnail: (
      <span className="profile-showcase-art" style={recipeBackground(item)}>
        {item.recipe.assetId && <img src={collectionAsset(item.recipe.assetId, "poster")} loading="lazy" decoding="async" alt="" />}
      </span>
    ),
  }));

  if (style?.decoration) {
    const id = style.decoration;
    const label = t("settings.interface.avatar_decoration_76ce679");
    const name = DECORATION_LABEL[id] ?? known.data?.decorations.find((item) => item.id === id)?.name ?? label;
    items.unshift({
      id: "decoration",
      name,
      type: name !== label ? label : undefined,
      thumbnail: isClassicDecoration(id) ? (
        <span className={`deco deco-art deco-${id}`}>
          <AvatarFrame kind={id} />
        </span>
      ) : (
        <DecorationImage id={id} size={37} />
      ),
    });
  }
  if (style?.effect) {
    items.push({
      id: "effect",
      name: EFFECT_LABEL[style.effect],
      type: t("files.profileShowcase.effect"),
      thumbnail: <ProfileEffect effect={style.effect} />,
    });
  }
  if (banner && !items.some((item) => item.type === CATEGORY_LABELS.banner)) {
    items.push({
      id: "profile-banner",
      name: t("settings.interface.banner_b7f4d98"),
      thumbnail: <img src={banner} alt="" loading="lazy" />,
    });
  }
  if (!items.length) return null;
  const heading = t("workspace.interface.wearing_5ccbf93");

  return (
    <section className="profile-box profile-showcase" aria-label={heading}>
      <h3>{heading}</h3>
      <ul>
        {items.map(({ id, name, type, thumbnail }) => (
          <li key={id}>
            <span className="profile-showcase-thumb" aria-hidden="true">
              {thumbnail}
            </span>
            <span className="lines">
              <strong dir="auto">{name}</strong>
              {type && <small>{type}</small>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
