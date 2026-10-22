import { ArrowDown, ArrowUp, Eye, EyeOff, RotateCcw } from "lucide-react";
import { useState } from "react";
import { shallowEqual, useEngine, useOrbit } from "../../app/orbit";
import { moved, type PanelChannel } from "../../sync/communityRules";
import { communityLevel, countsEveryone, type NotifyLevel, PERSONAL } from "../../sync/navPrefs";
import { Dialog } from "../components/Overlay";
import { OrgAvatar } from "../components/OrgAvatar";
import { Toggle } from "../components/Toggle";
import { orderedOrgs } from "./panelData";

export const LEVEL_NAME: Record<NotifyLevel, string> = { all: "All messages", mentions: "Only mentions", none: "Nothing" };
const LEVEL_HINT: Record<NotifyLevel, string> = {
  all: "Every new message notifies you",
  mentions: "Only @mentions of you, and @everyone unless you ignore it",
  none: "Nothing notifies you, except a mention of you by name",
};
const LEVELS: NotifyLevel[] = ["all", "mentions", "none"];

/**
 * A community's notification settings (batch B2, android CommunityNotificationsSheet): the level its channels follow,
 * Ignore @everyone, and the channels with a level of their own. Kept in the community's preferences document, so every
 * device of the person agrees; decided on the device (the server never sees the messages).
 */
