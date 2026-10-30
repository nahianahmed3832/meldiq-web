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
      <summary>List in the directory{listing?.listed ? " · listed" : ""}</summary>
      {loaded.error && (
        <div className="banner danger" role="alert">
          {loaded.error}
        </div>
      )}
      {listing && (
        <div className="dev-listing-body">
          <div className="ws-row">
            <span className="lines grow">
              <span>Show {botName} in Community bots</span>
              <small className="faint">{isPublic ? "People who run a community can find it there and add it." : "Make the bot public first: only public bots can be listed."}</small>
            </span>
            <Toggle label={`List ${botName} in the directory`} checked={listing.listed} disabled={save.busy || (!isPublic && !listing.listed)} onChange={store} />
          </div>
          <label className="field">
            <span>Category</span>
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
              Short description ({description.length}/{DISCOVERY_LIMITS.botDescription})
            </span>
            <textarea
              className="textarea"
              rows={2}
              maxLength={DISCOVERY_LIMITS.botDescription}
              value={description}
              placeholder="What it does, in a sentence."
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
              {save.busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}
    </details>
  );
}
