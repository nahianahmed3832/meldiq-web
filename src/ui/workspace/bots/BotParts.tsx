import { useLocaleRender } from "../../../i18n/Localized";
import { text as uiText } from "../../../i18n";
import { Localized } from "../../../i18n/Localized";
import { useEngine, useOrbit } from "../../../application/orbit";
import { navigate } from "../../../application/router";
import { selectCheckout } from "../../billing/checkoutDraft";
import { PauseCircle, Sparkles, X } from "lucide-react";
import { type ReactNode } from "react";
import { BOTS_PLUS_PRICE } from "../../../sync/officialBotRules";
import type { CatalogBot, OfficialBot } from "../../../sync/officialBots";
import type { PanelChannel } from "../../../sync/communityRules";
import { usePhoto } from "../../components/photos";
/** The bot's picture in this community, or its emoji on its colour. */
export function BotIcon({ bot, catalog, size = 40 }: { bot: OfficialBot | null; catalog: CatalogBot; size?: number }) {
  useLocaleRender();
  const photo = usePhoto("user", bot?.userId ?? "", bot?.userId ? bot.look.photoRev : null);
  if (photo) return <img className="obot-icon" src={photo} alt="" width={size} height={size} />;
  return (
    <span className="obot-icon" style={{ width: size, height: size, fontSize: size * 0.5, background: catalog.color }} aria-hidden="true">
      {catalog.icon}
    </span>
  );
}
export function PlusChip() {
  useLocaleRender();
  return (
    <span className="obot-plus-chip" title={uiText("workspace.interface.a_bots_extra_82c32ab")}>
      <Localized k="billing.interface.plus_507391f" />
    </span>
  );
}
/**
 * A setting's label and control. A Plus extra carries the PLUS chip and can't be changed without Bots+; one stored but
 * not applied (Bots+ ended) says so.
 */
