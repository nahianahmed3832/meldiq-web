import { Compass } from "lucide-react";
import { useEffect, useState } from "react";
import type { DiscoverySettings } from "../../../api/discoverySchemas";
import { useEngine } from "../../../application/orbit";
import { navigate } from "../../../application/router";
import { discoverySettings, saveDiscoverySettings } from "../../../sync/discovery/api";
import { DISCOVERY_LIMITS, parseTags, unlistedText } from "../../../sync/discovery/rules";
import { Toggle } from "../../components/Toggle";
import { useAction, useLoad } from "../useLoad";
import { Card, ErrorLine } from "../WorkspaceView";

/**
 * Profile › Discovery (community parity E, feature discovery-listing; the reference's "Show in Discovery"): whether a
 * public community shows in Discover, what the 5-member rule means for it right now, the card's one-line description
 * and up to 5 topic tags. For people who can edit the community; the server checks again.
 */
export function DiscoveryCard({ orgId }: { orgId: string }) {
  const engine = useEngine();
  const loaded = useLoad(() => discoverySettings(engine, orgId), [engine, orgId]);
  const [settings, setSettings] = useState<DiscoverySettings | null>(null);
  useEffect(() => setSettings(loaded.data), [loaded.data]);
  if (!settings) return loaded.error ? <ErrorLine text={loaded.error} /> : null;
  return <DiscoveryForm orgId={orgId} settings={settings} onSaved={setSettings} />;
}

interface DiscoveryFormProps {
  orgId: string;
  settings: DiscoverySettings;
  onSaved: (s: DiscoverySettings) => void;
}

function DiscoveryForm({ orgId, settings, onSaved }: DiscoveryFormProps) {
  const engine = useEngine();
  const [description, setDescription] = useState(settings.description ?? "");
  const [tagsText, setTagsText] = useState(settings.tags.join(", "));
  const toggle = useAction();
  const save = useAction();
  useEffect(() => {
    setDescription(settings.description ?? "");
    setTagsText(settings.tags.join(", "));
  }, [settings.description, settings.tags]);
  const tags = parseTags(tagsText);
  const cleanDescription = description.trim() || null;
  const dirty = cleanDescription !== settings.description || ("tags" in tags && tags.tags.join(",") !== settings.tags.join(","));
  const status = settings.listed ? "Listed in Discover now." : unlistedText(settings.reason, settings.memberCount, settings.minMembers);

  const setShown = (discoverable: boolean) => void toggle.act(async () => onSaved(await saveDiscoverySettings(engine, orgId, { discoverable })));
  const submit = () => {
    if (!("tags" in tags)) return;
    void save.act(async () => onSaved(await saveDiscoverySettings(engine, orgId, { description: cleanDescription, tags: tags.tags })));
  };

  return (
    <Card
      title="Discovery"
      sub={`Public communities show in Discover once they have ${settings.minMembers} members, so people with the same interests can find and join them. Turn it off to stay public without being listed.`}
    >
      <ErrorLine text={toggle.error} />
      <div className="ws-row discovery-toggle">
        <Compass size={18} className="faint" aria-hidden="true" />
        <span className="lines grow">
          <span>Show in Discovery</span>
          <small className={settings.listed ? "discovery-listed" : "faint"} role="status">
            {status}
          </small>
        </span>
        <Toggle label="Show in Discovery" checked={settings.discoverable} disabled={toggle.busy} onChange={setShown} />
      </div>
      <div className="field">
        <label htmlFor="disc-desc">One-line description</label>
        <input
          id="disc-desc"
          className="input"
          value={description}
          maxLength={DISCOVERY_LIMITS.description}
          placeholder={settings.communityDescription ?? "What's this community about?"}
          onChange={(e) => setDescription(e.target.value)}
        />
        <span className="hint">
          Shown on the community's card in Discover ({description.length}/{DISCOVERY_LIMITS.description}). Empty: the community's description is used.
        </span>
      </div>
      <div className="field">
        <label htmlFor="disc-tags">Tags</label>
        <input id="disc-tags" className="input" value={tagsText} placeholder="gaming, pixel art, study" aria-invalid={"problem" in tags} onChange={(e) => setTagsText(e.target.value)} />
        {"problem" in tags ? (
          <p className="field-error" role="alert">
            {tags.problem}
          </p>
        ) : (
          <span className="hint">Up to {DISCOVERY_LIMITS.tags}, separated by commas. People can search for them and tap one to see similar communities.</span>
        )}
      </div>
      <ErrorLine text={save.error} />
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <button className="btn btn-primary btn-sm" disabled={!dirty || save.busy || "problem" in tags} onClick={submit}>
          {save.busy ? "Saving…" : "Save"}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate({ section: "discover" })}>
          Open Discover
        </button>
      </div>
    </Card>
  );
}
