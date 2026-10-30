import { PauseCircle, Sparkles, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { BOTS_PLUS_PRICE } from "../../../sync/officialBotRules";
import type { CatalogBot, OfficialBot } from "../../../sync/officialBots";
import type { PanelChannel } from "../../../sync/communityRules";
import { usePhoto } from "../../components/photos";

/** The bot's picture in this community, or its emoji on its colour. */
export function BotIcon({ bot, catalog, size = 40 }: { bot: OfficialBot | null; catalog: CatalogBot; size?: number }) {
  const photo = usePhoto("user", bot?.userId ?? "", bot?.userId ? bot.look.photoRev : null);
  if (photo) return <img className="obot-icon" src={photo} alt="" width={size} height={size} />;
  return (
    <span className="obot-icon" style={{ width: size, height: size, fontSize: size * 0.5, background: catalog.color }} aria-hidden="true">
      {catalog.icon}
    </span>
  );
}

export function PlusChip() {
  return (
    <span className="obot-plus-chip" title="A Bots+ extra">
      PLUS
    </span>
  );
}

/**
 * A setting's label and control. A Plus extra carries the PLUS chip and can't be changed without Bots+; one stored but
 * not applied (Bots+ ended) says so.
 */
export function BotField({ label, hint, plus, botsPlus, paused, children }: { label: string; hint?: ReactNode; plus?: boolean; botsPlus: boolean; paused?: boolean; children: ReactNode }) {
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
          <PauseCircle size={13} aria-hidden="true" /> Paused: this is kept, but it only works again with Bots+.
        </small>
      )}
    </fieldset>
  );
}

/** "Get Bots+": billing for it isn't set up yet, so the button says so (the reference's "Coming soon"). */
export function GetBotsPlusButton() {
  const [note, setNote] = useState(false);
  return (
    <span className="obot-get-plus">
      <button type="button" className="btn btn-primary btn-sm" onClick={() => setNote(true)}>
        <Sparkles size={14} /> Get Bots+ · {BOTS_PLUS_PRICE}
      </button>
      {note && (
        <small className="faint" role="status">
          Payments for Bots+ aren't set up yet. Coming soon.
        </small>
      )}
    </span>
  );
}

/** The upsell under a bot's settings when the community has no Bots+. */
export function PlusUpsell({ perks }: { perks: string[] }) {
  return (
    <div className="obot-upsell">
      <span className="lines">
        <strong>
          Unlock the PLUS extras with Bots+ <PlusChip />
        </strong>
        <small>One subscription for this whole community, every official bot.</small>
      </span>
      {perks.length > 0 && (
        <ul className="obot-perks">
          {perks.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      <GetBotsPlusButton />
    </div>
  );
}

/** The bot's Free vs Plus table, from the catalog. */
export function FreePlusTable({ limits }: { limits: CatalogBot["limits"] }) {
  if (!limits.length) return null;
  return (
    <table className="obot-table">
      <thead>
        <tr>
          <th scope="col" />
          <th scope="col">Free</th>
          <th scope="col">
            Plus <PlusChip />
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
  return (
    <select id={id} className="input" value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">{none}</option>
      {channels.map((c) => (
        <option key={c.id} value={c.id}>
          #{c.name}
          {c.kind === "PRIVATE" ? " (private)" : ""}
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
  const name = (id: string) => channels.find((c) => c.id === id)?.name ?? "deleted channel";
  const left = channels.filter((c) => !value.includes(c.id));
  return (
    <div className="obot-chiplist">
      {value.map((id) => (
        <span key={id} className="obot-chip">
          #{name(id)}
          <button type="button" className="icon-btn icon-btn-xs" aria-label={`Stop leaving out #${name(id)}`} onClick={() => onChange(value.filter((x) => x !== id))}>
            <X size={12} />
          </button>
        </span>
      ))}
      {value.length < max && (
        <select className="input input-sm" aria-label={label} value="" onChange={(e) => e.target.value && onChange([...value, e.target.value])}>
          <option value="">Leave out a channel…</option>
          {left.map((c) => (
            <option key={c.id} value={c.id}>
              #{c.name}
            </option>
          ))}
        </select>
      )}
      <small className="faint">
        {value.length} of {max}
      </small>
    </div>
  );
}

/** Buttons that add a placeholder to the text being written. */
export function Placeholders({ items, onPick }: { items: readonly string[]; onPick: (p: string) => void }) {
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