export function BotField({ label, hint, plus, botsPlus, paused, children }: { label: string; hint?: ReactNode; plus?: boolean; botsPlus: boolean; paused?: boolean; children: ReactNode }) {
  useLocaleRender();
  const locked = !!plus && !botsPlus;
  return (
    <fieldset className={`obot-field${locked ? " locked" : ""}`} disabled={locked}>
      <legend className="obot-field-label">
        {label}
        {plus && <PlusChip />}
      </legend>
      {children}
      {hint && <small className="hint">{hint}</small>}
      {paused && (
        <small className="obot-paused" role="note">
          <Localized k="workspace.interface.paused_this_is_kept_but_it_only_works_again_with_bots_c23d21b" slots={[<PauseCircle size={13} aria-hidden="true" />]} />
        </small>
      )}
    </fieldset>
  );
}
/** "Get Bots+": billing for it isn't set up yet, so the button says so (the reference's "Coming soon"). */
export function GetBotsPlusButton({ orgId }: { orgId: string }) {
  useLocaleRender();
  const engine = useEngine();
  const owner = useOrbit((s) => s.orgs.find((org) => org.id === orgId)?.myRole === "OWNER");
  const online = useOrbit((s) => s.connection === "online");
  const price = useOrbit((s) => s.mojo.catalog?.onSale.botsPlus);
  return (
    <span className="obot-get-plus">
      <button
        type="button"
        className="btn btn-primary btn-sm"
        disabled={!owner || !online || !price}
        onClick={() => {
          selectCheckout(engine.device.userId, { product: "bots_plus", orgId });
          navigate({ section: "settings", settingsPage: "checkout" });
        }}
      >
        <Localized k="workspace.interface.get_bots_d36d78c" slots={[<Sparkles size={14} />, BOTS_PLUS_PRICE]} />
      </button>
      {!owner && (
        <small className="faint">
          <Localized k="workspace.interface.a_community_owner_can_purchase_bots_a13f486" />
        </small>
      )}
      {owner && !price && (
        <small className="faint">
          <Localized k="workspace.interface.bots_checkout_is_not_available_yet_d06c436" />
        </small>
      )}
      <small className="faint">
        <Localized k="workspace.interface.one_subscription_for_this_community_separate_from_meldiq_plus_ae3af7a" />
      </small>
    </span>
  );
}
/** The upsell under a bot's settings when the community has no Bots+. */
export function PlusUpsell({ perks, orgId }: { perks: string[]; orgId: string }) {
  useLocaleRender();
  return (
    <div className="obot-upsell">
      <span className="lines">
        <strong>
          <Localized k="workspace.interface.unlock_the_plus_extras_with_bots_08126c3" slots={[<PlusChip />]} />
        </strong>
        <small>
          <Localized k="workspace.interface.one_subscription_for_this_whole_community_every_official_bot_6a937e8" />
        </small>
      </span>
      {perks.length > 0 && (
        <ul className="obot-perks">
          {perks.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      <GetBotsPlusButton orgId={orgId} />
    </div>
  );
}
/** The bot's Free vs Plus table, from the catalog. */
export function FreePlusTable({ limits }: { limits: CatalogBot["limits"] }) {
  useLocaleRender();
  if (!limits.length) return null;
  return (
    <table className="obot-table">
      <thead>
        <tr>
          <th scope="col" />
          <th scope="col">
            <Localized k="billing.interface.free_f411a1f" />
          </th>
          <th scope="col">
            <Localized k="workspace.interface.plus_c0e8157" slots={[<PlusChip />]} />
          </th>
        </tr>
      </thead>
      <tbody>
        {limits.map((l) => (
          <tr key={l.what}>
            <th scope="row">{l.what}</th>
            <td>{l.free}</td>
            <td>{l.plus}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
/** Text channels a bot can post in or watch. */
export const textChannels = (channels: readonly PanelChannel[]): PanelChannel[] => channels.filter((c) => !c.voice && c.format !== "forum" && !c.archived);
interface ChannelSelectProps {
  id: string;
  value: string | null;
  channels: readonly PanelChannel[];
  /** The choice for null ("Automatic (#general)", "Where they're chatting"). */
  none: string;
  onChange: (id: string | null) => void;
}
export function ChannelSelect({ id, value, channels, none, onChange }: ChannelSelectProps) {
  useLocaleRender();
  return (
    <select id={id} className="input" value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">{none}</option>
      {channels.map((c) => (
        <option key={c.id} value={c.id}>
          #{c.name}
          {c.kind === "PRIVATE" ? uiText("workspace.interface.private_009f973") : ""}
        </option>
      ))}
    </select>
  );
}
interface ChannelListProps {
  label: string;
  value: readonly string[];
  channels: readonly PanelChannel[];
  max: number;
  onChange: (ids: string[]) => void;
}
/** Channels left out of a bot: chips with a remove button, and a picker to add one more. */
export function ChannelList({ label, value, channels, max, onChange }: ChannelListProps) {
  useLocaleRender();
  const name = (id: string) => channels.find((c) => c.id === id)?.name ?? uiText("workspace.interface.deleted_channel_2f00440");
  const left = channels.filter((c) => !value.includes(c.id));
  return (
    <div className="obot-chiplist">
      {value.map((id) => (
        <span key={id} className="obot-chip">
          #{name(id)}
          <button
            type="button"
            className="icon-btn icon-btn-xs"
            aria-label={uiText("workspace.interface.stop_leaving_out_value0_c22e924", { value0: name(id) })}
            onClick={() => onChange(value.filter((x) => x !== id))}
          >
            <X size={12} />
          </button>
        </span>
      ))}
      {value.length < max && (
        <select className="input input-sm" aria-label={label} value="" onChange={(e) => e.target.value && onChange([...value, e.target.value])}>
          <option value="">
            <Localized k="workspace.interface.leave_out_a_channel_e05bac8" />
          </option>
          {left.map((c) => (
            <option key={c.id} value={c.id}>
              #{c.name}
            </option>
          ))}
        </select>
      )}
      <small className="faint">
        <Localized k="organization.interface.of_9f7154a" slots={[value.length, max]} />
      </small>
    </div>
  );
}
/** Buttons that add a placeholder to the text being written. */
export function Placeholders({ items, onPick }: { items: readonly string[]; onPick: (p: string) => void }) {
  useLocaleRender();
  return (
    <span className="obot-placeholders">
      {items.map((p) => (
        <button key={p} type="button" className="obot-chip obot-chip-btn" onClick={() => onPick(p)}>
          {p}
        </button>
      ))}
    </span>
  );
}
