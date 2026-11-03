import { useLocaleRender } from "../../../i18n/Localized";
import { text as uiText } from "../../../i18n";
import { Localized } from "../../../i18n/Localized";
import { useT as useLocalization } from "../../../i18n";
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
  useLocaleRender();
  const l10n = useLocalization();
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
    <section className="obot-section" aria-label={uiText("workspace.interface.look_in_this_server_9134fe6")}>
      <h4>
        <Localized k="workspace.interface.look_in_this_server_9134fe6" />
      </h4>
      <div className="obot-look">
        <BotIcon bot={bot} catalog={catalog} size={44} />
        <span className="lines grow">
          <span className="ellipsis">
            {bot.look.displayName} <BotTag />
          </span>
          <small>
            {bot.look.name
              ? uiText("workspace.interface.named_by_this_community_meldiq_s_value0_1e4d53f", { value0: catalog.name })
              : uiText("workspace.interface.its_standard_name_and_picture_b3716a4")}
          </small>
        </span>
        {canEdit && !editing && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
            <Localized k="workspace.interface.change_c0bf75b" />
          </button>
        )}
      </div>
      {editing && (
        <div className="obot-look-edit">
          <div className="field">
            <label htmlFor={`look-${bot.key}`}>
              <Localized k="workspace.interface.name_here_cd063ca" />
            </label>
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
              <Localized k="workspace.interface.of_empty_goes_back_to_a478946" slots={[[...name.trim()].length, BOT_LIMITS.lookName, catalog.name]} />
            </span>
          </div>
          <div className="row obot-row-wrap">
            <input ref={file} type="file" accept="image/*" hidden onChange={(e) => pickPicture(e.target.files?.[0])} />
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => file.current?.click()}>
              <Localized k="workspace.interface.picture_19c7471" slots={[<ImagePlus size={14} />]} />
            </button>
            {bot.look.photoRev && (
              <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void run(() => removeOfficialBotAvatar(engine, orgId, bot.key))}>
                <Localized k="workspace.interface.standard_picture_92875ea" slots={[<Trash2 size={14} />]} />
              </button>
            )}
            <span className="grow" />
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setEditing(false)}>
              {l10n("common.actions.cancel")}
            </button>
            <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void saveName()}>
              {busy ? l10n("common.common_saving") : uiText("workspace.interface.save_name_b729722")}
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
