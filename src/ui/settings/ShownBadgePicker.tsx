import type { MojoMark, ProfileStyle } from "../../api/profileSchemas";
import type { ProfileStyleChange } from "../../sync/account";
import { MojoBadgeMark } from "../mojo/MojoBadge";
import { BADGE_LABEL, type NameBadgeKind, NameBadgeMark, nameBadge } from "../people/NameBadge";

interface ShownBadgePickerProps {
  style: ProfileStyle;
  /** The badges you hold now (the server refuses any other). */
  held: NameBadgeKind[];
  /** Your Meldiq Plus badge, drawn on its tile. */
  mojo: MojoMark | null;
  onSave: (change: ProfileStyleChange) => void;
}

/**
 * Settings › My Profile › Look › Badge (API 0.65.0): None, or one badge you hold, shown next to your name in messages
 * and member lists. Without a choice the Meldiq Plus badge shows, as before, so that tile reads as picked.
 */
export function ShownBadgePicker({ style, held, mojo, onSave }: ShownBadgePickerProps) {
  const showing = nameBadge(style.shownBadge, mojo);
  return (
    <section className="setting-group" aria-labelledby="ps-badge">
      <h3 id="ps-badge" className="invite-or-title">
        Badge
      </h3>
      {held.length === 0 ? (
        <small className="faint">You don't have a badge yet. Meldiq Plus, Bug Hunter and Artist badges show up here once you earn them.</small>
      ) : (
        <>
          <div className="tag-tiles" role="group" aria-labelledby="ps-badge">
            <button type="button" className="tag-tile" aria-pressed={style.shownBadge === "none"} onClick={() => onSave({ shownBadge: "none" })}>
              None
            </button>
            {held.map((b) => (
              <button key={b} type="button" className="tag-tile" aria-pressed={style.shownBadge !== "none" && showing === b} onClick={() => onSave({ shownBadge: b })}>
                {b === "mojo" ? mojo && <MojoBadgeMark badge={mojo.badge} check={mojo.check} /> : <NameBadgeMark badge={b} />}
                <span className="ellipsis">{BADGE_LABEL[b]}</span>
              </button>
            ))}
          </div>
          <small className="faint">This one shows next to your name in chat and the member list. Your profile card shows all of them.</small>
        </>
      )}
    </section>
  );
}
