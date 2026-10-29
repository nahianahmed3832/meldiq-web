import { Bot, Hash, Headphones, MonitorUp, Smile, Users } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { apiBase } from "../../application/config";
import { ApiClient } from "../../api/client";
import { type MojoCatalog, type PlanPerks, zMojoCatalog } from "../../api/mojoSchemas";
import { type StringKey, useT } from "../../i18n";
import { planPrice, size } from "../mojo/mojoFormat";

/** What Meldiq has today (each one is built and in the app: docs/MELDIQ_WEB_FEATURE_PARITY.md). */
const FEATURES: { icon: ReactNode; title: StringKey; line: StringKey }[] = [
  { icon: <Hash size={22} />, title: "feature_chat", line: "feature_chat_line" },
  { icon: <Headphones size={22} />, title: "feature_voice", line: "feature_voice_line" },
  { icon: <MonitorUp size={22} />, title: "feature_screen", line: "feature_screen_line" },
  { icon: <Users size={22} />, title: "feature_communities", line: "feature_communities_line" },
  { icon: <Smile size={22} />, title: "feature_emoji", line: "feature_emoji_line" },
  { icon: <Bot size={22} />, title: "feature_bots", line: "feature_bots_line" },
];

/**
 * Below the hero: what Meldiq has, and Free, Mojo Go and Mojo Plus from the server's public catalog (GET
 * /v2/mojo/catalog needs no account), so the numbers and prices are always the ones the server enforces and charges.
 * Without the catalog (offline, an older server) the plans are left out rather than guessed.
 */
export function LandingExplore({ id }: { id: string }) {
  const t = useT();
  const catalog = usePublicCatalog();
  return (
    <section className="landing-explore" id={id} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{t("landing_inside")}</h2>
      <ul className="landing-features">
        {FEATURES.map((f) => (
          <li key={f.title}>
            <span className="landing-feature-icon" aria-hidden="true">
              {f.icon}
            </span>
            <strong>{t(f.title)}</strong>
            <span>{t(f.line)}</span>
          </li>
        ))}
      </ul>
      {catalog && <LandingPlans catalog={catalog} />}
    </section>
  );
}

function usePublicCatalog(): MojoCatalog | null {
  const [catalog, setCatalog] = useState<MojoCatalog | null>(null);
  useEffect(() => {
    let live = true;
    new ApiClient(apiBase())
      .json("GET", "/v2/mojo/catalog", zMojoCatalog, { auth: false })
      .then((c) => live && setCatalog(c))
      // The plans are a bonus on this page: without them it still says what Meldiq is.
      .catch(() => live && setCatalog(null));
    return () => {
      live = false;
    };
  }, []);
  return catalog;
}

function LandingPlans({ catalog }: { catalog: MojoCatalog }) {
  const t = useT();
  return (
    <div className="landing-plans">
      <h2>{t("landing_plans")}</h2>
      <ul>
        {catalog.plans.map((p) => (
          <PlanCard key={p.key} plan={p} catalog={catalog} />
        ))}
      </ul>
      <p className="landing-plans-note">{t("landing_plans_note")}</p>
    </div>
  );
}

function PlanCard({ plan, catalog }: { plan: PlanPerks; catalog: MojoCatalog }) {
  const t = useT();
  const price = planPrice(catalog, plan.key);
  // A plan's ceiling is its highest preset, which covers every smaller share.
  const top = plan.screen.at(-1);
  const screen = catalog.screenPresets.find((p) => p.id === top)?.label ?? top ?? "";
  return (
    <li className={`landing-plan landing-plan-${plan.key}`}>
      <div className="landing-plan-head">
        <strong>{plan.name}</strong>
        {!price.onSale && <span className="landing-plan-soon">{t("landing_plan_soon")}</span>}
      </div>
      <div className="landing-plan-price">
        {plan.key === "free" ? "$0" : price.label}
        <small>{t("landing_per_month")}</small>
      </div>
      <ul className="landing-plan-perks">
        <li>{t("landing_perk_chars", { n: plan.messageChars.toLocaleString() })}</li>
        <li>{t("landing_perk_upload", { size: size(plan.uploadBytes) })}</li>
        <li>{t("landing_perk_screen", { label: screen })}</li>
        <li>{t("landing_perk_emoji", { n: plan.customItems })}</li>
        <li>{t("landing_perk_bots", { n: plan.bots })}</li>
      </ul>
    </li>
  );
}
