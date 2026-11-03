import { Localized } from "../../i18n/Localized";
import { Lock } from "lucide-react";
import { untilWhen } from "../format";
/** A locked community (community parity A2), on top of its channels: nobody new joins and only moderators chat. */
export function LockedBanner({ until }: { until: number }) {
  return (
    <div className="banner warn" role="status">
      <Lock size={16} aria-hidden="true" />
      <span className="grow">
        <Localized k="organization.interface.this_community_is_locked_and_unlocks_nobody_new_can_join_and_only_45539a5" slots={[untilWhen(until)]} />
      </span>
    </div>
  );
}
