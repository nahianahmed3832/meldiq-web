import { Bell, BellOff, BellRing, Check, Timer } from "lucide-react";
import type { Conversation } from "../../api/schemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { MUTE_CHOICES } from "../../sync/communityRules";
import { mutedUntil, type NotifyLevel, parentLevel, workspaceOf } from "../../sync/navPrefs";
import { clock, dayLabel, sameDay } from "../format";
import { type MenuEntry, Menu, useMenu } from "../components/Overlay";
import { useT } from "../../i18n";

/** The chosen level's tick, or the same space without one, so the labels line up. */
const tick = (on: boolean) => (on ? <Check size={16} /> : <span style={{ width: 16, flexShrink: 0 }} aria-hidden="true" />);

const LEVEL_KEY = { all: "bell_all", mentions: "bell_mentions", none: "bell_nothing" } as const satisfies Record<NotifyLevel, string>;
const MUTE_KEY: Record<string, "bell_15m" | "bell_1h" | "bell_3h" | "bell_8h" | "bell_24h" | "bell_until_on"> = {
  [15 * 60_000]: "bell_15m",
  [3_600_000]: "bell_1h",
  [3 * 3_600_000]: "bell_3h",
  [8 * 3_600_000]: "bell_8h",
  [24 * 3_600_000]: "bell_24h",
  null: "bell_until_on",
};

/** "3:40 PM", or "Tomorrow 9:00 AM" / a date when it isn't today. */
function untilText(t: number, now = Date.now()): string {
  return sameDay(t, now) ? clock(t) : `${dayLabel(t, now)} ${clock(t)}`;
}

/**
 * A text channel's bell in its header (android A7, 2026-10-23): mute for 15 minutes to 24 hours or until turned back
 * on, unmute ("Muted until …"), and the channel's level, where "Default" says what it follows now (its category's or the
 * community's). Synced to every device of the person (their notification settings document).
 */
export function ChannelBell({ c }: { c: Conversation }) {
  const engine = useEngine();
  const t = useT();
  const menu = useMenu();
  const nav = useOrbit((s) => s.nav[workspaceOf(c.orgId)]);
  const timed = useOrbit((s) => s.server?.features.includes("channel-preferences") ?? false);
  const until = mutedUntil(nav, c.id);
  const own = nav?.notify[c.id] ?? null;
  const parent = parentLevel(nav, c.categoryId);
  const muted = until !== null || own === "none";
  const arrange = (op: Parameters<typeof engine.arrange>[1]) => void engine.arrange(c.id, op).catch((e: unknown) => engine.notice("error", e instanceof Error ? e.message : t("bell_failed")));

  const entries: MenuEntry[] = [
    ...(muted
      ? [
          { heading: until !== null ? t("bell_muted_until", { when: untilText(until) }) : t("bell_muted_on") },
          {
            label: t("bell_unmute"),
            icon: <BellRing size={16} />,
            onSelect: () => (until !== null ? arrange({ op: "muteUntil", conversationId: c.id, until: null }) : arrange({ op: "notifyReset", conversationId: c.id })),
          },
        ]
      : [
          { heading: t("bell_mute") },
          ...MUTE_CHOICES.filter((m) => timed || m.ms === null).map((m) => ({
            label: t(MUTE_KEY[String(m.ms)] ?? "bell_until_on"),
            icon: m.ms === null ? <BellOff size={16} /> : <Timer size={16} />,
            onSelect: () =>
              m.ms === null
                ? arrange({ op: "notify", conversationId: c.id, level: "none", categoryId: c.categoryId ?? null })
                : arrange({ op: "muteUntil", conversationId: c.id, until: Date.now() + m.ms }),
          })),
        ]),
    "separator",
    { heading: t("bell_notifications") },
    { label: t("bell_default", { level: t(LEVEL_KEY[parent]) }), checked: own === null, icon: tick(own === null), onSelect: () => arrange({ op: "notifyReset", conversationId: c.id }) },
    ...(["all", "mentions", "none"] as const).map((level) => ({
      label: t(LEVEL_KEY[level]),
      checked: own === level,
      icon: tick(own === level),
      onSelect: () => arrange({ op: "notify", conversationId: c.id, level, categoryId: c.categoryId ?? null }),
    })),
  ];

  const label = muted ? (until !== null ? t("bell_label_muted_until", { when: untilText(until) }) : t("bell_label_muted")) : t("bell_label");
  return (
    <>
      <button className="icon-btn" aria-haspopup="menu" aria-expanded={!!menu.anchor} aria-label={label} title={label} onClick={(e) => menu.open(e.currentTarget)}>
        {muted ? <BellOff size={18} /> : <Bell size={18} />}
      </button>
      {menu.anchor && <Menu anchor={menu.anchor} align="end" label={t("bell_menu")} entries={entries} onClose={menu.close} />}
    </>
  );
}
