import type { CSSProperties } from "react";
import type { MojoMark } from "../../api/profileSchemas";
import { MojoBadgeMark } from "../mojo/MojoBadge";
import { NameBadgeMark, nameBadge } from "./NameBadge";
import type { NameEffect, NameFont, ProfileStyle, WornTag } from "../../api/schemas";
import { useOrbit } from "../../application/orbit";
import type { UserLite } from "../../state/store";
import { StyledAvatar } from "./ProfileStyle";
import { IdentityGlyph } from "../components/IdentityGlyph";
import { BotTag } from "../components/BotTag";
export { BotTag } from "../components/BotTag";

/**
 * Name styles (API 0.46.0): a display name in one of Meldiq's fonts, in a colour or a gradient of two or three, with an
 * optional glow or shimmer, and the community tag the person wears beside it. Fonts ship with the web app
 * (public/fonts/names, OFL); colours come from the person's choice, else a role's colour, else the name tone.
 */

export const NAME_FONT_LABEL: Record<NameFont, string> = { pixel: "Pixel", arcade: "Arcade", script: "Script", block: "Block", tech: "Tech", mono: "Code" };
export const NAME_EFFECT_LABEL: Record<NameEffect, string> = { glow: "Glow", shimmer: "Shimmer" };

/** Meldiq's colour presets for names, profiles and the app's tint: our own names, two or three stops each. */
export const COLOR_PRESETS: { id: string; label: string; colors: string[] }[] = [
  { id: "lagoon", label: "Lagoon", colors: ["#22d3ee", "#3b82f6"] },
  { id: "blaze", label: "Blaze", colors: ["#f97316", "#ef4444"] },
  { id: "orchid", label: "Orchid", colors: ["#c084fc", "#ec4899"] },
  { id: "matcha", label: "Matcha", colors: ["#a3e635", "#22c55e"] },
  { id: "sunrise", label: "Sunrise", colors: ["#fbbf24", "#f472b6"] },
  { id: "glacier", label: "Glacier", colors: ["#a5f3fc", "#818cf8"] },
  { id: "candy", label: "Candy", colors: ["#f9a8d4", "#a78bfa", "#67e8f9"] },
  { id: "toxic", label: "Toxic", colors: ["#bef264", "#10b981", "#0ea5e9"] },
  { id: "royal", label: "Royal", colors: ["#6366f1", "#a855f7"] },
  { id: "ember", label: "Ember", colors: ["#fde047", "#f97316", "#dc2626"] },
  { id: "gold", label: "Gold", colors: ["#fde68a", "#f59e0b"] },
  { id: "arcade", label: "Arcade", colors: ["#f0abfc", "#22d3ee", "#a3e635"] },
];

/** The CSS paint for [colors]: a solid colour, or a gradient across the name. */
export function namePaint(colors: string[] | null | undefined): CSSProperties | undefined {
  if (!colors?.length) return undefined;
  if (colors.length === 1) return { color: colors[0] };
  return { "--name-paint": `linear-gradient(90deg, ${colors.join(", ")})` } as CSSProperties;
}

interface StyledNameProps {
  name: string;
  style: ProfileStyle | null | undefined;
  tag?: WornTag | null;
  /** API 0.54.0: their Meldiq Plus badge (GO / PLUS with Meldiq Check), after the tag. */
  mojo?: MojoMark | null;
  /** The profile card: the Meldiq Plus badge whatever badge they chose to show (the card lists the others itself). */
  everyBadge?: boolean;
  /** A role's colour, used when the person picked no colour of their own. */
  roleColor?: string | null;
  /** Community parity A1: the role colour's second colour, which it fades into. */
  roleColor2?: string | null;
  /** The tone class names fall back to (the avatar colour's). */
  toneClass?: string;
  className?: string;
  /** API 0.65.0 batch B: a bot's account, tagged BOT after the name. */
  bot?: boolean;
}

