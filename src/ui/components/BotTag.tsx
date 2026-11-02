import { IdentityGlyph } from "./IdentityGlyph";

/** A persistent account-type label, independent of optional profile badges. */
export function BotTag({ title = "Automated community account" }: { title?: string }) {
  return (
    <span className="bot-tag" title={title}>
      <IdentityGlyph kind="bot" size={11} />
      BOT
    </span>
  );
}
