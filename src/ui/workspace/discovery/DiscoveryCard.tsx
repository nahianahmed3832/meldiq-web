import { useLocaleRender } from "../../../i18n/Localized";
import { text as uiText } from "../../../i18n";
import { Localized } from "../../../i18n/Localized";
import { useT as useLocalization } from "../../../i18n";
import { Compass } from "lucide-react";
import { useEffect, useState } from "react";
import type { DiscoverySettings } from "../../../api/discoverySchemas";
import { useEngine } from "../../../application/orbit";
import { navigate } from "../../../application/router";
import { discoverySettings, saveDiscoverySettings } from "../../../sync/discovery/api";
import { DISCOVERY_LIMITS, parseTags, unlistedText } from "../../../sync/discovery/rules";
import { Toggle } from "../../components/Toggle";
import { useAction, useLoad } from "../useLoad";
import { Card, ErrorLine } from "../../components/SettingsCard";
/**
 * Profile › Discovery (community parity E, feature discovery-listing; the reference's "Show in Discovery"): whether a
 * public community shows in Discover, what the 5-member rule means for it right now, the card's one-line description
 * and up to 5 topic tags. For people who can edit the community; the server checks again.
 */
export function DiscoveryCard({ orgId }: { orgId: string }) {
  useLocaleRender();
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
  useLocaleRender();
  const l10n = useLocalization();
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
  const status = settings.listed ? uiText("workspace.interface.listed_in_discover_now_2de0396") : unlistedText(settings.reason, settings.memberCount, settings.minMembers);
  const setShown = (discoverable: boolean) => void toggle.act(async () => onSaved(await saveDiscoverySettings(engine, orgId, { discoverable })));
  const submit = () => {
    if (!("tags" in tags)) return;
    void save.act(async () => onSaved(await saveDiscoverySettings(engine, orgId, { description: cleanDescription, tags: tags.tags })));
  };
  return (
    <Card
      title={uiText("workspace.interface.discovery_80fc402")}
      sub={uiText("workspace.interface.public_communities_show_in_discover_once_they_have_value0_members_09d7e61", { value0: settings.minMembers })}
    >
      <ErrorLine text={toggle.error} />
      <div className="ws-row discovery-toggle">
        <Compass size={18} className="faint" aria-hidden="true" />
        <span className="lines grow">
          <span>
            <Localized k="workspace.interface.show_in_discovery_4011f21" />
          </span>
          <small className={settings.listed ? "discovery-listed" : "faint"} role="status">
            {status}
          </small>
        </span>
        <Toggle label={uiText("workspace.interface.show_in_discovery_4011f21")} checked={settings.discoverable} disabled={toggle.busy} onChange={setShown} />
      </div>
      <div className="field">
        <label htmlFor="disc-desc">
          <Localized k="workspace.interface.one_line_description_26976f9" />
        </label>
        <input
          id="disc-desc"
          className="input"
          value={description}
          maxLength={DISCOVERY_LIMITS.description}
          placeholder={settings.communityDescription ?? uiText("workspace.interface.what_s_this_community_about_15cc0cc")}
          onChange={(e) => setDescription(e.target.value)}
        />
        <span className="hint">
          <Localized k="workspace.interface.shown_on_the_community_s_card_in_discover_empty_the_community_s_d_3ccbe62" slots={[description.length, DISCOVERY_LIMITS.description]} />
        </span>
      </div>
      <div className="field">
        <label htmlFor="disc-tags">
          <Localized k="organization.interface.tags_1331275" />
        </label>
        <input
          id="disc-tags"
          className="input"
          value={tagsText}
          placeholder={uiText("workspace.interface.gaming_pixel_art_study_da616fb")}
          aria-invalid={"problem" in tags}
          onChange={(e) => setTagsText(e.target.value)}
        />
        {"problem" in tags ? (
          <p className="field-error" role="alert">
            {tags.problem}
          </p>
        ) : (
          <span className="hint">
            <Localized k="workspace.interface.up_to_separated_by_commas_people_can_search_for_them_and_tap_one_49f17e2" slots={[DISCOVERY_LIMITS.tags]} />
          </span>
        )}
      </div>
      <ErrorLine text={save.error} />
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <button className="btn btn-primary btn-sm" disabled={!dirty || save.busy || "problem" in tags} onClick={submit}>
          {save.busy ? l10n("common.common_saving") : l10n("common.actions.save")}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate({ section: "discover" })}>
          <Localized k="workspace.interface.open_discover_43454af" />
        </button>
      </div>
    </Card>
  );
}
