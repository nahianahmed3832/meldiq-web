import { MotionImage } from "../components/MotionImage";
import { useEffect, useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import type { CustomEmojiRef } from "../../protocol/payload";
import { type Expression, expressionImage, type ExpressionList, expressions } from "../../sync/expressions";

/** A community's emoji and stickers for its members, loaded again when the community changes (`org.updated`). */
/** [forNew]: only what may go in a new message (locked ones, Meldiq Plus, still show in sent messages and reactions). */
export function useExpressions(orgId: string | null, forNew = false, revision = 0): ExpressionList | null {
  const engine = useEngine();
  const org = useOrbit((s) => (orgId ? (s.orgs.find((o) => o.id === orgId) ?? null) : null));
  const offered = useOrbit((s) => s.server?.features.includes("community-expressions") ?? false);
  const [result, setResult] = useState<{ orgId: string; list: ExpressionList } | null>(null);
  useEffect(() => {
    if (!orgId || !org || !offered) return setResult(null);
    let alive = true;
    expressions(engine, orgId, true)
      // Locked ones (over a Spark level or a plan, Meldiq Plus) aren't offered for new messages.
      .then((l) => alive && setResult({ orgId, list: forNew ? { ...l, expressions: l.expressions.filter((e) => !e.locked) } : l }))
      .catch(() => alive && setResult(null));
    return () => {
      alive = false;
    };
  }, [engine, orgId, org, offered, forNew, revision]);
  return org && offered && result?.orgId === orgId ? result.list : null;
}

/**
 * A community emoji or sticker drawn from its image, shown only when the downloaded image has the hash the message
 * names ([sha256]; null for a reaction, which shows the community's current emoji of that name). Until then, or for
 * people outside the community, its `:name:` text.
 */
export function CustomEmojiImage({ id, name, sha256, size = 22, sticker }: { id: string; name: string; sha256: string | null; size?: number; sticker?: boolean }) {
  const engine = useEngine();
  const memberships = useOrbit((s) => s.orgs);
  const [image, setImage] = useState<{ id: string; sha256: string | null; url: string | null } | null>(null);
  useEffect(() => {
    let alive = true;
    void expressionImage(engine, id, sha256).then((url) => alive && setImage({ id, sha256, url }));
    return () => {
      alive = false;
    };
  }, [engine, id, sha256, memberships]);
  const url = image?.id === id && image.sha256 === sha256 ? image.url : null;
  if (!url) return <span className="custom-emoji-text">:{name}:</span>;
  return <MotionImage src={url} alt={`:${name}:`} title={`:${name}:`} className={sticker ? "custom-sticker" : "custom-emoji"} style={sticker ? undefined : { width: size, height: size }} />;
}

/** A message's community emoji, by reference. */
export const InlineEmoji = ({ r, size }: { r: CustomEmojiRef; size?: number }) => <CustomEmojiImage id={r.id} name={r.name} sha256={r.sha256} size={size} />;

/** A reaction's `:name:` drawn as the community's current emoji of that name (its name if it was removed). */
export function ReactionEmoji({ name, list }: { name: string; list: ExpressionList | null }) {
  const e: Expression | undefined = list?.expressions.find((x) => x.kind === "emoji" && x.name === name);
  return e ? <CustomEmojiImage id={e.id} name={name} sha256={null} size={20} /> : <span className="custom-emoji-text">:{name}:</span>;
}
