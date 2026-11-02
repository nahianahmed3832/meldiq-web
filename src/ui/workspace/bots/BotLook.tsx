import { BotTag } from "../../components/BotTag";
import { ImagePlus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useEngine } from "../../../application/orbit";
import { BOT_LIMITS, lookNameProblem } from "../../../sync/officialBotRules";
import { type CatalogBot, type OfficialBot, officialBotError, removeOfficialBotAvatar, setOfficialBotAvatar, updateOfficialBot } from "../../../sync/officialBots";
import { squareJpeg } from "../photo";
import { BotIcon } from "./BotParts";

interface BotLookProps {
  orgId: string;
  bot: OfficialBot;
  catalog: CatalogBot;
  canEdit: boolean;
  onChanged: (bot: OfficialBot) => void;
}

/** "Look in this server": the bot's name and picture in this community, and Change (a name up to 32, a picture). */
export function BotLook({ orgId, bot, catalog, canEdit, onChanged }: BotLookProps) {
  const engine = useEngine();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(bot.look.name ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const run = async (fn: () => Promise<OfficialBot>) => {
    setBusy(true);
    setError(null);
    try {
      onChanged(await fn());
      return true;
    } catch (e) {
      setError(officialBotError(e));
      return false;
    } finally {
      setBusy(false);
    }
  };
  const saveName = async () => {
    const problem = lookNameProblem(name);
    if (problem) return setError(problem);
    const trimmed = name.trim();
    if (await run(() => updateOfficialBot(engine, orgId, bot.key, { look: { name: trimmed || null } }))) setEditing(false);
  };
  const pickPicture = (f: File | undefined) => {
    if (!f) return;
    void run(async () => setOfficialBotAvatar(engine, orgId, bot.key, await squareJpeg(f)));
  };

  return (
    <section className="obot-section" aria-label="Look in this server">
      <h4>Look in this server</h4>
      <div className="obot-look">
        <BotIcon bot={bot} catalog={catalog} size={44} />
        <span className="lines grow">
          <span className="ellipsis">
            {bot.look.displayName} <BotTag />
          </span>
          <small>{bot.look.name ? `Named by this community · Meldiq's ${catalog.name}` : "Its standard name and picture"}</small>
        </span>
        {canEdit && !editing && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
            Change
          </button>
        )}
      </div>
      {editing && (
        <div className="obot-look-edit">
          <div className="field">
            <label htmlFor={`look-${bot.key}`}>Name here</label>
            <input
              id={`look-${bot.key}`}
              className="input"
              placeholder={catalog.name}
              maxLength={BOT_LIMITS.lookName}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void saveName()}
            />
            <span className="hint">
              {[...name.trim()].length} of {BOT_LIMITS.lookName}. Empty goes back to “{catalog.name}”.
            </span>
          </div>
          <div className="row obot-row-wrap">
            <input ref={file} type="file" accept="image/*" hidden onChange={(e) => pickPicture(e.target.files?.[0])} />
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => file.current?.click()}>
              <ImagePlus size={14} /> Picture
            </button>
            {bot.look.photoRev && (
              <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void run(() => removeOfficialBotAvatar(engine, orgId, bot.key))}>
                <Trash2 size={14} /> Standard picture
              </button>
            )}
            <span className="grow" />
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void saveName()}>
              {busy ? "Saving…" : "Save name"}
            </button>
          </div>
        </div>
      )}
      {error && (
        <small className="field-error" role="alert">
          {error}
        </small>
      )}
    </section>
  );
}
