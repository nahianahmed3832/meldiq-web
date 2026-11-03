import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { useEffect, useState } from "react";
import { BOT_CATEGORIES, type BotCategory, type BotListing } from "../../api/discoverySchemas";
import { useEngine } from "../../application/orbit";
import { botListing, saveBotListing } from "../../sync/discovery/api";
import { BOT_CATEGORY_TEXT, DISCOVERY_LIMITS } from "../../sync/discovery/rules";
import { Toggle } from "../components/Toggle";
import { useAction, useLoad } from "../workspace/useLoad";
/**
 * Developer › a bot › List in the directory (community parity E, feature bot-directory): put a public bot in Community
 * bots, where anyone who runs a community can find and add it, with a category and a short description.
 */
export function BotListingCard({ botId, botName, isPublic }: { botId: string; botName: string; isPublic: boolean }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const loaded = useLoad(() => botListing(engine, botId), [engine, botId, isPublic]);
  const [listing, setListing] = useState<BotListing | null>(null);
  const [category, setCategory] = useState<BotCategory>("other");
  const [description, setDescription] = useState("");
  const save = useAction();
  useEffect(() => {
    if (!loaded.data) return;
    setListing(loaded.data);
    setCategory(loaded.data.category === "unknown" ? "other" : loaded.data.category);
    setDescription(loaded.data.description);
  }, [loaded.data]);
  const store = (listed: boolean) => void save.act(async () => setListing(await saveBotListing(engine, botId, { listed, category, description })));
  const dirty = !!listing && (category !== listing.category || description.trim() !== listing.description);
  return (
    <details className="dev-listing">
      <summary>
        <Localized k="workspace.interface.list_in_the_directory_e036410" slots={[listing?.listed ? uiText("workspace.interface.listed_cbf33e4") : ""]} />
      </summary>
      {loaded.error && (
        <div className="banner danger" role="alert">
          {loaded.error}
        </div>
      )}
      {listing && (
        <div className="dev-listing-body">
          <div className="ws-row">
            <span className="lines grow">
              <span>
                <Localized k="workspace.interface.show_in_community_bots_d0d0581" slots={[botName]} />
              </span>
              <small className="faint">
                {isPublic
                  ? uiText("workspace.interface.people_who_run_a_community_can_find_it_there_and_add_it_a71d338")
                  : uiText("workspace.interface.make_the_bot_public_first_only_public_bots_can_be_listed_b23fa12")}
              </small>
            </span>
            <Toggle
              label={uiText("workspace.interface.list_value0_in_the_directory_fe468ca", { value0: botName })}
              checked={listing.listed}
              disabled={save.busy || (!isPublic && !listing.listed)}
              onChange={store}
            />
          </div>
          <label className="field">
            <span>
              <Localized k="organization.interface.category_292c06f" />
            </span>
            <select className="input input-sm" value={category} onChange={(e) => setCategory(e.target.value as BotCategory)}>
              {BOT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {BOT_CATEGORY_TEXT[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>
              <Localized k="workspace.interface.short_description_c6522e4" slots={[description.length, DISCOVERY_LIMITS.botDescription]} />
            </span>
            <textarea
              className="textarea"
              rows={2}
              maxLength={DISCOVERY_LIMITS.botDescription}
              value={description}
              placeholder={uiText("workspace.interface.what_it_does_in_a_sentence_97563a8")}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          {save.error && (
            <div className="banner danger" role="alert">
              {save.error}
            </div>
          )}
          <div>
            <button className="btn btn-secondary btn-sm" disabled={!dirty || save.busy} onClick={() => store(listing.listed)}>
              {save.busy ? l10n("common.common_saving") : l10n("common.actions.save")}
            </button>
          </div>
        </div>
      )}
    </details>
  );
}
