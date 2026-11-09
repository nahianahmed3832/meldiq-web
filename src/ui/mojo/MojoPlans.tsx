import { countLabel } from "../../i18n/counts";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { interfaceLocale } from "../../i18n/format";
import { BadgeCheck, Check, FileUp, MessageSquareText, MonitorUp, Smile, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import type { MojoCatalog, MojoMe, PlanKey, PlanPerks } from "../../api/mojoSchemas";
import { MojoBadgeMark } from "./MojoBadge";
import { planPrice, screenLabel, size } from "./mojoFormat";
/** Comparison rows: the table is the full overview; cards only pick out what matters most. */
const ROWS: {
  label: string;
  value: (p: PlanPerks, c: MojoCatalog) => string;
}[] = [
  {
    get label() {
      return uiText("billing.interface.characters_in_a_message_18ee793");
    },
    value: (p) => p.messageChars.toLocaleString(interfaceLocale()),
  },
  {
    get label() {
      return uiText("billing.interface.largest_file_you_share_296200c");
    },
    value: (p) => size(p.uploadBytes),
  },
  {
    get label() {
      return uiText("billing.interface.screen_sharing_74dc20e");
    },
    value: (p, c) => screenLabel(c, p.screen),
  },
  {
    get label() {
      return uiText("billing.interface.meldiq_sparks_included_cf798e2");
    },
    value: (p) => String(p.sparks),
  },
  {
    get label() {
      return uiText("billing.interface.custom_emoji_and_stickers_you_add_41ae474");
    },
    value: (p) => String(p.customItems),
  },
  {
    get label() {
      return uiText("billing.interface.bots_you_can_make_60a1f27");
    },
    value: (p) => String(p.bots),
  },
  {
    get label() {
      return uiText("billing.interface.profile_customization_0bbce42");
    },
    value: () => uiText("billing.interface.free_avatars_decorations_effects_and_appearance_10e9d1f"),
  },
  {
    get label() {
      return uiText("billing.interface.name_badge_3d33dc0");
    },
    value: (p) => (p.badge === "plus" ? uiText("billing.interface.plus_with_meldiq_check_30badf4") : p.badge === "go" ? "Go" : uiText("settings.ap_none")),
  },
];
/** One line under each plan's price: who it's for, in the plan's own numbers. */
const PITCH: Record<PlanKey, string> = {
  get free() {
    return uiText("billing.interface.everything_you_need_to_talk_call_and_run_a_community_30e1520");
  },
  get go() {
    return uiText("billing.interface.a_little_more_room_a_spark_to_give_and_a_go_badge_dfd7901");
  },
  get plus() {
    return uiText("billing.interface.make_room_for_more_f35caed");
  },
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
/** Free and Meldiq Plus side by side: price, what it gives, and its one button. */
export function PlanCards({ catalog, me, actionFor }: PlanCardsProps) {
  useLocaleRender();
  return (
    <div className="mojo-plans">
      {catalog.plans
        .filter((p) => p.key !== "go")
        .map((p) => {
          const price = planPrice(catalog, p.key);
          const current = me.plan === p.key;
          const action = actionFor(p);
          return (
            <section key={p.key} className={`mojo-plan plan-${p.key}${current ? " current" : ""}`} aria-label={p.name}>
              {(current || p.key === "plus") && <span className="mojo-plan-flag">{current ? uiText("billing.interface.your_plan_d9ab76c") : uiText("billing.interface.all_the_perks_46fe596")}</span>}
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
                <PlanLine>
                  <Localized k="billing.interface.characters_a_message_85e26cf" slots={[p.messageChars.toLocaleString(interfaceLocale())]} />
                </PlanLine>
                <PlanLine>
                  <Localized k="billing.interface.files_up_to_8438f86" slots={[size(p.uploadBytes)]} />
                </PlanLine>
                <PlanLine>
                  <Localized k="billing.interface.screen_sharing_eb6e332" slots={[screenLabel(catalog, p.screen)]} />
                </PlanLine>
                <PlanLine>
                  {p.sparks === 0
                    ? uiText("billing.interface.sparks_buy_them_separately_5ad5332")
                    : uiText("billing.interface.native_count_e6e24184f", { value0: countLabel(p.sparks, "meldiqSparks"), value1: "" })}
                </PlanLine>
                <PlanLine>
                  <Localized k="billing.interface.custom_emoji_and_stickers_986ad14" slots={[p.customItems]} />
                </PlanLine>
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
  useLocaleRender();
  return (
    <li>
      <Check size={15} aria-hidden="true" /> {children}
    </li>
  );
}
/** What Meldiq Plus adds, as benefit cards with the catalog's numbers. */
export function PlusPerks({ catalog }: { catalog: MojoCatalog }) {
  useLocaleRender();
  const plus = catalog.plans.find((p) => p.key === "plus");
  const free = catalog.plans.find((p) => p.key === "free");
  if (!plus || !free) return null;
  const perks: {
    icon: ReactNode;
    title: string;
    body: string;
  }[] = [
    {
      icon: <MessageSquareText size={20} />,
      title: uiText("billing.interface.value0_character_messages_fed5b61", { value0: plus.messageChars.toLocaleString(interfaceLocale()) }),
      body: uiText("billing.interface.value0_the_room_of_free_long_stories_patch_notes_a_whole_recipe_i_adfae34", { value0: Math.round(plus.messageChars / free.messageChars) }),
    },
    {
      icon: <FileUp size={20} />,
      title: uiText("billing.interface.value0_uploads_3095593", { value0: size(plus.uploadBytes) }),
      body: uiText("billing.interface.full_clips_big_gifs_and_whole_albums_in_one_go_312d458"),
    },
    {
      icon: <MonitorUp size={20} />,
      title: uiText("billing.interface.value0_screen_sharing_a9988dc", { value0: screenLabel(catalog, plus.screen) }),
      body: uiText("billing.interface.crisp_and_smooth_for_everyone_watching_8a758dc"),
    },
    {
      icon: <Sparkles size={20} />,
      title: countLabel(plus.sparks, "meldiqSparks"),
      body: uiText("billing.interface.give_a_spark_to_a_server_you_love_every_spark_helps_unlock_more_e_2063c49"),
    },
    {
      icon: <BadgeCheck size={20} />,
      get title() {
        return uiText("billing.interface.plus_badge_and_meldiq_check_c0a2d93");
      },
      body: uiText("billing.interface.a_small_plus_next_to_your_name_so_people_know_you_keep_the_lights_7596ea1"),
    },
    {
      icon: <Smile size={20} />,
      title: uiText("billing.interface.value0_custom_emoji_and_stickers_356a9cc", { value0: plus.customItems }),
      body: uiText("billing.interface.add_more_across_your_communities_if_a_plan_ends_the_oldest_stay_u_f4e2906"),
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
  useLocaleRender();
  const cls = (k: PlanKey) => [me.plan === k ? "current" : "", k === "plus" ? "plus" : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className="mojo-table-wrap">
      <table className="mojo-table">
        <thead>
          <tr>
            <th scope="col">
              <Localized k="billing.interface.what_you_get_41a1acb" />
            </th>
            {catalog.plans
              .filter((p) => p.key !== "go")
              .map((p) => (
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
              {catalog.plans
                .filter((p) => p.key !== "go")
                .map((p) => (
                  <td key={p.key} className={cls(p.key)}>
                    {r.value(p, catalog)}
                  </td>
                ))}
            </tr>
          ))}
          <tr>
            <th scope="row">
              <Localized k="billing.interface.price_93c91c8" />
            </th>
            {catalog.plans
              .filter((p) => p.key !== "go")
              .map((p) => (
                <td key={p.key} className={cls(p.key)}>
                  {p.key === "free" ? uiText("billing.interface.free_f411a1f") : uiText("billing.interface.value0_a_month_1cac72e", { value0: planPrice(catalog, p.key).label })}
                </td>
              ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
