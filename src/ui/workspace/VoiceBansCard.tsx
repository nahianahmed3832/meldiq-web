import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { MicOff } from "lucide-react";
import { useState } from "react";
import { useEngine } from "../../application/orbit";
import { liftVoiceBan, voiceBans } from "../../sync/communitySafety";
import { shortWhen } from "../format";
import { useAction, useLoad } from "./useLoad";
import { Card, ErrorLine } from "../components/SettingsCard";
/** Bans › "Voice bans - N" (community parity A2): people kept out of voice channels, who can still read and chat. */
export function VoiceBansCard({ orgId }: { orgId: string }) {
  useLocaleRender();
  const engine = useEngine();
  const [rev, setRev] = useState(0);
  const list = useLoad(() => voiceBans(engine, orgId), [engine, orgId, rev]);
  const act = useAction();
  const count = list.data?.length ?? 0;
  return (
    <Card title={uiText("calls.interface.voice_bans_value0_3d7c588", { value0: count })} sub={uiText("calls.interface.they_can_t_join_this_community_s_voice_channels_but_can_still_rea_50c9b2a")}>
      <ErrorLine text={list.error ?? act.error} />
      <ul className="ws-list" aria-busy={list.loading} aria-label={uiText("calls.interface.voice_bans_daa3e78")}>
        {(list.data ?? []).map((b) => (
          <li key={b.userId} className="ws-row">
            <MicOff size={16} className="faint" />
            <span className="lines grow">
              <span className="ellipsis">
                {b.displayName} <span className="faint">@{b.username}</span>
              </span>
              <small className="ellipsis">
                <Localized
                  k="calls.interface.voice_banned_f2dc345"
                  slots={[
                    shortWhen(b.bannedAt),
                    b.bannedByName ? uiText("workspace.interface.by_value0_943cd46", { value0: b.bannedByName }) : "",
                    b.reason ? uiText("calls.interface.value0_9402340", { value0: b.reason }) : "",
                  ]}
                />
              </small>
            </span>
            <button className="btn btn-ghost btn-sm" disabled={act.busy} onClick={() => void act.act(() => liftVoiceBan(engine, orgId, b.userId).then(() => setRev((r) => r + 1)))}>
              <Localized k="calls.interface.lift_voice_ban_f540280" />
            </button>
          </li>
        ))}
        {list.data?.length === 0 && (
          <li className="faint">
            <Localized k="calls.interface.nobody_is_banned_from_voice_calm_skies_ac4e2b0" />
          </li>
        )}
      </ul>
    </Card>
  );
}
