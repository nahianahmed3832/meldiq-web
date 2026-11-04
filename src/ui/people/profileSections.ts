import { PROFILE_SECTIONS, type ProfileLayout, type ProfileSection, type ProfileStyle } from "../../api/profileSchemas";

export function profileLayoutOf(style?: ProfileStyle | null): ProfileLayout {
  return style?.layout ?? { order: [...PROFILE_SECTIONS], hidden: [] };
}
export function visibleProfileSections(style?: ProfileStyle | null): ProfileSection[] {
  const layout = profileLayoutOf(style);
  return layout.order.filter((section) => !layout.hidden.includes(section));
}
export function moveProfileSection(layout: ProfileLayout, section: ProfileSection, direction: -1 | 1): ProfileLayout {
  const order = [...layout.order];
  const before = order.indexOf(section);
  const after = before + direction;
  if (before < 0 || after < 0 || after >= order.length) return layout;
  [order[before], order[after]] = [order[after], order[before]];
  return { ...layout, order };
}
