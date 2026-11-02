import { useEffect, useState } from "react";
import type { Conversation } from "../../api/schemas";
import { useEngine } from "../../application/orbit";
import { communitySettings, saveCommunitySettings } from "../../sync/communitySettings";
import { Toggle } from "../components/Toggle";
import { useAction, useLoad } from "./useLoad";
import { Card, ErrorLine } from "./WorkspaceView";

interface OnboardingGateCardProps {
  orgId: string;
  /** The community's channels, for the starting channel (public text and announcement channels only). */
  channels: Conversation[];
}

/**
 * Onboarding › Must finish before chatting and Starting channel (community parity A3): new members read but can't post
 * until they finish, then land in the starting channel. Members can redo it from the community menu.
 */
export function OnboardingGateCard({ orgId, channels }: OnboardingGateCardProps) {
  const engine = useEngine();
  const settings = useLoad(() => communitySettings(engine, orgId), [engine, orgId]);
  const [required, setRequired] = useState(false);
  const [start, setStart] = useState<string | null>(null);
  const save = useAction();
  useEffect(() => {
    if (!settings.data) return;
    setRequired(settings.data.onboardingRequired);
    setStart(settings.data.startChannelId);
  }, [settings.data]);
  const places = channels.filter((c) => !c.voice && c.format !== "forum" && (c.kind === "PUBLIC" || c.kind === "ANNOUNCEMENT") && !c.archived);
  const dirty = !!settings.data && (required !== settings.data.onboardingRequired || start !== settings.data.startChannelId);
  return (
    <Card title="After the questions" sub="Only people who join from now on are held back. Everyone can redo onboarding from the community menu.">
      <ErrorLine text={settings.error ?? save.error} />
      <div className="setting">
        <span className="lines">
          <strong>Must finish before chatting</strong>
          <small>New members can read everything, but can't post or react until they've finished.</small>
        </span>
        <Toggle checked={required} onChange={setRequired} label="Must finish before chatting" disabled={!settings.data} />
      </div>
      <label className="field">
        <span>Starting channel</span>
        <select className="input" value={start ?? ""} onChange={(e) => setStart(e.target.value || null)} disabled={!settings.data}>
          <option value="">Same as usual</option>
          {places.map((c) => (
            <option key={c.id} value={c.id}>
              #{c.name}
            </option>
          ))}
        </select>
        <small className="faint">Where people land once they finish. It has to be a channel everyone can see.</small>
      </label>
      <div>
        <button
          className="btn btn-primary btn-sm"
          disabled={!dirty || save.busy}
          onClick={() => void save.act(() => saveCommunitySettings(engine, orgId, { onboardingRequired: required, startChannelId: start }).then(settings.reload))}
        >
          {save.busy ? "Saving…" : "Save"}
        </button>
      </div>
    </Card>
  );
}
