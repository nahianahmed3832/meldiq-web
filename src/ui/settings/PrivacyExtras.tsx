import { LogOut } from "lucide-react";
import { useState } from "react";
import { UNKNOWN } from "../../api/enums";
import { useOrbit } from "../../application/orbit";
import { GROUP_ADD_LABEL, GROUP_ADD_POLICIES, type GroupAddPolicy, type MessagingChange, type MessagingSettings } from "../../sync/social";
import { Toggle } from "../components/Toggle";
import { LeaveManyDialog } from "./LeaveManyDialog";

const GROUP_ADD_HINT: Record<GroupAddPolicy, string> = {
  everyone: "Anyone who can find you can put you in a group chat.",
  friends: "Only your friends can put you in a group chat.",
  nobody: "No one can put you in a group chat, not even friends. You can still make your own groups.",
};

interface GroupAndSuggestRowsProps {
  settings: MessagingSettings | null;
  groupAdd: boolean;
  suggest: boolean;
  busy: boolean;
  onChange: (change: MessagingChange) => void;
}

/**
 * Settings › Privacy, API 0.65.0: who may add you to group chats (the server checks it when a group is made and when
 * someone is added), and whether you're suggested to people who share a community with you.
 */
export function GroupAndSuggestRows({ settings, groupAdd, suggest, busy, onChange }: GroupAndSuggestRowsProps) {
  const policy = settings?.groupAddPolicy;
  return (
    <>
      {groupAdd && (
        <div className="ws-row">
          <span className="lines grow">
            <span>Who can add you to group chats</span>
            <small>{policy && policy !== UNKNOWN ? GROUP_ADD_HINT[policy] : "Groups you make yourself are never affected."}</small>
          </span>
          <select
            className="input input-sm"
            aria-label="Who can add you to group chats"
            disabled={!settings || busy}
            value={policy ?? "friends"}
            onChange={(e) => onChange({ groupAddPolicy: e.target.value as GroupAddPolicy })}
          >
            {policy === UNKNOWN && (
              <option value={UNKNOWN} disabled>
                Set in a newer version of Meldiq
              </option>
            )}
            {GROUP_ADD_POLICIES.map((p) => (
              <option key={p} value={p}>
                {GROUP_ADD_LABEL[p]}
              </option>
            ))}
          </select>
        </div>
      )}
      {suggest && (
        <div className="ws-row">
          <span className="lines grow">
            <span>Suggest me to people who share communities with me</span>
            <small>You show up in their Suggested list under Friends. Friends, people with a request waiting and blocked people never see you there.</small>
          </span>
          <Toggle label="Suggest me to people who share communities with me" checked={settings?.suggestable ?? false} disabled={!settings || busy} onChange={(v) => onChange({ suggestable: v })} />
        </div>
      )}
    </>
  );
}

/** Settings › Privacy, API 0.65.0: leave several communities in one go (the ones you own stay). */
export function LeaveManyCard() {
  const offered = useOrbit((s) => s.server?.features.includes("leave-many") ?? false);
  const count = useOrbit((s) => s.orgs.length);
  const [open, setOpen] = useState(false);
  if (!offered) return null;
  return (
    <div className="card">
      <div className="setting">
        <div className="lines">
          <strong>Leave several communities at once</strong>
          <small>Pick the ones to leave. Communities you own stay; hand them over first if you want to leave them.</small>
        </div>
        <button className="btn btn-secondary btn-sm" disabled={count === 0} onClick={() => setOpen(true)}>
          <LogOut size={14} aria-hidden="true" /> Choose…
        </button>
      </div>
      {open && <LeaveManyDialog onClose={() => setOpen(false)} />}
    </div>
  );
}
