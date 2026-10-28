import { BadgeCheck, Check, FileUp, MessageSquareText, MonitorUp, Smile, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import type { MojoCatalog, MojoMe, PlanKey, PlanPerks } from "../../api/mojoSchemas";
import { MojoBadgeMark } from "./MojoBadge";
import { planPrice, screenLabel, size } from "./mojoFormat";

/** Comparison rows: the table is the full overview; cards only pick out what matters most (no bots: Meldiq has none yet). */
const ROWS: { label: string; value: (p: PlanPerks, c: MojoCatalog) => string }[] = [
  { label: "Characters in a message", value: (p) => p.messageChars.toLocaleString() },
  { label: "Largest file you share", value: (p) => size(p.uploadBytes) },
  { label: "Screen sharing", value: (p, c) => screenLabel(c, p.screen) },
  { label: "Meldiq Sparks included", value: (p) => String(p.sparks) },
  { label: "Custom emoji and stickers you add", value: (p) => String(p.customItems) },
  { label: "Name badge", value: (p) => (p.badge === "plus" ? "Plus, with Meldiq Check" : p.badge === "go" ? "Go" : "None") },
];

/** One line under each plan's price: who it's for, in the plan's own numbers. */
const PITCH: Record<PlanKey, string> = {
  free: "Everything you need to talk, call and run a community.",
  go: "A little more room, a Spark to give and a Go badge.",
  plus: "The biggest files, the sharpest streams and two Sparks.",
};

export interface PlanAction {
  label: string;
  kind: "primary" | "mojo" | "secondary";
  disabled: boolean;
  onClick?: () => void;
}

interface PlanCardsProps {
  catalog: MojoCatalog;
  me: MojoMe;
  /** The button under each plan, decided by the page (what's on sale, what the person has, what's in flight). */
  actionFor: (plan: PlanPerks) => PlanAction;
}

/** Free, Mojo Go and Mojo Plus side by side: price, what it gives, and its one button. */
export function PlanCards({ catalog, me, actionFor }: PlanCardsProps) {
  return (
    <div className="mojo-plans">
      {catalog.plans.map((p) => {
        const price = planPrice(catalog, p.key);
        const current = me.plan === p.key;
        const action = actionFor(p);
        return (
          <section key={p.key} className={`mojo-plan plan-${p.key}${current ? " current" : ""}`} aria-label={p.name}>
            {(current || p.key === "plus") && <span className="mojo-plan-flag">{current ? "Your plan" : "All the perks"}</span>}
            <header>
              <h3>
                {p.name} {p.badge && <MojoBadgeMark badge={p.badge} check={false} />}
              </h3>
              <div className="mojo-price">
                <strong>{price.label}</strong>
                {p.key !== "free" && <span>/month</span>}
              </div>
              <p>{PITCH[p.key]}</p>
            </header>
            <ul>
              <PlanLine>{p.messageChars.toLocaleString()} characters a message</PlanLine>
              <PlanLine>Files up to {size(p.uploadBytes)}</PlanLine>
              <PlanLine>Screen sharing at {screenLabel(catalog, p.screen)}</PlanLine>
              <PlanLine>{p.sparks === 0 ? "Sparks: buy them separately" : `${p.sparks} Meldiq Spark${p.sparks === 1 ? "" : "s"} included`}</PlanLine>
              <PlanLine>{p.customItems} custom emoji and stickers</PlanLine>
            </ul>
            <button className={`btn btn-lg btn-${action.kind}`} disabled={action.disabled} onClick={action.onClick}>
              {action.label}
            </button>
          </section>
        );
      })}
    </div>
  );
}

function PlanLine({ children }: { children: ReactNode }) {
  return (
    <li>
      <Check size={15} aria-hidden="true" /> {children}
    </li>
  );
}

/** What Mojo Plus adds, as benefit cards with the catalog's numbers. */
export function PlusPerks({ catalog }: { catalog: MojoCatalog }) {
  const plus = catalog.plans.find((p) => p.key === "plus");
  const free = catalog.plans.find((p) => p.key === "free");
  if (!plus || !free) return null;
  const perks: { icon: ReactNode; title: string; body: string }[] = [
    {
      icon: <MessageSquareText size={20} />,
      title: `${plus.messageChars.toLocaleString()} character messages`,
      body: `${Math.round(plus.messageChars / free.messageChars)}× the room of Free. Long stories, patch notes, a whole recipe in one message. Edits get the same room.`,
    },
    { icon: <FileUp size={20} />, title: `${size(plus.uploadBytes)} uploads`, body: "Full clips, big GIFs and whole albums in one go." },
    { icon: <MonitorUp size={20} />, title: `${screenLabel(catalog, plus.screen)} screen sharing`, body: "Crisp and smooth for everyone watching." },
    {
      icon: <Sparkles size={20} />,
      title: `${plus.sparks} Meldiq Sparks`,
      body: "Give a Spark to a server you love. Every Spark helps unlock more emoji slots, bigger uploads, and better voice and screen sharing for everyone there.",
    },
    {
      icon: <BadgeCheck size={20} />,
      title: "Plus badge and Meldiq Check",
      body: "A small Plus next to your name so people know you keep the lights on. Hide it any time. Meldiq Check is a Plus perk, not identity verification.",
    },
    {
      icon: <Smile size={20} />,
      title: `${plus.customItems} custom emoji and stickers`,
      body: "Add more across your communities. If a plan ends, the oldest stay usable and the rest are kept, locked until you upgrade again: nothing is deleted.",
    },
  ];
  return (
    <div className="mojo-perks">
      {perks.map((p) => (
        <article key={p.title}>
          <span className="mojo-perk-icon" aria-hidden="true">
            {p.icon}
          </span>
          <div className="lines">
            <h3>{p.title}</h3>
            <p>{p.body}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

/** Every plan side by side, the person's own column marked. */
export function CompareTable({ catalog, me }: { catalog: MojoCatalog; me: MojoMe }) {
  const cls = (k: PlanKey) => [me.plan === k ? "current" : "", k === "plus" ? "plus" : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className="mojo-table-wrap">
      <table className="mojo-table">
        <thead>
          <tr>
            <th scope="col">What you get</th>
            {catalog.plans.map((p) => (
              <th key={p.key} scope="col" className={cls(p.key)}>
                {p.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              {catalog.plans.map((p) => (
                <td key={p.key} className={cls(p.key)}>
                  {r.value(p, catalog)}
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <th scope="row">Price</th>
            {catalog.plans.map((p) => (
              <td key={p.key} className={cls(p.key)}>
                {p.key === "free" ? "Free" : `${planPrice(catalog, p.key).label} a month`}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
