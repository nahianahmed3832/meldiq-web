import { MicOff } from "lucide-react";
import { useState } from "react";
import { useEngine } from "../../application/orbit";
import { liftVoiceBan, voiceBans } from "../../sync/communitySafety";
import { shortWhen } from "../format";
import { useAction, useLoad } from "./useLoad";
import { Card, ErrorLine } from "./WorkspaceView";

/** Bans › "Voice bans - N" (community parity A2): people kept out of voice channels, who can still read and chat. */
export function VoiceBansCard({ orgId }: { orgId: string }) {
  const engine = useEngine();
  const [rev, setRev] = useState(0);
  const list = useLoad(() => voiceBans(engine, orgId), [engine, orgId, rev]);
  const act = useAction();
  const count = list.data?.length ?? 0;
  return (
    <Card title={`Voice bans - ${count}`} sub="They can't join this community's voice channels, but can still read and chat. Voice ban someone from their row in Members.">
      <ErrorLine text={list.error ?? act.error} />
      <ul className="ws-list" aria-busy={list.loading} aria-label="Voice bans">
        {(list.data ?? []).map((b) => (
          <li key={b.userId} className="ws-row">
            <MicOff size={16} className="faint" />
            <span className="lines grow">
              <span className="ellipsis">
                {b.displayName} <span className="faint">@{b.username}</span>
              </span>
              <small className="ellipsis">
                Voice banned {shortWhen(b.bannedAt)}
                {b.bannedByName ? ` by ${b.bannedByName}` : ""}
                {b.reason ? ` · ${b.reason}` : ""}
              </small>
            </span>
            <button className="btn btn-ghost btn-sm" disabled={act.busy} onClick={() => void act.act(() => liftVoiceBan(engine, orgId, b.userId).then(() => setRev((r) => r + 1)))}>
              Lift voice ban
            </button>
          </li>
        ))}
        {list.data?.length === 0 && <li className="faint">Nobody is banned from voice. Calm skies.</li>}
      </ul>
    </Card>
  );
}