/** A display name with its style, then the worn tag. Screen readers hear the name, then "tag MC". */
export function StyledName({ name, style, tag, mojo, everyBadge, roleColor, roleColor2, toneClass, className, bot }: StyledNameProps) {
  const own = style?.nameColors?.length ? style.nameColors : null;
  const colors = own ?? (roleColor ? (roleColor2 ? [roleColor, roleColor2] : [roleColor]) : null);
  const paint = namePaint(colors);
  const classes = [
    "sname",
    style?.nameFont ? `nf-${style.nameFont}` : "",
    colors && colors.length > 1 ? "grad" : "",
    style?.nameEffect ? `ne-${style.nameEffect}` : "",
    !paint && toneClass ? toneClass : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  const badge = everyBadge ? (mojo ? "mojo" : null) : nameBadge(style?.shownBadge, mojo);
  return (
    <span className="identity-name">
      <span className={classes} style={paint}>
        {name}
      </span>
      {bot && <BotTag />}
      {tag && <WornTagChip tag={tag} />}
      {badge === "mojo" && mojo && <MojoBadgeMark badge={mojo.badge} check={mojo.check} />}
      {(badge === "bug-hunter" || badge === "artist") && <NameBadgeMark badge={badge} />}
    </span>
  );
}

export function WornTagChip({ tag }: { tag: WornTag }) {
  return (
    <span className="wtag" style={tag.color ? ({ "--tag": tag.color } as CSSProperties) : undefined} title={`Community tag ${tag.text}`}>
      <span className="sr-only">tag </span>
      <IdentityGlyph kind="community" size={11} />
      {tag.text}
    </span>
  );
}

/** What this browser knows of a person's look (from member lists and profiles). */
export function useUserLook(userId: string): Pick<UserLite, "avatarMedia" | "profileStyle" | "tag" | "mojo" | "bot"> {
  return useOrbit(
    (s) => {
      const u = s.users[userId];
      return { avatarMedia: u?.avatarMedia ?? null, profileStyle: u?.profileStyle ?? null, tag: u?.tag ?? null, mojo: u?.mojo ?? null, bot: u?.bot === true };
    },
    (a, b) => a.avatarMedia === b.avatarMedia && a.profileStyle === b.profileStyle && a.tag === b.tag && a.mojo === b.mojo && a.bot === b.bot,
  );
}

interface LookNameProps {
  userId: string;
  name: string;
  /** With their community tag and badge (messages, profiles); without, only the font and colours (lists, headers). */
  withMarks?: boolean;
  /** Compact membership mark in conversation rows and headers. */
  withSubscription?: boolean;
  toneClass?: string;
  className?: string;
}

/** A name as its owner styled it (API 0.46.0), wherever this browser shows it: messages, lists, headers and panels. */
export function LookName({ userId, name, withMarks = false, withSubscription = false, toneClass, className = "ellipsis" }: LookNameProps) {
  const look = useUserLook(userId);
  if (withSubscription) return <StyledName name={name} style={look.profileStyle} mojo={look.mojo} bot={look.bot} everyBadge toneClass={toneClass} className={className} />;
  if (!withMarks) return <StyledName name={name} style={look.profileStyle} bot={look.bot} toneClass={toneClass} className={className} />;
  return <StyledName name={name} style={look.profileStyle} tag={look.tag} mojo={look.mojo} bot={look.bot} toneClass={toneClass} className={className} />;
}

interface LookAvatarProps {
  userId: string;
  name: string;
  colorIndex: number;
  photoRev: number | null | undefined;
  size: number;
  online?: boolean | null;
  presence?: "online" | "idle" | "dnd" | "offline" | null;
}

/** An avatar as everywhere in lists and messages (API 0.46.0): animated and framed when the person chose that. */
export function LookAvatar(p: LookAvatarProps) {
  const look = useUserLook(p.userId);
  return (
    <StyledAvatar
      userId={p.userId}
      name={p.name}
      colorIndex={p.colorIndex}
      photoRev={p.photoRev ?? null}
      media={look.avatarMedia ?? null}
      decoration={look.profileStyle?.decoration ?? null}
      collectibles={look.profileStyle?.collectibles}
      size={p.size}
      online={p.online}
      presence={p.presence}
    />
  );
}
