import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { ArrowDown, ArrowUp, Eye, EyeOff, RotateCcw } from "lucide-react";
import { useState } from "react";
import { shallowEqual, useEngine, useOrbit } from "../../application/orbit";
import { moved, type PanelChannel } from "../../sync/communityRules";
import { communityLevel, countsEveryone, type NotifyLevel, NOTIFY_LEVELS, PERSONAL } from "../../sync/navPrefs";
import { Dialog } from "../components/Overlay";
import { OrgAvatar } from "../components/OrgAvatar";
import { Toggle } from "../components/Toggle";
import { orderedOrgs } from "./panelData";
export { NOTIFICATION_LEVEL_LABELS as LEVEL_NAME } from "../components/NotificationLevelSelect";
import { NOTIFICATION_LEVEL_LABELS as LEVEL_NAME } from "../components/NotificationLevelSelect";
const LEVEL_HINT: Record<NotifyLevel, string> = {
  get all() {
    return uiText("organization.interface.every_new_message_notifies_you_8c6c019");
  },
  get mentions() {
    return uiText("organization.interface.only_mentions_of_you_and_everyone_unless_you_ignore_it_17c90ac");
  },
  get none() {
    return uiText("organization.interface.nothing_notifies_you_except_a_mention_of_you_by_name_9df0687");
  },
};
const LEVELS = NOTIFY_LEVELS;
/**
 * A community's notification settings (batch B2, android CommunityNotificationsSheet): the level its channels follow,
 * Ignore @everyone, and the channels with a level of their own. Kept in the community's preferences document, so every
 * device of the person agrees; decided on the device (the server never sees the messages).
 */