export function CommunityNotificationsDialog({ orgId, name, onClose }: { orgId: string; name: string; onClose: () => void }) {
  const engine = useEngine();
  const prefs = useOrbit((s) => s.nav[orgId]);
  const overrides = useOrbit(
    (s) =>
      Object.entries(s.nav[orgId]?.notify ?? {})
        .map(([id, level]) => ({ id, level, name: s.conversations[id]?.name ?? null }))
        .filter((o) => o.name !== null),
    (a, b) => JSON.stringify(a) === JSON.stringify(b),
  );
  const level = communityLevel(prefs);
  const change = (op: Parameters<typeof engine.nav.change>[1]) => void engine.nav.change(orgId, op);
  return (
    <Dialog title={`Notifications · ${name}`} onClose={onClose}>
      <div className="dialog-body">
        <div role="radiogroup" aria-label="Community notifications" style={{ display: "grid", gap: 2 }}>
          {LEVELS.map((l) => (
            <button key={l} role="radio" aria-checked={level === l} className="list-row" aria-pressed={level === l} onClick={() => change({ op: "community", level: l })}>
              <span className="lines">
                <span style={{ fontWeight: 600 }}>{LEVEL_NAME[l]}</span>
                <small>{LEVEL_HINT[l]}</small>
              </span>
            </button>
          ))}
        </div>
        <div className="setting">
          <span className="lines">
            <strong>Ignore @everyone</strong>
            <small>@everyone in this community counts as an ordinary message: no mention badge or mention notification.</small>
          </span>
          <Toggle checked={!countsEveryone(prefs)} onChange={(on) => change({ op: "community", suppressEveryone: on })} label="Ignore @everyone" />
        </div>
        <h3 className="ws-subhead">Channels with their own level</h3>
        {overrides.length === 0 ? (
          <p className="faint" style={{ margin: 0 }}>
            None. Set one from a channel's menu.
          </p>
        ) : (
          <ul className="ws-list">
            {overrides.map((o) => (
              <li key={o.id} className="ws-row">
                <span className="grow ellipsis">#{o.name}</span>
                <span className="faint">{LEVEL_NAME[o.level]}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => change({ op: "notifyReset", conversationId: o.id })} aria-label={`#${o.name} follows the community again`}>
                  <RotateCcw size={14} /> Follow community
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  );
}

/** A category's own level (batch B3): its channels follow it unless they have their own. */
export function CategoryLevelDialog({ orgId, categoryId, name, onClose }: { orgId: string; categoryId: string; name: string; onClose: () => void }) {
  const engine = useEngine();
  const prefs = useOrbit((s) => s.nav[orgId]);
  const own = prefs?.categoryNotify?.[categoryId] ?? null;
  const pick = (level: NotifyLevel | null) => {
    void engine.nav.change(orgId, { op: "categoryNotify", categoryId, level });
    onClose();
  };
  return (
    <Dialog title={`Notifications · ${name}`} onClose={onClose}>
      <div className="dialog-body" role="radiogroup" aria-label={`${name} notifications`} style={{ gap: 2 }}>
        <button role="radio" aria-checked={own === null} aria-pressed={own === null} className="list-row" onClick={() => pick(null)}>
          <span className="lines">
            <span style={{ fontWeight: 600 }}>Follow the community ({LEVEL_NAME[communityLevel(prefs)].toLowerCase()})</span>
          </span>
        </button>
        {LEVELS.map((l) => (
          <button key={l} role="radio" aria-checked={own === l} aria-pressed={own === l} className="list-row" onClick={() => pick(l)}>
            <span className="lines">
              <span style={{ fontWeight: 600 }}>{LEVEL_NAME[l]}</span>
              <small>{LEVEL_HINT[l]}</small>
            </span>
          </button>
        ))}
        <p className="faint" style={{ margin: "6px 0 0", fontSize: 12.5 }}>
          Channels in this category follow it, unless you gave a channel a level of its own.
        </p>
      </div>
    </Dialog>
  );
}

/**
 * Browse channels (batch B3): every channel of the community you can see, by section, with a switch that keeps it in
 * your list or hides it. Hidden channels stay joined and come back while they mention you.
 */
export function HiddenChannelsDialog({ orgId, sections, onClose }: { orgId: string; sections: { title: string; channels: PanelChannel[] }[]; onClose: () => void }) {
  const engine = useEngine();
  const hidden = useOrbit((s) => s.nav[orgId]?.hidden ?? [], shallowEqual);
  const set = (id: string, hide: boolean) => void engine.nav.change(orgId, { op: "hide", conversationId: id, hidden: hide });
  return (
    <Dialog title="Browse channels" onClose={onClose} wide>
      <div className="dialog-body">
        <p className="muted" style={{ margin: 0 }}>
          Choose which channels appear in your list. Hidden channels stay joined, and come back while they mention you. Only you see this.
        </p>
        {hidden.length > 0 && (
          <button className="btn btn-secondary btn-sm" style={{ justifySelf: "start" }} onClick={() => hidden.forEach((id) => set(id, false))}>
            <Eye size={14} /> Show all
          </button>
        )}
        {sections.map((s) => (
          <section key={s.title} aria-label={s.title}>
            <h3 className="ws-subhead">{s.title}</h3>
            {s.channels.map((ch) => {
              const shown = !hidden.includes(ch.id);
              return (
                <div key={ch.id} className="setting">
                  <span className="glyph">{shown ? <Eye size={16} /> : <EyeOff size={16} />}</span>
                  <span className="lines">
                    <strong className="ellipsis">
                      {ch.voice ? "" : "#"}
                      {ch.name}
                    </strong>
                  </span>
                  <Toggle checked={shown} onChange={(on) => set(ch.id, !on)} label={`Show ${ch.name}`} />
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </Dialog>
  );
}

/** Arrange communities (batch B2, NAV-11): the rail's order, kept in the personal document for every device. */
export function ArrangeRailDialog({ onClose }: { onClose: () => void }) {
  const engine = useEngine();
  const orgs = useOrbit(
    (s) => orderedOrgs(s).map((o) => ({ id: o.id, name: o.name, photoRev: o.photoRev })),
    (a, b) => JSON.stringify(a) === JSON.stringify(b),
  );
  const [order, setOrder] = useState<string[] | null>(null);
  const ids = order ?? orgs.map((o) => o.id);
  const move = (id: string, delta: number) => {
    const next = moved(ids, id, delta);
    setOrder(next);
    void engine.nav.change(PERSONAL, { op: "railOrder", orgIds: next });
  };
  const byId = new Map(orgs.map((o) => [o.id, o]));
  return (
    <Dialog title="Arrange communities" onClose={onClose}>
      <div className="dialog-body" style={{ gap: 2 }}>
        <p className="muted" style={{ margin: "0 0 6px" }}>
          The order of your communities on the left, on every device.
        </p>
        {ids.map((id, i) => {
          const o = byId.get(id);
          if (!o) return null;
          return (
            <div key={id} className="list-row">
              <OrgAvatar orgId={o.id} name={o.name} photoRev={o.photoRev} size={30} />
              <span className="lines">
                <span className="ellipsis" style={{ fontWeight: 600 }}>
                  {o.name}
                </span>
              </span>
              <button className="icon-btn" aria-label={`Move ${o.name} up`} disabled={i === 0} onClick={() => move(id, -1)}>
                <ArrowUp size={16} />
              </button>
              <button className="icon-btn" aria-label={`Move ${o.name} down`} disabled={i === ids.length - 1} onClick={() => move(id, 1)}>
                <ArrowDown size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </Dialog>
  );
}