export function CommunityNotificationSettings({ orgId }: { orgId: string }) {
  useLocaleRender();
  const engine = useEngine();
  const prefs = useOrbit((s) => s.nav[orgId]);
  const overrides = useOrbit(
    (s) =>
      Object.entries(s.nav[orgId]?.notify ?? {})
        .map(([id, level]) => ({ id, level, name: s.conversations[id]?.name ?? null }))
        .filter((o) => o.name !== null),
    (a, b) => JSON.stringify(a) === JSON.stringify(b),
  );
  // The level chosen, not a timed mute's "Nothing" (the menu's Mute community shows that).
  const level = prefs?.community?.level ?? "all";
  const change = (op: Parameters<typeof engine.nav.change>[1]) =>
    void engine.nav.change(orgId, op).catch((e: unknown) => engine.notice("error", e instanceof Error ? e.message : uiText("organization.interface.couldn_t_change_notifications_9c82a42")));
  return (
    <div className="card setting-card">
      <div role="radiogroup" aria-label={uiText("organization.interface.community_notifications_6da776f")} style={{ display: "grid", gap: 2 }}>
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
          <strong>
            <Localized k="organization.interface.ignore_everyone_91a3c1f" />
          </strong>
          <small>
            <Localized k="organization.interface.everyone_in_this_community_counts_as_an_ordinary_message_no_menti_e419d78" />
          </small>
        </span>
        <Toggle checked={!countsEveryone(prefs)} onChange={(on) => change({ op: "community", suppressEveryone: on })} label={uiText("organization.interface.ignore_everyone_91a3c1f")} />
      </div>
      <h3 className="ws-subhead">
        <Localized k="organization.interface.channels_with_their_own_level_a0a5b2f" />
      </h3>
      {overrides.length === 0 ? (
        <p className="faint" style={{ margin: 0 }}>
          <Localized k="organization.interface.none_set_one_from_a_channel_s_menu_b45a359" />
        </p>
      ) : (
        <ul className="ws-list">
          {overrides.map((o) => (
            <li key={o.id} className="ws-row">
              <span className="grow ellipsis">#{o.name}</span>
              <span className="faint">{LEVEL_NAME[o.level]}</span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => change({ op: "notifyReset", conversationId: o.id })}
                aria-label={uiText("organization.interface.value0_follows_the_community_again_96c45ba", { value0: o.name })}
              >
                <Localized k="organization.interface.follow_community_47366e9" slots={[<RotateCcw size={14} />]} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
/** A category's own level (batch B3): its channels follow it unless they have their own. */
export function CategoryLevelDialog({ orgId, categoryId, name, onClose }: { orgId: string; categoryId: string; name: string; onClose: () => void }) {
  useLocaleRender();
  const engine = useEngine();
  const prefs = useOrbit((s) => s.nav[orgId]);
  const own = prefs?.categoryNotify?.[categoryId] ?? null;
  const pick = (level: NotifyLevel | null) => {
    void engine.nav.change(orgId, { op: "categoryNotify", categoryId, level });
    onClose();
  };
  return (
    <Dialog title={uiText("organization.interface.notifications_value0_b8eb80a", { value0: name })} onClose={onClose}>
      <div className="dialog-body" role="radiogroup" aria-label={uiText("organization.interface.value0_notifications_303be67", { value0: name })} style={{ gap: 2 }}>
        <button role="radio" aria-checked={own === null} aria-pressed={own === null} className="list-row" onClick={() => pick(null)}>
          <span className="lines">
            <span style={{ fontWeight: 600 }}>
              <Localized k="organization.interface.follow_the_community_ce01e9b" slots={[LEVEL_NAME[communityLevel(prefs)].toLowerCase()]} />
            </span>
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
          <Localized k="organization.interface.channels_in_this_category_follow_it_unless_you_gave_a_channel_a_l_4012744" />
        </p>
      </div>
    </Dialog>
  );
}
/**
 * Browse channels (batch B3): every channel of the community you can see, by section, with a switch that keeps it in
 * your list or hides it. Hidden channels stay joined and come back while they mention you.
 */
export function HiddenChannelsDialog({
  orgId,
  sections,
  onClose,
}: {
  orgId: string;
  sections: {
    title: string;
    channels: PanelChannel[];
  }[];
  onClose: () => void;
}) {
  useLocaleRender();
  const engine = useEngine();
  const hidden = useOrbit((s) => s.nav[orgId]?.hidden ?? [], shallowEqual);
  const set = (id: string, hide: boolean) => void engine.nav.change(orgId, { op: "hide", conversationId: id, hidden: hide });
  return (
    <Dialog title={uiText("organization.interface.browse_channels_79d490f")} onClose={onClose} wide>
      <div className="dialog-body">
        <p className="muted" style={{ margin: 0 }}>
          <Localized k="organization.interface.choose_which_channels_appear_in_your_list_hidden_channels_stay_jo_fe1bfdc" />
        </p>
        {hidden.length > 0 && (
          <button className="btn btn-secondary btn-sm" style={{ justifySelf: "start" }} onClick={() => hidden.forEach((id) => set(id, false))}>
            <Localized k="organization.interface.show_all_8633589" slots={[<Eye size={14} />]} />
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
                  <Toggle checked={shown} onChange={(on) => set(ch.id, !on)} label={uiText("organization.interface.show_value0_bf682fa", { value0: ch.name })} />
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
  useLocaleRender();
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
    <Dialog title={uiText("organization.interface.arrange_communities_ec9be72")} onClose={onClose}>
      <div className="dialog-body" style={{ gap: 2 }}>
        <p className="muted" style={{ margin: "0 0 6px" }}>
          <Localized k="organization.interface.the_order_of_your_communities_on_the_left_on_every_device_31a3658" />
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
              <button className="icon-btn" aria-label={uiText("organization.interface.move_value0_up_4f93d15", { value0: o.name })} disabled={i === 0} onClick={() => move(id, -1)}>
                <ArrowUp size={16} />
              </button>
              <button className="icon-btn" aria-label={uiText("organization.interface.move_value0_down_7c18b9e", { value0: o.name })} disabled={i === ids.length - 1} onClick={() => move(id, 1)}>
                <ArrowDown size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </Dialog>
  );
}
